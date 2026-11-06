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
{ Controle Inteligente de Aplicativos (Smart App Control) do Windows 11:
  0 = desligado, 1 = ligado (bloqueia programas sem assinatura digital), 2 = em avaliação (não bloqueia).
  O instalador NUNCA desliga sozinho: só explica, pede permissão e abre a tela certa para o usuário decidir. }
function ControleInteligenteLigado(): Boolean;
var
  Estado: Cardinal;
begin
  Result := RegQueryDWordValue(HKLM, 'SYSTEM\CurrentControlSet\Control\CI\Policy', 'VerifiedAndReputablePolicyState', Estado) and (Estado = 1);
end;

function OrientarControleInteligente(): Boolean;
var
  R, Code: Integer;
begin
  Result := False;
  R := TaskDialogMsgBox('O Windows vai bloquear o SSADesk',
    'Este computador está com o "Controle Inteligente de Aplicativos" ligado. Ele só permite programas com assinatura digital ' +
    'de editores conhecidos, e esta versão do SSADesk ainda não tem essa assinatura.' + #13#10#13#10 +
    'Para instalar agora, desligue essa proteção na tela que vai abrir e execute o instalador de novo.' + #13#10#13#10 +
    'Atenção: depois de desligado, o Windows só permite religar reinstalando o sistema. ' +
    'Se preferir não desligar, aguarde a versão assinada do SSADesk.',
    mbConfirmation, MB_YESNO, ['Abrir a configuração'#13#10'Você mesmo desliga e depois executa o instalador de novo', 'Agora não'#13#10'Cancela a instalação, nada é alterado'], 0);
  if R = IDYES then
    if not ShellExec('open', 'windowsdefender://smartapp', '', '', SW_SHOWNORMAL, ewNoWait, Code) then
      ShellExec('open', 'windowsdefender://appbrowser', '', '', SW_SHOWNORMAL, ewNoWait, Code);
end;

function InitializeSetup(): Boolean;
var
  Code: Integer;
begin
  if ControleInteligenteLigado() then
  begin
    Result := OrientarControleInteligente();
    Exit;
  end;
  { Extrai o pacote e abre a tela de instalação do SSADesk; o Inno não mostra nada }
  ExtractTemporaryFiles('{tmp}\pkg\*');
  Exec(ExpandConstant('{tmp}\pkg\app\SSADesk.exe'), '--instalar --payload="' + ExpandConstant('{tmp}\pkg') + '"',
       ExpandConstant('{tmp}\pkg'), SW_SHOW, ewWaitUntilTerminated, Code);
  Result := False; { encerra o envelope (a pasta temporária é apagada ao sair) }
end;
