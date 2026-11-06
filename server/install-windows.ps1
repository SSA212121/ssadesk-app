<#
SSADesk — instala o servidor RustDesk (hbbs + hbbr) nativo no Windows de Lages, sem Docker.

Executar como Administrador no servidor de Lages:
    powershell -ExecutionPolicy Bypass -File .\install-windows.ps1 -PublicHost <IP-ou-DNS-publico-de-Lages>

O que faz:
  1. Baixa o release oficial rustdesk/rustdesk-server e confere o SHA-256.
  2. Instala em C:\SSADesk\server (dados/chaves em C:\SSADesk\server\data).
  3. Libera as portas no Firewall do Windows.
  4. Cria duas tarefas agendadas (SYSTEM, na inicialização, reinício automático em falha),
     para o servidor subir sozinho depois de queda de energia/reboot, sem ninguém logado.
  5. Mostra a chave pública para configurar nos clientes.
#>
param(
    [Parameter(Mandatory = $true)][string]$PublicHost,
    [string]$InstallDir = "C:\SSADesk\server"
)
$ErrorActionPreference = "Stop"

$Version = "1.1.16"
$Url     = "https://github.com/rustdesk/rustdesk-server/releases/download/$Version/rustdesk-server-windows-x86_64-unsigned.zip"
$Sha256  = "b865a3a62fc8755b45480c508f1c4871c3338590408dda8c58c7e9c373b7adb0"

$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) { throw "Execute este script como Administrador." }

# 1. Download + verificação
$tmp = Join-Path $env:TEMP "ssadesk-server-$Version"
New-Item -ItemType Directory -Force $tmp | Out-Null
$zip = Join-Path $tmp "server.zip"
Write-Host "Baixando rustdesk-server $Version..."
Invoke-WebRequest -Uri $Url -OutFile $zip -UseBasicParsing
$hash = (Get-FileHash $zip -Algorithm SHA256).Hash.ToLower()
if ($hash -ne $Sha256) { throw "SHA-256 não confere ($hash). Download abortado." }

# 2. Instalação
Get-ScheduledTask -TaskName "SSADesk-hbbs","SSADesk-hbbr" -ErrorAction SilentlyContinue | Stop-ScheduledTask
Get-Process hbbs,hbbr -ErrorAction SilentlyContinue | Stop-Process -Force
New-Item -ItemType Directory -Force "$InstallDir\data" | Out-Null
Expand-Archive $zip -DestinationPath $tmp -Force
Get-ChildItem $tmp -Recurse -Include hbbs.exe,hbbr.exe | Copy-Item -Destination $InstallDir -Force
# Restringe a pasta de dados (chave privada) a Administradores e SYSTEM
icacls "$InstallDir\data" /inheritance:r /grant:r "*S-1-5-32-544:(OI)(CI)F" "*S-1-5-18:(OI)(CI)F" | Out-Null

# 3. Firewall
$rules = @(
    @{ Name = "SSADesk TCP 21115-21119"; Protocol = "TCP"; Port = "21115-21119" },
    @{ Name = "SSADesk UDP 21116";       Protocol = "UDP"; Port = "21116" }
)
foreach ($r in $rules) {
    Get-NetFirewallRule -DisplayName $r.Name -ErrorAction SilentlyContinue | Remove-NetFirewallRule
    New-NetFirewallRule -DisplayName $r.Name -Direction Inbound -Action Allow -Protocol $r.Protocol -LocalPort $r.Port | Out-Null
}

# 4. Tarefas na inicialização (chave obrigatória: -k _)
$settings  = New-ScheduledTaskSettingsSet -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit ([TimeSpan]::Zero) -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
$principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
$trigger   = New-ScheduledTaskTrigger -AtStartup
$tasks = @{
    "SSADesk-hbbr" = "-k _"
    "SSADesk-hbbs" = "-r ${PublicHost}:21117 -k _"
}
foreach ($name in $tasks.Keys) {
    $exe = Join-Path $InstallDir (($name -replace "SSADesk-", "") + ".exe")
    $action = New-ScheduledTaskAction -Execute $exe -Argument $tasks[$name] -WorkingDirectory "$InstallDir\data"
    Register-ScheduledTask -TaskName $name -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Force | Out-Null
    Start-ScheduledTask -TaskName $name
}

# 5. Chave pública
$pub = "$InstallDir\data\id_ed25519.pub"
for ($i = 0; $i -lt 20 -and -not (Test-Path $pub); $i++) { Start-Sleep 1 }
if (-not (Test-Path $pub)) { throw "Chave pública não foi gerada. Verifique se hbbs está rodando." }
Write-Host ""
Write-Host "Servidor SSADesk ativo."
Write-Host "  Servidor ID/Relay : $PublicHost"
Write-Host "  Chave pública     : $(Get-Content $pub -Raw)"
Write-Host ""
Write-Host "Guarde a chave pública no cofre de senhas. NUNCA copie o arquivo id_ed25519 (sem .pub)."
Write-Host "No roteador de Lages: redirecione TCP 21115-21119 e UDP 21116 para este servidor."
