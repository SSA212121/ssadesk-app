<#
SSAdesk: configuração pós-instalação (chamado pelo instalador, já como Administrador).
Cada instalação é completa e igual em todos os computadores:
  - acessa outros computadores e pode ser acessada;
  - conexão DIRETA por IP (IPv4 e IPv6), porta TCP 21118, sem servidor central, VPS ou terceiros;
  - acesso desassistido só com senha permanente.
O motor de acesso remoto é o SSAdesk.exe na raiz da instalação (compilado do código do RustDesk, com a
marca SSAdesk), registrado como serviço "SSAdesk". Nenhum RustDesk de terceiros é instalado.
Um hbbs local (só 127.0.0.1, portas 21125-21128, bloqueadas no firewall) serve apenas para o motor
ficar "pronto" sem tentar servidores públicos.

  -Mode install   : cria o serviço do motor, configura e grava código + endereços
  -Mode uninstall : remove tudo (serviço, tarefas, firewall); mantém dados\ (chave local)
#>
param(
    [Parameter(Mandatory = $true)][ValidateSet("install", "uninstall")][string]$Mode,
    [Parameter(Mandatory = $true)][string]$InstallDir,
    [string]$PasswordFile = ""
)
$ErrorActionPreference = "Stop"
# Mensagens com acentos corretos quando lidas pelo instalador
[Console]::OutputEncoding = [Text.Encoding]::UTF8; $OutputEncoding = [Text.Encoding]::UTF8
New-Item -ItemType Directory -Force $InstallDir | Out-Null
Start-Transcript -Path (Join-Path $InstallDir "instalacao.log") -Append | Out-Null

$Port      = 21118
$LocalPort = 21126   # hbbs local (usa 21125, 21126, 21128)
$taskName  = "SSAdesk-local"
$fwName    = "SSAdesk conexao direta TCP $Port"
$oldTasks  = "SSAdesk-hbbs", "SSAdesk-hbbr", $taskName, "SSAdesk-rede", "SSAdesk-p2p"
$oldFw     = "SSAdesk TCP 21115-21119", "SSAdesk UDP 21116", $fwName, "SSAdesk bloqueio componente local", "SSAdesk tunel P2P", "SSAdesk chamada P2P"

# Limpa estado anterior (inclusive da versão antiga com servidor de Lages)
foreach ($t in $oldTasks) {
    if (Get-ScheduledTask -TaskName $t -ErrorAction SilentlyContinue) {
        Stop-ScheduledTask -TaskName $t -ErrorAction SilentlyContinue
        Unregister-ScheduledTask -TaskName $t -Confirm:$false
    }
}
Get-Process hbbs, hbbr -ErrorAction SilentlyContinue | Stop-Process -Force
Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object { $_.Name -in 'node.exe', 'SSAdeskApp.exe', 'SSAdesk.exe' -and $_.ExecutablePath -like "$InstallDir*" -and $_.CommandLine -match 'hypertele' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
foreach ($f in $oldFw) { Get-NetFirewallRule -DisplayName $f -ErrorAction SilentlyContinue | Remove-NetFirewallRule }

$motor = Join-Path $InstallDir "SSAdesk.exe"
function Remover-Motor {
    # Serviço do motor próprio + RustDesk de versões antigas do SSAdesk (se houver)
    foreach ($s in "SSAdesk", "RustDesk") {
        if (Get-Service $s -ErrorAction SilentlyContinue) { sc.exe stop $s | Out-Null; Start-Sleep 2; sc.exe delete $s | Out-Null }
    }
    Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object { $_.Name -eq 'SSAdesk.exe' -and $_.ExecutablePath -eq $motor } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
    $velho = Get-ChildItem "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall" -ErrorAction SilentlyContinue | Get-ItemProperty | Where-Object { $_.DisplayName -eq "RustDesk" -and $_.PSChildName -like "{*}" } | Select-Object -First 1
    if ($velho) { Start-Process msiexec.exe -ArgumentList "/x $($velho.PSChildName) /qn /norestart" -Wait }
    if (Test-Path "HKLM:\Software\SSAdesk") { Remove-Item "HKLM:\Software\SSAdesk" -Recurse -Force -ErrorAction SilentlyContinue }
}

if ($Mode -eq "uninstall") {
    & (Join-Path $InstallDir "tools\network.ps1") -InstallDir $InstallDir -Remove
    Remover-Motor
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
New-NetFirewallRule -DisplayName "SSAdesk bloqueio componente local" -Direction Inbound -Action Block -Program $hbbs | Out-Null

Write-Host "ETAPA acesso"
# 2. Motor SSAdesk como serviço do Windows (acesso mesmo sem ninguém logado, tela de login e UAC)
Remover-Motor
if (-not (Test-Path $motor)) { throw "Motor SSAdesk.exe não encontrado em $InstallDir." }
# Onde o motor está instalado (chave própria dele; sem isso ele não aceita configuração por linha de comando)
New-Item "HKLM:\Software\SSAdesk\InstallState\SSAdesk" -Force | Out-Null
Set-ItemProperty "HKLM:\Software\SSAdesk\InstallState\SSAdesk" -Name InstallLocation -Value $InstallDir
$exe = $motor
sc.exe create SSAdesk binPath= "`"$motor`" --service" start= auto DisplayName= "SSAdesk" | Out-Null
sc.exe description SSAdesk "Acesso remoto SSAdesk (motor)" | Out-Null
sc.exe failure SSAdesk reset= 60 actions= restart/5000/restart/5000/restart/10000 | Out-Null
sc.exe start SSAdesk | Out-Null
for ($i = 0; $i -lt 30 -and (Get-Service SSAdesk -ErrorAction SilentlyContinue).Status -ne 'Running'; $i++) { Start-Sleep 1 }
Start-Sleep 3
function Set-Motor([string[]]$a) { & $exe @a | Out-Null }

# 3. Nunca usar servidores públicos: aponta para o componente local
Set-Motor "--option", "custom-rendezvous-server", "127.0.0.1:$LocalPort"
Set-Motor "--option", "relay-server", "127.0.0.1"
Set-Motor "--option", "key", $key
Set-Motor "--option", "api-server", "http://127.0.0.1"
# 4. Conexão direta por IP (IPv4 e IPv6)
Set-Motor "--option", "direct-server", "Y"
Set-Motor "--option", "direct-access-port", "$Port"
Set-Motor "--option", "enable-lan-discovery", "Y"
# 5. Acesso desassistido SOMENTE com senha permanente
Set-Motor "--option", "verification-method", "use-permanent-password"
Set-Motor "--option", "approve-mode", "password"
# Copiar e colar arquivos (Ctrl+C / Ctrl+V) entre os computadores; sem ícone extra do motor (o app já tem o seu)
Set-Motor "--option", "enable-file-copy-paste", "Y"
Set-Motor "--option", "hide-tray", "Y"
# Sem a janelinha de conexão do motor no computador acessado (o SSAdesk já mostra a sua barrinha).
# O motor só permite isso com acesso exclusivo por senha fixa, que é o nosso caso.
Set-Motor "--option", "allow-hide-cm", "Y"
Set-Motor "--password", $password
$password = $null

New-NetFirewallRule -DisplayName $fwName -Direction Inbound -Action Allow -Protocol TCP -LocalPort $Port -Program $exe | Out-Null
Restart-Service SSAdesk -ErrorAction SilentlyContinue

# 6. Código único + endereços para conectar
$id = ""
for ($i = 0; $i -lt 30 -and -not $id; $i++) {
    $id = ((& $exe --get-id | Out-String) -replace '\D', '')
    if (-not $id) { Start-Sleep 1 }
}
$fmt = ($id -replace '(\d{3})(?=\d)', '$1 ').Trim()
$fmt | Set-Content -Path (Join-Path $InstallDir "codigo.txt") -Encoding ASCII

Write-Host "ETAPA tunel"
# 6b. Túnel P2P (Hyperswarm/HyperDHT): acesso pela internet mesmo com CGNAT, sem servidor e sem roteador.
#     A porta 21118 local é publicada na rede P2P com uma chave fixa deste computador.
#     Quem tem a chave ainda precisa da senha permanente para entrar.
# O túnel roda no motor do próprio app (SSAdesk.exe no modo Node): nada de Node.js separado
$node    = Join-Path $InstallDir "app\SSAdeskApp.exe"
$mods    = Join-Path $InstallDir "app\resources\app\node_modules"
$htServer = Join-Path $mods "hypertele\server.js"
$p2pCfg  = Join-Path $data "p2p.json"
if (-not (Test-Path $p2pCfg)) {
    $b = New-Object byte[] 32; [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b)
    @{ seed = (-join ($b | ForEach-Object { $_.ToString("x2") })) } | ConvertTo-Json | Set-Content $p2pCfg -Encoding ASCII
}
$p2pLog = Join-Path $data "p2p.log"
Remove-Item $p2pLog -ErrorAction SilentlyContinue
$a = New-ScheduledTaskAction -Execute "$env:SystemRoot\System32\cmd.exe" -Argument "/c `"set ELECTRON_RUN_AS_NODE=1&& `"$node`" `"$htServer`" -l $Port --address 127.0.0.1 -c `"$p2pCfg`" > `"$p2pLog`" 2>&1`"" -WorkingDirectory $data
Register-ScheduledTask -TaskName "SSAdesk-p2p" -Action $a -Trigger (New-ScheduledTaskTrigger -AtStartup) -Settings $settings -Principal $principal -Force | Out-Null
Start-ScheduledTask -TaskName "SSAdesk-p2p"
# Chamada de vídeo/chat: o app SSAdesk usa a mesma rede P2P (sem pedir permissão ao usuário)
New-NetFirewallRule -DisplayName "SSAdesk chamada P2P" -Direction Inbound -Action Allow -Program (Join-Path $InstallDir "app\SSAdeskApp.exe") | Out-Null
# Chave de internet = chave pública derivada da semente (mesma conta do hypertele-server):
# calculada na hora, sem esperar o túnel responder pela rede.
$seed = (Get-Content $p2pCfg -Raw | ConvertFrom-Json).seed
$dhtMod = Join-Path $mods "hypertele\node_modules\hyperdht"
if (-not (Test-Path $dhtMod)) { $dhtMod = Join-Path $mods "hyperdht" }
$keyOut = Join-Path $data "chave.tmp"
$env:ELECTRON_RUN_AS_NODE = "1"
Start-Process -Wait -WindowStyle Hidden $node -ArgumentList "`"$(Join-Path $InstallDir 'tools\chave.js')`"", "`"$dhtMod`"", $seed, "`"$keyOut`""
Remove-Item Env:ELECTRON_RUN_AS_NODE
$p2pKey = if (Test-Path $keyOut) { (Get-Content $keyOut -Raw).Trim() } else { "" }
Remove-Item $keyOut -ErrorAction SilentlyContinue
if ($p2pKey -notmatch "^[0-9a-f]{64}$") { $p2pKey = "" }
if ($p2pKey) {
    $p2pKey | Set-Content -Path (Join-Path $InstallDir "chave-internet.txt") -Encoding ASCII
} else {
    # Não trava a instalação: o túnel continua tentando sozinho e a chave é gravada
    # pelo diagnóstico de rede (tarefa SSAdesk-rede) assim que ele responder.
    Write-Warning "O túnel P2P ainda não respondeu; a chave de internet aparece sozinha quando ele subir."
}

Write-Host "ETAPA rede"
# 7. Diagnóstico e configuração automática de rede (UPnP, IPv6, CGNAT), refeito a cada boot e a cada hora
$net = Join-Path $InstallDir "tools\network.ps1"
$a = New-ScheduledTaskAction -Execute "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe" -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$net`" -InstallDir `"$InstallDir`""
$trig = @((New-ScheduledTaskTrigger -AtStartup), (New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Minutes 15)))
Register-ScheduledTask -TaskName "SSAdesk-rede" -Action $a -Trigger $trig -Settings (New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable) -Principal $principal -Force | Out-Null
# O diagnóstico (consulta de IP, UPnP, rota) roda em segundo plano: a instalação não espera por ele
Start-ScheduledTask -TaskName "SSAdesk-rede"
Stop-Transcript | Out-Null