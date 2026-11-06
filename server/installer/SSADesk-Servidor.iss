; SSADesk Servidor: instalador do servidor RustDesk próprio (hbbs + hbbr) para o Windows de Lages.
; Gerar com build.ps1 (baixa e confere o rustdesk-server oficial antes de compilar).
; Base: rustdesk/rustdesk-server (AGPL-3.0), binários oficiais sem modificação.

#define AppName "SSADesk Servidor"
#define AppVersion "1.0.0"
#define RustDeskServerVersion "1.1.16"

[Setup]
AppId={{6B1F4C2E-8D3A-4E7B-9A51-5A1D35C0A001}
AppName={#AppName}
AppVersion={#AppVersion}
AppVerName={#AppName} {#AppVersion} (RustDesk Server {#RustDeskServerVersion})
AppPublisher=SSA Comércio
DefaultDirName={sd}\SSADesk\Servidor
DisableDirPage=no
DisableProgramGroupPage=yes
DisableWelcomePage=no
PrivilegesRequired=admin
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
WizardStyle=modern dynamic
OutputDir=..\..\dist
OutputBaseFilename=SSADesk-Servidor-Setup
Compression=lzma2/max
SolidCompression=yes
UninstallDisplayName={#AppName}
CloseApplications=no
RestartApplications=no

[Languages]
Name: "ptbr"; MessagesFile: "compiler:Languages\BrazilianPortuguese.isl"

[Files]
Source: "payload\hbbs.exe"; DestDir: "{app}\bin"; Flags: ignoreversion
Source: "payload\hbbr.exe"; DestDir: "{app}\bin"; Flags: ignoreversion
Source: "payload\configure.ps1"; DestDir: "{app}\tools"; Flags: ignoreversion
Source: "payload\LICENSE-AGPL.txt"; DestDir: "{app}"; Flags: ignoreversion skipifsourcedoesntexist

[Run]
Filename: "{win}\notepad.exe"; Parameters: """{app}\CHAVE-PUBLICA.txt"""; Description: "Abrir os dados para configurar os clientes (chave pública)"; Flags: postinstall nowait skipifsilent

[UninstallRun]
Filename: "{sys}\WindowsPowerShell\v1.0\powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\tools\configure.ps1"" -Mode uninstall -InstallDir ""{app}"""; Flags: runhidden waituntilterminated; RunOnceId: "SSADeskUnconfigure"

[UninstallDelete]
Type: files; Name: "{app}\CHAVE-PUBLICA.txt"
; data\ (chaves) é preservado de propósito: reinstalar mantém a mesma chave e os clientes continuam funcionando.

[Code]
var
  HostPage: TInputQueryWizardPage;

procedure InitializeWizard;
begin
  HostPage := CreateInputQueryPage(wpSelectDir,
    'Endereço do servidor',
    'Como os clientes vão encontrar este computador pela internet?',
    'Informe o IP público fixo ou o endereço DNS de Lages (ex.: lages.ssacomercio.com.br).'#13#10 +
    'Sem IP fixo, use um DNS dinâmico configurado no roteador.');
  HostPage.Add('IP público ou DNS:', False);
  HostPage.Values[0] := GetPreviousData('PublicHost', '');
end;

procedure RegisterPreviousData(PreviousDataKey: Integer);
begin
  SetPreviousData(PreviousDataKey, 'PublicHost', HostPage.Values[0]);
end;

function NextButtonClick(CurPageID: Integer): Boolean;
var
  H: String;
begin
  Result := True;
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
end;

procedure CurStepChanged(CurStep: TSetupStep);
var
  Params: String;
  Code: Integer;
begin
  if CurStep = ssPostInstall then
  begin
    WizardForm.StatusLabel.Caption := 'Configurando firewall e iniciando o servidor...';
    Params := '-NoProfile -ExecutionPolicy Bypass -File "' + ExpandConstant('{app}\tools\configure.ps1') +
              '" -Mode install -InstallDir "' + ExpandConstant('{app}') + '" -PublicHost "' + HostPage.Values[0] + '"';
    if not Exec(ExpandConstant('{sys}\WindowsPowerShell\v1.0\powershell.exe'), Params, '', SW_HIDE, ewWaitUntilTerminated, Code) or (Code <> 0) then
      MsgBox('A configuração do servidor falhou (código ' + IntToStr(Code) + ').'#13#10 +
             'Detalhes em: ' + ExpandConstant('{app}\instalacao.log'), mbError, MB_OK);
  end;
end;
