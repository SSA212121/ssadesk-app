<#
SSADesk: mantém um túnel P2P até outro computador enquanto o SSADesk estiver usando.
Chamado pelo painel, em segundo plano:  tunel.ps1 -Key <chave> -Port <porta-local>
Abre 127.0.0.1:<porta> -> rede P2P (Hyperswarm) -> porta 21118 do outro computador.
Fecha sozinho quando não houver mais conexão passando por ele.
#>
param([Parameter(Mandatory = $true)][string]$Key, [Parameter(Mandatory = $true)][int]$Port)
$app  = Split-Path $PSScriptRoot -Parent
$node = Join-Path $app "p2p\node.exe"
$cli  = Join-Path $app "p2p\node_modules\hypertele\client.js"
$tun = Start-Process $node -ArgumentList "`"$cli`"", "-p", $Port, "-s", $Key -WindowStyle Hidden -PassThru
try {
    $start = Get-Date
    do {
        Start-Sleep 3
        $conn = Get-NetTCPConnection -RemotePort $Port -State Established -ErrorAction SilentlyContinue
        # 3 min de tolerância para abrir a janela e digitar a senha
        $alive = $conn -or ((Get-Date) - $start).TotalSeconds -lt 180
    } while ($alive -and -not $tun.HasExited)
} finally {
    if (-not $tun.HasExited) { Stop-Process -Id $tun.Id -Force -ErrorAction SilentlyContinue }
}
