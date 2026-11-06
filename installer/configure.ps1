<#
SSADesk: configuração pós-instalação (chamado pelo instalador, já como Administrador).
Cada instalação é completa e igual em todos os computadores:
  - acessa outros computadores e pode ser acessada;
  - conexão DIRETA por IP (IPv4 e IPv6), porta TCP 21118, sem servidor central, VPS ou terceiros;
  - acesso desassistido só com senha permanente.
Um hbbs local (só 127.0.0.1, portas 21125-21128, bloqueadas no firewall) serve apenas para o RustDesk
ficar "pronto" sem tentar os servidores públicos do RustDesk.

  -Mode install   : instala o RustDesk oficial (MSI), configura e grava código + endereços
  -Mode uninstall : remove tudo (RustDesk, tarefa, firewall); mantém dados\ (chave local)
#>
param(
    [Parameter(Mandatory = $true)][ValidateSet("install", "uninstall")][string]$Mode,
    [Parameter(Mandatory = $true)][string]$InstallDir,
    [string]$Msi = "",
    [string]$PasswordFile = ""
)
$ErrorActionPreference = "Stop"
New-Item -ItemType Directory -Force $InstallDir | Out-Null
Start-Transcript -Path (Join-Path $InstallDir "instalacao.log") -Append | Out-Null

$Port      = 21118
$LocalPort = 21126   # hbbs local (usa 21125, 21126, 21128)
$taskName  = "SSADesk-local"
$fwName    = "SSADesk conexao direta TCP $Port"
$oldTasks  = "SSADesk-hbbs", "SSADesk-hbbr", $taskName, "SSADesk-rede"
$oldFw     = "SSADesk TCP 21115-21119", "SSADesk UDP 21116", $fwName, "SSADesk bloqueio componente local"

# Limpa estado anterior (inclusive da versão antiga com servidor de Lages)
foreach ($t in $oldTasks) {
    if (Get-ScheduledTask -TaskName $t -ErrorAction SilentlyContinue) {
        Stop-ScheduledTask -TaskName $t -ErrorAction SilentlyContinue
        Unregister-ScheduledTask -TaskName $t -Confirm:$false
    }
}
Get-Process hbbs, hbbr -ErrorAction SilentlyContinue | Stop-Process -Force
foreach ($f in $oldFw) { Get-NetFirewallRule -DisplayName $f -ErrorAction SilentlyContinue | Remove-NetFirewallRule }

function Get-RustDeskProduct {
    Get-ChildItem "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall", "HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall" -ErrorAction SilentlyContinue |
        Get-ItemProperty | Where-Object { $_.DisplayName -eq "RustDesk" -and $_.PSChildName -like "{*}" } | Select-Object -First 1
}

if ($Mode -eq "uninstall") {
    & (Join-Path $InstallDir "tools\network.ps1") -InstallDir $InstallDir -Remove
    $u = Get-RustDeskProduct
    if ($u) { Start-Process msiexec.exe -ArgumentList "/x $($u.PSChildName) /qn /norestart" -Wait }
    Stop-Transcript | Out-Null; exit 0
}

if (-not (Test-Path $PasswordFile)) { throw "Senha não informada." }
$password = (Get-Content $PasswordFile -Raw).Trim()
Remove-Item $PasswordFile -Force
if ($password.Length -lt 8) { throw "Senha permanente precisa ter ao menos 8 caracteres." }

# 1. hbbs local (somente para uso interno da própria máquina)
$data = Join-Path $InstallDir "dados"
New-Item -ItemType Directory -Force $data | Out-Null
icacls $data /inheritance:r /grant:r "*S-1-5-32-544:(OI)(CI)F" "*S-1-5-18:(OI)(CI)F" | Out-Null
$hbbs = Join-Path $InstallDir "bin\hbbs.exe"
$settings  = New-ScheduledTaskSettingsSet -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit ([TimeSpan]::Zero) -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
$principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
$action    = New-ScheduledTaskAction -Execute $hbbs -Argument "-p $LocalPort -k _" -WorkingDirectory $data
Register-ScheduledTask -TaskName $taskName -Action $action -Trigger (New-ScheduledTaskTrigger -AtStartup) -Settings $settings -Principal $principal -Force | Out-Null
Start-ScheduledTask -TaskName $taskName
$pub = Join-Path $data "id_ed25519.pub"
for ($i = 0; $i -lt 30 -and -not (Test-Path $pub); $i++) { Start-Sleep 1 }
if (-not (Test-Path $pub)) { throw "Componente local não iniciou." }
$key = (Get-Content $pub -Raw).Trim()
# Bloqueia de fora o hbbs local (a regra do RustDesk.exe/MSI não cobre o hbbs.exe)
New-NetFirewallRule -DisplayName "SSADesk bloqueio componente local" -Direction Inbound -Action Block -Program $hbbs | Out-Null

# 2. RustDesk oficial (MSI), na pasta escolhida
$p = Start-Process msiexec.exe -ArgumentList "/i `"$Msi`" /qn /norestart INSTALLFOLDER=`"$InstallDir\RustDesk`" CREATESTARTMENUSHORTCUTS=1 CREATEDESKTOPSHORTCUTS=1 /l*v `"$InstallDir\msi.log`"" -Wait -PassThru
if ($p.ExitCode -notin 0, 3010) { throw "Falha no MSI do RustDesk (código $($p.ExitCode)). Veja msi.log." }
$exe = Join-Path $InstallDir "RustDesk\rustdesk.exe"
if (-not (Test-Path $exe)) { $exe = (Get-ChildItem $InstallDir -Recurse -Filter rustdesk.exe | Select-Object -First 1).FullName }
if (-not $exe) { throw "rustdesk.exe não encontrado após a instalação." }
for ($i = 0; $i -lt 30 -and -not (Get-Service RustDesk -ErrorAction SilentlyContinue); $i++) { Start-Sleep 1 }

function Set-RustDesk([string[]]$a) { & $exe @a | Out-Null }

# 3. Nunca usar servidores públicos do RustDesk: aponta para o componente local
Set-RustDesk "--option", "custom-rendezvous-server", "127.0.0.1:$LocalPort"
Set-RustDesk "--option", "relay-server", "127.0.0.1"
Set-RustDesk "--option", "key", $key
Set-RustDesk "--option", "api-server", "http://127.0.0.1"
# 4. Conexão direta por IP (IPv4 e IPv6)
Set-RustDesk "--option", "direct-server", "Y"
Set-RustDesk "--option", "direct-access-port", "$Port"
Set-RustDesk "--option", "enable-lan-discovery", "Y"
# 5. Acesso desassistido SOMENTE com senha permanente
Set-RustDesk "--option", "verification-method", "use-permanent-password"
Set-RustDesk "--option", "approve-mode", "password"
Set-RustDesk "--password", $password
$password = $null

New-NetFirewallRule -DisplayName $fwName -Direction Inbound -Action Allow -Protocol TCP -LocalPort $Port -Program $exe | Out-Null
Restart-Service RustDesk -ErrorAction SilentlyContinue

# 6. Código único + endereços para conectar
$id = ""
for ($i = 0; $i -lt 30 -and -not $id; $i++) {
    $id = ((& $exe --get-id | Out-String) -replace '\D', '')
    if (-not $id) { Start-Sleep 1 }
}
$fmt = ($id -replace '(\d{3})(?=\d)', '$1 ').Trim()
$fmt | Set-Content -Path (Join-Path $InstallDir "codigo.txt") -Encoding ASCII

# 7. Diagnóstico e configuração automática de rede (UPnP, IPv6, CGNAT), refeito a cada boot e a cada hora
$net = Join-Path $InstallDir "tools\network.ps1"
& $net -InstallDir $InstallDir
$a = New-ScheduledTaskAction -Execute "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe" -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$net`" -InstallDir `"$InstallDir`""
$trig = @((New-ScheduledTaskTrigger -AtStartup), (New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Hours 1)))
Register-ScheduledTask -TaskName "SSADesk-rede" -Action $a -Trigger $trig -Settings (New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable) -Principal $principal -Force | Out-Null
Get-Content (Join-Path $InstallDir "SSADESK-ESTE-COMPUTADOR.txt") | Write-Host
Stop-Transcript | Out-Null