<#
SSADesk: diagnóstico e configuração automática de rede (sem servidor central).
Executado na instalação e depois periodicamente (tarefa SSADesk-rede, como SYSTEM), porque IP local,
IPv6 e mapeamentos UPnP podem mudar.

O que faz, sem pedir nada ao usuário:
  1. Descobre IPv4 local, IPv6 público (global) e gateway.
  2. Tenta abrir a porta 21118 no roteador sozinho via UPnP (sem ninguém mexer no roteador).
  3. Descobre o IP público e detecta CGNAT (quando o provedor divide o IP e nada local resolve).
  4. Grava o resultado em linguagem simples em SSADESK-ESTE-COMPUTADOR.txt e em rede.json.

  -Remove : apaga o mapeamento UPnP (desinstalação)
#>
param(
    [Parameter(Mandatory = $true)][string]$InstallDir,
    [switch]$Remove
)
$ErrorActionPreference = "Continue"
$Port = 21118
$Desc = "SSADesk"

function Get-UPnP {
    try {
        $c = (New-Object -ComObject HNetCfg.NATUPnP).StaticPortMappingCollection
        if ($c) { return $c }
    } catch {}
    return $null
}

if ($Remove) {
    $c = Get-UPnP
    if ($c) { try { $c.Remove($Port, "TCP") } catch {} }
    exit 0
}

function Test-Cgnat([string]$ip) {
    if (-not $ip) { return $false }
    $o = $ip.Split('.') | ForEach-Object { [int]$_ }
    # 100.64.0.0/10 (CGNAT) ou faixas privadas no lado WAN = IP compartilhado pelo provedor
    return ($o[0] -eq 100 -and $o[1] -ge 64 -and $o[1] -le 127) -or $o[0] -eq 10 -or
           ($o[0] -eq 172 -and $o[1] -ge 16 -and $o[1] -le 31) -or ($o[0] -eq 192 -and $o[1] -eq 168)
}

# 1. Endereços locais
$route = Get-NetRoute -DestinationPrefix 0.0.0.0/0 -ErrorAction SilentlyContinue | Sort-Object RouteMetric | Select-Object -First 1
$gateway = $route.NextHop
$ifIndex = $route.InterfaceIndex
$v4 = (Get-NetIPAddress -AddressFamily IPv4 -InterfaceIndex $ifIndex -ErrorAction SilentlyContinue |
       Where-Object { $_.AddressState -eq "Preferred" -and $_.IPAddress -notlike "169.254*" } | Select-Object -First 1).IPAddress
$v6 = @(Get-NetIPAddress -AddressFamily IPv6 -ErrorAction SilentlyContinue | Where-Object {
        $_.AddressState -eq "Preferred" -and $_.IPAddress -match '^[23]' -and $_.InterfaceAlias -notmatch "Loopback|vEthernet|Teredo|isatap"
      } | Sort-Object { $_.SuffixOrigin -eq "Random" } | ForEach-Object IPAddress)

# 2. UPnP: abre a porta no roteador automaticamente
$upnp = "indisponivel"; $wan = $null
$c = Get-UPnP
if ($c -and $v4) {
    try {
        try { $c.Remove($Port, "TCP") } catch {}
        $null = $c.Add($Port, "TCP", $Port, $v4, $true, $Desc)
        $m = $c | Where-Object { $_.ExternalPort -eq $Port -and $_.Protocol -eq "TCP" } | Select-Object -First 1
        if ($m) { $upnp = "ok"; $wan = $m.ExternalIPAddress } else { $upnp = "recusado" }
    } catch { $upnp = "recusado" }
}

# 3. IP público (consulta simples, só para diagnóstico) e CGNAT
$public = $null
try { $public = (Invoke-RestMethod "https://api.ipify.org" -TimeoutSec 6).ToString().Trim() } catch {}
$cgnat = $false
if ($wan) { $cgnat = (Test-Cgnat $wan) -or ($public -and $wan -ne $public) }
elseif ($gateway) {
    # Sem UPnP: olha o salto logo depois do roteador; se for 100.64/10 ou privado, é CGNAT
    $hops = @((Test-NetConnection 8.8.8.8 -TraceRoute -Hops 3 -WarningAction SilentlyContinue -ErrorAction SilentlyContinue).TraceRoute)
    if ($hops.Count -ge 2) { $cgnat = Test-Cgnat $hops[1] }
}

# 4. Resultado
$internetV6 = $v6.Count -gt 0
$internetV4 = ($upnp -eq "ok") -and -not $cgnat -and $public
$idFile = Join-Path $InstallDir "codigo.txt"
$id = if (Test-Path $idFile) { (Get-Content $idFile -Raw).Trim() } else { "" }

$L = @("SSADesk — este computador", "", "Código: $id", "", "COMO CONECTAR A ESTE COMPUTADOR (digite no SSADesk + a senha permanente):", "")
if ($v4) { $L += "  Na mesma rede ......... $v4" }
if ($internetV6) { $L += "  Pela internet (IPv6) .. [$($v6[0])]" }
if ($internetV4) { $L += "  Pela internet (IPv4) .. $public" }
$keyFile = Join-Path $InstallDir "chave-internet.txt"
$p2pKey = if (Test-Path $keyFile) { (Get-Content $keyFile -Raw).Trim() } else { "" }
if ($p2pKey) {
    $L += ""
    $L += "  Pela internet, QUALQUER rede (inclusive CGNAT), use o atalho 'SSADesk - Conectar pela internet' com a chave:"
    $L += "  Chave de internet: $p2pKey"
}
$L += ""
$L += "DIAGNÓSTICO AUTOMÁTICO DA REDE ($(Get-Date -Format 'dd/MM/yyyy HH:mm')):"
$L += "  Rede local ............ " + $(if ($v4) { "OK" } else { "sem rede" })
$L += "  IPv6 público .......... " + $(if ($internetV6) { "OK (acesso pela internet sem configurar nada)" } else { "o provedor não fornece" })
$L += "  Porta aberta no roteador (UPnP): " + $(switch ($upnp) { "ok" { "OK, aberta automaticamente" } "recusado" { "o roteador recusou" } default { "UPnP desligado no roteador" } })
$L += "  IP compartilhado (CGNAT): " + $(if ($cgnat) { "SIM, o provedor divide o IP com outros clientes" } else { "não" })
$L += ""
if ($internetV4 -or $internetV6) {
    $L += "RESULTADO: este computador pode ser acessado pela internet."
} elseif ($p2pKey) {
    $L += "RESULTADO: este computador pode ser acessado pela internet pelo túnel P2P (chave de internet acima)."
    if ($cgnat) { $L += "Motivo: o provedor usa IP compartilhado (CGNAT); o túnel P2P atravessa isso sozinho." }
} else {
    $L += "RESULTADO: este computador pode ser acessado na rede local."
    $L += "Pela internet, esta rede não permite conexão de fora."
    if ($cgnat) { $L += "Motivo: o provedor usa IP compartilhado (CGNAT). Só o provedor resolve: peça 'IP público válido' ou 'ativar IPv6'." }
    elseif ($upnp -ne "ok") { $L += "Motivo: o roteador não permite abrir a porta sozinho (UPnP desligado). Ativar o UPnP no roteador resolve." }
    $L += "Este computador continua podendo ACESSAR outros normalmente."
}
$L += ""
$L += "Porta: $Port (TCP). Diagnóstico refeito sozinho a cada inicialização e a cada hora."
$L | Set-Content -Path (Join-Path $InstallDir "SSADESK-ESTE-COMPUTADOR.txt") -Encoding UTF8

[ordered]@{
    data = (Get-Date).ToString("s"); codigo = $id; ipv4_local = $v4; ipv6 = $v6; ip_publico = $public
    upnp = $upnp; wan_upnp = $wan; cgnat = $cgnat; internet_ipv4 = [bool]$internetV4; internet_ipv6 = $internetV6
} | ConvertTo-Json | Set-Content -Path (Join-Path $InstallDir "rede.json") -Encoding UTF8
