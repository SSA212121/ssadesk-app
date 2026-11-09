; SSAdesk-Setup.exe: apenas o "envelope" do instalador.
; Não mostra nenhuma tela do Inno Setup: pede permissão de administrador, extrai o pacote para uma
; pasta temporária e abre a tela de instalação do próprio SSAdesk (app\SSAdesk.exe --instalar),
; que segue o visual do app (DESIGN_GUIDELINES.md) e faz uma instalação sempre limpa.
; Gerado por build.ps1 (que monta a pasta "stage" com os binários oficiais conferidos).

#define AppName "SSAdesk"
#define AppVersion "3.0.0"

[Setup]
AppId={{6B1F4C2E-8D3A-4E7B-9A51-5A1D35C0A002}
AppName={#AppName}
AppVersion={#AppVersion}
AppPublisher=SSA Comércio
VersionInfoDescription=Instalador do SSAdesk
VersionInfoProductName=SSAdesk
DefaultDirName={tmp}\ssadesk-setup
CreateAppDir=no
Uninstallable=no
PrivilegesRequired=admin
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
SetupIconFile=ssadesk.ico
OutputDir=..\..\dist
OutputBaseFilename=SSAdesk-Setup
Compression=lzma2/fast
SolidCompression=no
DisableWelcomePage=yes
DisableReadyPage=yes
DisableFinishedPage=yes

[Languages]
Name: "ptbr"; MessagesFile: "compiler:Languages\BrazilianPortuguese.isl"

[Files]
; 1º a janela leve das telas (~2 MB, abre em ~0,5 s); o resto é extraído em paralelo
Source: "ui\*"; DestDir: "{tmp}\ui"; Flags: dontcopy recursesubdirs createallsubdirs
Source: "stage\app\*"; DestDir: "{tmp}\pkg\app"; Flags: dontcopy recursesubdirs createallsubdirs
Source: "stage\*"; Excludes: "\app"; DestDir: "{tmp}\pkg"; Flags: dontcopy recursesubdirs createallsubdirs

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
  R := TaskDialogMsgBox('O Windows vai bloquear o SSAdesk',
    'Este computador está com o "Controle Inteligente de Aplicativos" ligado. Ele só permite programas com assinatura digital ' +
    'de editores conhecidos, e esta versão do SSAdesk ainda não tem essa assinatura.' + #13#10#13#10 +
    'Para instalar agora, desligue essa proteção na tela que vai abrir e execute o instalador de novo.' + #13#10#13#10 +
    'Atenção: depois de desligado, o Windows só permite religar reinstalando o sistema. ' +
    'Se preferir não desligar, aguarde a versão assinada do SSAdesk.',
    mbConfirmation, MB_YESNO, ['Abrir a configuração'#13#10'Você mesmo desliga e depois executa o instalador de novo', 'Agora não'#13#10'Cancela a instalação, nada é alterado'], 0);
  if R = IDYES then
    if not ShellExec('open', 'windowsdefender://smartapp', '', '', SW_SHOWNORMAL, ewNoWait, Code) then
      ShellExec('open', 'windowsdefender://appbrowser', '', '', SW_SHOWNORMAL, ewNoWait, Code);
end;

function InitializeSetup(): Boolean;
var
  Code, Parado: Integer;
  Vivo, Agora: AnsiString;
begin
  if ControleInteligenteLigado() then
  begin
    Result := OrientarControleInteligente();
    Exit;
  end;
  { 1. Telas de instalação na janela leve (WebView2 do Windows): aparecem quase na hora }
  ForceDirectories(ExpandConstant('{tmp}\pkg'));
  ExtractTemporaryFiles('{tmp}\ui\*');
  Exec(ExpandConstant('{tmp}\ui\SetupUI.exe'), '"' + ExpandConstant('{tmp}\ui') + '" "' + ExpandConstant('{tmp}\pkg') + '" "{#AppVersion}"',
       ExpandConstant('{tmp}\ui'), SW_SHOW, ewNoWait, Code);
  { 2. O pacote pesado é extraído enquanto o usuário passa pelas telas }
  ExtractTemporaryFiles('{tmp}\pkg\app\*');
  ExtractTemporaryFiles('{tmp}\pkg\bin\*');
  ExtractTemporaryFiles('{tmp}\pkg\tools\*');
  ExtractTemporaryFiles('{tmp}\pkg\motor\*');
  ExtractTemporaryFiles('{tmp}\pkg\ssadesk.*');
  ExtractTemporaryFiles('{tmp}\pkg\LICENSE*');
  SaveStringToFile(ExpandConstant('{tmp}\pkg\pronto.flag'), '1', False);
  { Plano B: sem WebView2 (Windows antigo), as telas abrem pelo próprio app }
  if FileExists(ExpandConstant('{tmp}\pkg\ui-falhou.flag')) then
  begin
    DeleteFile(ExpandConstant('{tmp}\pkg\vivo.flag'));
    Exec(ExpandConstant('{tmp}\pkg\app\SSAdeskApp.exe'), '--instalar --payload="' + ExpandConstant('{tmp}\pkg') + '"',
         ExpandConstant('{tmp}\pkg'), SW_SHOW, ewNoWait, Code);
  end;  { 3. Mantém a pasta temporária enquanto a tela de instalação estiver aberta (sinal de vida a cada 2 s) }
  Vivo := ''; Parado := 0;
  { sem sinal: espera até 2 min o app abrir; depois do 1º sinal, 20 s sem sinal = app fechado }
  while not FileExists(ExpandConstant('{tmp}\pkg\fim.flag')) and (((Vivo = '') and (Parado < 240)) or ((Vivo <> '') and (Parado < 40))) do
  begin
    Sleep(500);
    if LoadStringFromFile(ExpandConstant('{tmp}\pkg\vivo.flag'), Agora) and (Agora <> Vivo) then
    begin Vivo := Agora; Parado := 0; end
    else Parado := Parado + 1;
  end;
  Result := False; { encerra o envelope (a pasta temporária é apagada ao sair) }
end;
