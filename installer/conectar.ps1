<#
SSADesk - Conectar pela internet.
Pede a chave de internet do outro computador, abre o túnel P2P (Hyperswarm) e conecta o SSADesk por ele.
Funciona mesmo quando o outro computador está atrás de CGNAT, sem servidor e sem mexer em roteador.
#>
$ErrorActionPreference = "Stop"
Add-Type -AssemblyName Microsoft.VisualBasic, System.Windows.Forms
$app  = Split-Path $PSScriptRoot -Parent
$node = Join-Path $app "p2p\node.exe"
$cli  = Join-Path $app "p2p\node_modules\hypertele\client.js"
$exe  = (Get-ChildItem (Join-Path $app "RustDesk") -Filter rustdesk.exe -Recurse | Select-Object -First 1).FullName
$last = Join-Path $env:LOCALAPPDATA "SSADesk\ultima-chave.txt"

$prev = if (Test-Path $last) { (Get-Content $last -Raw).Trim() } else { "" }
$key = [Microsoft.VisualBasic.Interaction]::InputBox(
    "Cole a chave de internet do computador que você quer acessar." + [Environment]::NewLine +
    "(ela aparece no arquivo SSADESK-ESTE-COMPUTADOR.txt do outro computador)",
    "SSADesk - Conectar pela internet", $prev)
$key = ($key -replace '\s', '').ToLower()
if (-not $key) { exit 0 }
if ($key -notmatch '^[0-9a-f]{64}$') {
    [System.Windows.Forms.MessageBox]::Show("Chave inválida. Ela tem 64 letras e números (0-9, a-f).", "SSADesk") | Out-Null
    exit 1
}
New-Item -ItemType Directory -Force (Split-Path $last) | Out-Null
$key | Set-Content $last -Encoding ASCII

# Porta local livre para a entrada do túnel
$l = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback, 0); $l.Start(); $port = $l.LocalEndpoint.Port; $l.Stop()

$tun = Start-Process $node -ArgumentList "`"$cli`"", "-p", $port, "-s", $key -WindowStyle Hidden -PassThru
try {
    # Espera o túnel abrir a porta local
    $ok = $false
    for ($i = 0; $i -lt 30 -and -not $ok; $i++) {
        Start-Sleep -Milliseconds 500
        $ok = [bool](Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue)
    }
    if (-not $ok) { throw "Não foi possível abrir o túnel." }
    $rd = Start-Process $exe -ArgumentList "--connect", "127.0.0.1:$port" -PassThru
    # Mantém o túnel aberto enquanto houver conexão passando por ele (ou a janela ainda estiver abrindo)
    $start = Get-Date
    do {
        Start-Sleep 3
        $conn = Get-NetTCPConnection -RemotePort $port -State Established -ErrorAction SilentlyContinue
        $win  = Get-CimInstance Win32_Process -Filter "Name='rustdesk.exe'" | Where-Object { $_.CommandLine -match "127\.0\.0\.1:$port" }
        $alive = $conn -or $win -or ((Get-Date) - $start).TotalSeconds -lt 60
    } while ($alive)
} catch {
    [System.Windows.Forms.MessageBox]::Show("Não foi possível conectar: $($_.Exception.Message)", "SSADesk") | Out-Null
} finally {
    Stop-Process -Id $tun.Id -Force -ErrorAction SilentlyContinue
}
