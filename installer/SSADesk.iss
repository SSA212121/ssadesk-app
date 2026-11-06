; SSADesk-Setup.exe: apenas o "envelope" do instalador.
; Não mostra nenhuma tela do Inno Setup: pede permissão de administrador, extrai o pacote para uma
; pasta temporária e abre a tela de instalação do próprio SSADesk (app\SSADesk.exe --instalar),
; que segue o visual do app (DESIGN_GUIDELINES.md) e faz uma instalação sempre limpa.
; Gerado por build.ps1 (que monta a pasta "stage" com os binários oficiais conferidos).

#define AppName "SSADesk"
#define AppVersion "3.0.0"

[Setup]
AppId={{6B1F4C2E-8D3A-4E7B-9A51-5A1D35C0A002}
AppName={#AppName}
AppVersion={#AppVersion}
AppPublisher=SSA Comércio
VersionInfoDescription=Instalador do SSADesk
VersionInfoProductName=SSADesk
DefaultDirName={tmp}\ssadesk-setup
CreateAppDir=no
Uninstallable=no
PrivilegesRequired=admin
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
SetupIconFile=ssadesk.ico
OutputDir=..\..\dist
OutputBaseFilename=SSADesk-Setup
Compression=lzma2/fast
SolidCompression=yes
DisableWelcomePage=yes
DisableReadyPage=yes
DisableFinishedPage=yes

[Languages]
Name: "ptbr"; MessagesFile: "compiler:Languages\BrazilianPortuguese.isl"

[Files]
Source: "stage\*"; DestDir: "{tmp}\pkg"; Flags: dontcopy recursesubdirs createallsubdirs

[Code]
function InitializeSetup(): Boolean;
var
  Code: Integer;
begin
  { Extrai o pacote e abre a tela de instalação do SSADesk; o Inno não mostra nada }
  ExtractTemporaryFiles('{tmp}\pkg\*');
  Exec(ExpandConstant('{tmp}\pkg\app\SSADesk.exe'), '--instalar --payload="' + ExpandConstant('{tmp}\pkg') + '"',
       ExpandConstant('{tmp}\pkg'), SW_SHOW, ewWaitUntilTerminated, Code);
  Result := False; { encerra o envelope (a pasta temporária é apagada ao sair) }
end;
