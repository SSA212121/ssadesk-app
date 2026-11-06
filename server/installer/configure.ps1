<#
SSADesk Servidor: configuração pós-instalação (chamado pelo instalador, já como Administrador).
  -Mode install   : firewall + tarefas na inicialização + inicia o servidor + grava CHAVE-PUBLICA.txt
  -Mode uninstall : para o servidor e remove tarefas e regras de firewall (mantém a pasta data\ com as chaves)
Não reinicia o Windows nem mexe em nenhum outro programa (InfoArte etc.).
#>
param(
    [Parameter(Mandatory = $true)][ValidateSet("install", "uninstall")][string]$Mode,
    [Parameter(Mandatory = $true)][string]$InstallDir,
    [string]$PublicHost = ""
)
$ErrorActionPreference = "Stop"
$log = Join-Path $InstallDir "instalacao.log"
Start-Transcript -Path $log -Append | Out-Null

$taskNames = "SSADesk-hbbs", "SSADesk-hbbr"
$fwNames   = "SSADesk TCP 21115-21119", "SSADesk UDP 21116"

# Limpa estado anterior (reinstalação/atualização ou desinstalação)
foreach ($t in $taskNames) {
    if (Get-ScheduledTask -TaskName $t -ErrorAction SilentlyContinue) {
        Stop-ScheduledTask -TaskName $t -ErrorAction SilentlyContinue
        Unregister-ScheduledTask -TaskName $t -Confirm:$false
    }
}
Get-Process hbbs, hbbr -ErrorAction SilentlyContinue | Where-Object { $_.Path -like "$InstallDir*" } | Stop-Process -Force
foreach ($f in $fwNames) { Get-NetFirewallRule -DisplayName $f -ErrorAction SilentlyContinue | Remove-NetFirewallRule }

if ($Mode -eq "uninstall") { Stop-Transcript | Out-Null; exit 0 }

if ([string]::IsNullOrWhiteSpace($PublicHost)) { throw "Endereço público de Lages não informado." }
$data = Join-Path $InstallDir "data"
New-Item -ItemType Directory -Force $data | Out-Null
# Pasta de dados (chave privada) só para Administradores e SYSTEM
icacls $data /inheritance:r /grant:r "*S-1-5-32-544:(OI)(CI)F" "*S-1-5-18:(OI)(CI)F" | Out-Null

# Firewall
New-NetFirewallRule -DisplayName $fwNames[0] -Direction Inbound -Action Allow -Protocol TCP -LocalPort "21115-21119" | Out-Null
New-NetFirewallRule -DisplayName $fwNames[1] -Direction Inbound -Action Allow -Protocol UDP -LocalPort 21116 | Out-Null

# Tarefas: sobem com o Windows (sem ninguém logado), reiniciam sozinhas em falha. Chave obrigatória (-k _).
$settings  = New-ScheduledTaskSettingsSet -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit ([TimeSpan]::Zero) -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
$principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
$trigger   = New-ScheduledTaskTrigger -AtStartup
$taskArgs = @{ "SSADesk-hbbr" = "-k _"; "SSADesk-hbbs" = "-r ${PublicHost}:21117 -k _" }
foreach ($t in "SSADesk-hbbr", "SSADesk-hbbs") {
    $exe = Join-Path $InstallDir "bin\$($t -replace 'SSADesk-', '').exe"
    $action = New-ScheduledTaskAction -Execute $exe -Argument $taskArgs[$t] -WorkingDirectory $data
    Register-ScheduledTask -TaskName $t -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Force | Out-Null
    Start-ScheduledTask -TaskName $t
}

# Chave pública -> arquivo legível para configurar os clientes
$pub = Join-Path $data "id_ed25519.pub"
for ($i = 0; $i -lt 30 -and -not (Test-Path $pub); $i++) { Start-Sleep 1 }
if (-not (Test-Path $pub)) { throw "O servidor não gerou a chave. Veja $log" }
$key = (Get-Content $pub -Raw).Trim()
@"
SSADesk — dados para configurar os clientes (Windows de Lages e Mac de Itajaí)

  Servidor ID   : $PublicHost
  Servidor Relay: $PublicHost
  Chave         : $key

Guarde no cofre de senhas da empresa. Esta é a chave PÚBLICA (pode ir nos clientes).
NUNCA copie o arquivo data\id_ed25519 (sem .pub): é a chave privada do servidor.

Lembrete: no roteador de Lages, redirecione TCP 21115-21119 e UDP 21116 para este computador.
"@ | Set-Content -Path (Join-Path $InstallDir "CHAVE-PUBLICA.txt") -Encoding UTF8

Stop-Transcript | Out-Null
