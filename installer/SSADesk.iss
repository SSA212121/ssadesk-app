; SSADesk: instalador único e igual para todos os computadores Windows.
; Cada instalação acessa outros computadores e pode ser acessada, por conexão DIRETA (IPv4/IPv6),
; sem servidor central, VPS ou servidores de terceiros. Senha permanente obrigatória.
; Gerar com build.ps1 (baixa e confere os binários oficiais do RustDesk antes de compilar).
; Base: RustDesk (AGPL-3.0), binários oficiais sem modificação.

#define AppName "SSADesk"
#define AppVersion "2.0.0"

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

[InstallDelete]
; Restos da versão 1.x (modelo com servidor de Lages)
Type: filesandordirs; Name: "{app}\Servidor\bin"
Type: files; Name: "{app}\tools\configure-server.ps1"
Type: files; Name: "{app}\tools\configure-client.ps1"

[Files]
Source: "hbbs.exe";             DestDir: "{app}\bin"; Flags: ignoreversion
Source: "rustdesk.msi";         DestDir: "{tmp}"; Flags: deleteafterinstall
Source: "configure.ps1";        DestDir: "{app}\tools"; Flags: ignoreversion
Source: "LICENSE-RUSTDESK-AGPL.txt"; DestDir: "{app}"; Flags: ignoreversion
Source: "LICENSE-SERVER-AGPL.txt";   DestDir: "{app}"; Flags: ignoreversion

[Run]
Filename: "{win}\notepad.exe"; Parameters: """{app}\SSADESK-ESTE-COMPUTADOR.txt"""; Description: "Abrir código e endereços deste computador"; Flags: postinstall nowait skipifsilent unchecked

[UninstallRun]
Filename: "{sys}\WindowsPowerShell\v1.0\powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\tools\configure.ps1"" -Mode uninstall -InstallDir ""{app}"""; Flags: runhidden waituntilterminated; RunOnceId: "SSADeskOff"

[UninstallDelete]
Type: files; Name: "{app}\SSADESK-ESTE-COMPUTADOR.txt"

[Code]
var
  PassPage: TInputQueryWizardPage;

procedure InitializeWizard;
begin
  PassPage := CreateInputQueryPage(wpSelectDir,
    'Senha de acesso',
    'Senha permanente para acessar este computador',
    'Quem conectar a este computador vai precisar desta senha. Mínimo de 8 caracteres. Guarde no cofre de senhas.');
  PassPage.Add('Senha:', True);
  PassPage.Add('Confirmar senha:', True);
end;

function NextButtonClick(CurPageID: Integer): Boolean;
begin
  Result := True;
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

{ Reinstalação: para o componente local antes de substituir arquivos (evita "arquivo em uso") }
function PrepareToInstall(var NeedsRestart: Boolean): String;
var
  Code: Integer;
begin
  Result := '';
  Exec(ExpandConstant('{sys}\schtasks.exe'), '/End /TN SSADesk-local', '', SW_HIDE, ewWaitUntilTerminated, Code);
  Exec(ExpandConstant('{sys}\schtasks.exe'), '/End /TN SSADesk-hbbs', '', SW_HIDE, ewWaitUntilTerminated, Code);
  Exec(ExpandConstant('{sys}\schtasks.exe'), '/End /TN SSADesk-hbbr', '', SW_HIDE, ewWaitUntilTerminated, Code);
  Exec(ExpandConstant('{sys}\taskkill.exe'), '/F /IM hbbs.exe', '', SW_HIDE, ewWaitUntilTerminated, Code);
  Exec(ExpandConstant('{sys}\taskkill.exe'), '/F /IM hbbr.exe', '', SW_HIDE, ewWaitUntilTerminated, Code);
end;

procedure CurStepChanged(CurStep: TSetupStep);
var
  PwFile: String;
  Code: Integer;
begin
  if CurStep <> ssPostInstall then Exit;
  WizardForm.StatusLabel.Caption := 'Configurando o acesso remoto e gerando o código deste computador...';
  PwFile := ExpandConstant('{tmp}\pw.txt');
  SaveStringToFile(PwFile, PassPage.Values[0], False);
  PassPage.Values[0] := ''; PassPage.Values[1] := '';
  if not Exec(ExpandConstant('{sys}\WindowsPowerShell\v1.0\powershell.exe'),
              '-NoProfile -ExecutionPolicy Bypass -File "' + ExpandConstant('{app}\tools\configure.ps1') + '" -Mode install -InstallDir "' +
              ExpandConstant('{app}') + '" -Msi "' + ExpandConstant('{tmp}\rustdesk.msi') + '" -PasswordFile "' + PwFile + '"',
              '', SW_HIDE, ewWaitUntilTerminated, Code) or (Code <> 0) then
    MsgBox('A configuração falhou. Detalhes em ' + ExpandConstant('{app}\instalacao.log'), mbError, MB_OK);
  DeleteFile(PwFile);
end;

procedure CurPageChanged(CurPageID: Integer);
var
  Lines: TArrayOfString;
  Msg: String;
  I: Integer;
begin
  if CurPageID <> wpFinished then Exit;
  Msg := '';
  if LoadStringsFromFile(ExpandConstant('{app}\SSADESK-ESTE-COMPUTADOR.txt'), Lines) then
    for I := 2 to GetArrayLength(Lines) - 1 do
      if (Pos('Código', Lines[I]) = 1) or (Pos('IPv6 (', Trim(Lines[I])) = 1) or (Pos('IPv4 (rede', Trim(Lines[I])) = 1) then
        Msg := Msg + Trim(Lines[I]) + #13#10;
  if Msg = '' then Msg := 'Veja ' + ExpandConstant('{app}\instalacao.log') + #13#10;
  WizardForm.FinishedLabel.Caption := 'SSADesk instalado.' + #13#10#13#10 + Msg + #13#10 +
    'Este computador já pode acessar outros e ser acessado (com a senha).' + #13#10 +
    'Tudo salvo em ' + ExpandConstant('{app}\SSADESK-ESTE-COMPUTADOR.txt');
end;
