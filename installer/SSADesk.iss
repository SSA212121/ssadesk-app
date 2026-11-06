; SSADesk: instalador universal para Windows (um único Setup.exe).
;   - "Servidor SSADesk": hbbs + hbbr (rustdesk/rustdesk-server oficial), só no computador de Lages.
;   - "Acesso remoto deste computador": cliente RustDesk oficial apontado para o servidor da SSA,
;     com código (ID) único e senha permanente obrigatória.
; Gerar com build.ps1 (baixa e confere os binários oficiais antes de compilar).
; Base: RustDesk (AGPL-3.0), binários oficiais sem modificação.

#define AppName "SSADesk"
#define AppVersion "1.1.0"
#define RustDeskServerVersion "1.1.16"
#define RustDeskVersion "1.5.1"

[Setup]
AppId={{6B1F4C2E-8D3A-4E7B-9A51-5A1D35C0A001}
AppName={#AppName}
AppVersion={#AppVersion}
AppVerName={#AppName} {#AppVersion}
AppPublisher=SSA Comércio
DefaultDirName={sd}\SSADesk
DisableDirPage=no
DisableProgramGroupPage=yes
PrivilegesRequired=admin
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
WizardStyle=modern dynamic
OutputDir=..\..\dist
OutputBaseFilename=SSADesk-Setup
Compression=lzma2/max
SolidCompression=yes
UninstallDisplayName={#AppName}
CloseApplications=no
RestartApplications=no

[Languages]
Name: "ptbr"; MessagesFile: "compiler:Languages\BrazilianPortuguese.isl"

[Types]
Name: "computador"; Description: "Computador (acesso remoto)"
Name: "servidor";   Description: "Servidor de Lages (servidor SSADesk + acesso remoto)"
Name: "custom";     Description: "Personalizado"; Flags: iscustom

[Components]
Name: "client"; Description: "Acesso remoto deste computador (recebe um código SSADesk único)"; Types: computador servidor custom
Name: "server"; Description: "Servidor SSADesk (somente no computador de Lages)"; Types: servidor

[Files]
Source: "hbbs.exe";              DestDir: "{app}\Servidor\bin"; Components: server; Flags: ignoreversion
Source: "hbbr.exe";              DestDir: "{app}\Servidor\bin"; Components: server; Flags: ignoreversion
Source: "configure-server.ps1";  DestDir: "{app}\tools"; Components: server; Flags: ignoreversion
Source: "LICENSE-SERVER-AGPL.txt"; DestDir: "{app}\Servidor"; Components: server; Flags: ignoreversion
Source: "rustdesk.msi";          DestDir: "{tmp}"; Components: client; Flags: deleteafterinstall
Source: "configure-client.ps1";  DestDir: "{app}\tools"; Components: client; Flags: ignoreversion
Source: "LICENSE-RUSTDESK-AGPL.txt"; DestDir: "{app}\Cliente"; Components: client; Flags: ignoreversion

[UninstallRun]
Filename: "{sys}\WindowsPowerShell\v1.0\powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\tools\configure-client.ps1"" -Mode uninstall -InstallDir ""{app}\Cliente"""; Flags: runhidden waituntilterminated skipifdoesntexist; RunOnceId: "SSADeskClientOff"
Filename: "{sys}\WindowsPowerShell\v1.0\powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\tools\configure-server.ps1"" -Mode uninstall -InstallDir ""{app}\Servidor"""; Flags: runhidden waituntilterminated skipifdoesntexist; RunOnceId: "SSADeskServerOff"

[UninstallDelete]
Type: files; Name: "{app}\Servidor\CHAVE-PUBLICA.txt"
Type: files; Name: "{app}\Cliente\SSADESK-ID.txt"
; Servidor\data (chaves) é preservado de propósito: reinstalar mantém a mesma chave.

[Code]
var
  HostPage, KeyPage, PassPage: TInputQueryWizardPage;
  IniHost, IniKey: String;

function Ps(): String;
begin
  Result := ExpandConstant('{sys}\WindowsPowerShell\v1.0\powershell.exe');
end;

procedure InitializeWizard;
var
  Ini: String;
begin
  { ssadesk.ini ao lado do Setup.exe (gerado na instalação do servidor) preenche tudo sozinho }
  Ini := ExpandConstant('{src}\ssadesk.ini');
  IniHost := GetIniString('ssadesk', 'host', '', Ini);
  IniKey  := GetIniString('ssadesk', 'key', '', Ini);

  HostPage := CreateInputQueryPage(wpSelectComponents,
    'Servidor SSADesk',
    'Endereço do servidor de Lages na internet',
    'IP público fixo ou DNS de Lages (ex.: lages.ssacomercio.com.br). Sem IP fixo, use DNS dinâmico no roteador.');
  HostPage.Add('IP público ou DNS:', False);
  HostPage.Values[0] := GetPreviousData('PublicHost', IniHost);
  if IniHost <> '' then HostPage.Values[0] := IniHost;

  KeyPage := CreateInputQueryPage(HostPage.ID,
    'Chave do servidor',
    'Chave pública do servidor SSADesk',
    'Está no arquivo CHAVE-PUBLICA.txt do servidor de Lages. Sem ela, este computador não conecta.');
  KeyPage.Add('Chave:', False);
  KeyPage.Values[0] := GetPreviousData('ServerKey', IniKey);
  if IniKey <> '' then KeyPage.Values[0] := IniKey;

  PassPage := CreateInputQueryPage(KeyPage.ID,
    'Senha de acesso',
    'Senha permanente para acessar este computador',
    'Quem conectar a este computador vai precisar desta senha. Mínimo de 8 caracteres. Guarde no cofre de senhas.');
  PassPage.Add('Senha:', True);
  PassPage.Add('Confirmar senha:', True);
end;

procedure RegisterPreviousData(PreviousDataKey: Integer);
begin
  SetPreviousData(PreviousDataKey, 'PublicHost', HostPage.Values[0]);
  SetPreviousData(PreviousDataKey, 'ServerKey', KeyPage.Values[0]);
end;

function ShouldSkipPage(PageID: Integer): Boolean;
begin
  Result := False;
  { Com ssadesk.ini presente, servidor e chave já vêm prontos }
  if (PageID = HostPage.ID) then
    Result := (IniHost <> '') and not WizardIsComponentSelected('server');
  if (PageID = KeyPage.ID) then
    Result := WizardIsComponentSelected('server') or (not WizardIsComponentSelected('client')) or (IniKey <> '');
  if (PageID = PassPage.ID) then
    Result := not WizardIsComponentSelected('client');
end;

function NextButtonClick(CurPageID: Integer): Boolean;
var
  H: String;
begin
  Result := True;
  if (CurPageID = wpSelectComponents) and not WizardIsComponentSelected('client') and not WizardIsComponentSelected('server') then
  begin
    MsgBox('Selecione ao menos um item.', mbError, MB_OK);
    Result := False;
  end;
  if CurPageID = HostPage.ID then
  begin
    H := Trim(HostPage.Values[0]);
    if (H = '') or (Pos(' ', H) > 0) or (Pos(':', H) > 0) or (Pos('/', H) > 0) then
    begin
      MsgBox('Informe só o IP ou o DNS, sem espaços, porta ou "http://".', mbError, MB_OK);
      Result := False;
    end else
      HostPage.Values[0] := H;
  end;
  if CurPageID = KeyPage.ID then
  begin
    KeyPage.Values[0] := Trim(KeyPage.Values[0]);
    if Length(KeyPage.Values[0]) < 40 then
    begin
      MsgBox('Chave inválida. Copie a linha "Chave" do CHAVE-PUBLICA.txt do servidor.', mbError, MB_OK);
      Result := False;
    end;
  end;
  if CurPageID = PassPage.ID then
  begin
    if Length(PassPage.Values[0]) < 8 then
    begin
      MsgBox('A senha precisa ter ao menos 8 caracteres. Acesso sem senha não é permitido.', mbError, MB_OK);
      Result := False;
    end else if PassPage.Values[0] <> PassPage.Values[1] then
    begin
      MsgBox('As senhas não conferem.', mbError, MB_OK);
      Result := False;
    end;
  end;
end;

function RunPs(Script, Args: String): Boolean;
var
  Code: Integer;
begin
  Result := Exec(Ps(), '-NoProfile -ExecutionPolicy Bypass -File "' + ExpandConstant('{app}\tools\') + Script + '" ' + Args,
                 '', SW_HIDE, ewWaitUntilTerminated, Code) and (Code = 0);
end;

procedure CurStepChanged(CurStep: TSetupStep);
var
  Host, Key, PwFile, Pub: String;
  Lines: TArrayOfString;
begin
  if CurStep <> ssPostInstall then Exit;
  Host := HostPage.Values[0];
  Key := KeyPage.Values[0];

  if WizardIsComponentSelected('server') then
  begin
    WizardForm.StatusLabel.Caption := 'Iniciando o servidor SSADesk...';
    if not RunPs('configure-server.ps1', '-Mode install -InstallDir "' + ExpandConstant('{app}\Servidor') + '" -PublicHost "' + Host + '"') then
      MsgBox('A configuração do servidor falhou. Detalhes em ' + ExpandConstant('{app}\Servidor\instalacao.log'), mbError, MB_OK);
    Pub := ExpandConstant('{app}\Servidor\data\id_ed25519.pub');
    if LoadStringsFromFile(Pub, Lines) and (GetArrayLength(Lines) > 0) then Key := Trim(Lines[0]);
    { No próprio servidor, o cliente fala com o servidor local (evita depender de NAT loopback do roteador) }
    Host := '127.0.0.1';
  end;

  if WizardIsComponentSelected('client') then
  begin
    WizardForm.StatusLabel.Caption := 'Instalando o acesso remoto e gerando o código deste computador...';
    PwFile := ExpandConstant('{tmp}\pw.txt');
    SaveStringToFile(PwFile, PassPage.Values[0], False);
    PassPage.Values[0] := ''; PassPage.Values[1] := '';
    if not RunPs('configure-client.ps1', '-Mode install -InstallDir "' + ExpandConstant('{app}\Cliente') + '" -Msi "' +
                 ExpandConstant('{tmp}\rustdesk.msi') + '" -ServerHost "' + Host + '" -Key "' + Key + '" -PasswordFile "' + PwFile + '"') then
      MsgBox('A configuração do acesso remoto falhou. Detalhes em ' + ExpandConstant('{app}\Cliente\instalacao.log'), mbError, MB_OK);
    DeleteFile(PwFile);
  end;
end;

procedure CurPageChanged(CurPageID: Integer);
var
  Lines: TArrayOfString;
  Msg: String;
begin
  if CurPageID <> wpFinished then Exit;
  Msg := 'SSADesk instalado.' + #13#10#13#10;
  if WizardIsComponentSelected('client') and LoadStringsFromFile(ExpandConstant('{app}\Cliente\SSADESK-ID.txt'), Lines) and (GetArrayLength(Lines) > 0) then
    Msg := Msg + 'Código deste computador:' + #13#10 + '    ' + Lines[0] + #13#10#13#10 + 'Use este código para conectar a ele.' + #13#10#13#10;
  if WizardIsComponentSelected('server') then
    Msg := Msg + 'Servidor ativo. Para instalar nos outros computadores, copie' + #13#10 +
           ExpandConstant('{app}\Servidor\ssadesk.ini') + #13#10 + 'para junto do SSADesk-Setup.exe: servidor e chave serão preenchidos sozinhos.' + #13#10#13#10 +
           'Lembrete: no roteador, redirecione TCP 21115-21119 e UDP 21116 para este computador.';
  WizardForm.FinishedLabel.Caption := Msg;
end;
