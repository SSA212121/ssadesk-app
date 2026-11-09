<#
SSAdesk: diagnóstico e configuração automática de rede (sem servidor central).
Executado na instalação e depois periodicamente (tarefa SSAdesk-rede, como SYSTEM), porque IP local,
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
$Desc = "SSAdesk"

function Get-UPnP {
    try {
        $c = (New-Object -ComObject HNetCfg.NATUPnP).StaticPortMappingCollection
        if ($c) { return $c }
    } catch {}
    return $null
}

if ($Remove) {
    $c = Get-UPnP
    if ($c) { try { $c.Remove($Port, "TCP") } catch {}; try { $c.Remove(21130, "UDP") } catch {} }
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
# Endereço físico (MAC) da placa de rede em uso: usado para ligar este computador pela rede (Wake-on-LAN)
$mac = (Get-NetAdapter -InterfaceIndex $ifIndex -ErrorAction SilentlyContinue).MacAddress
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
        # Segurança: a porta do motor (21118) NÃO é mais aberta no roteador; remove a abertura antiga, se houver.
        try { $c.Remove($Port, "TCP") } catch {}
        # Só a porta UDP da rede P2P do SSAdesk (21130): por ela chegam as conexões (túnel criptografado + pedido)
        try { $c.Remove(21130, "UDP") } catch {}
        $null = $c.Add(21130, "UDP", 21130, $v4, $true, "SSAdesk P2P")
        $m = $c | Where-Object { $_.ExternalPort -eq 21130 -and $_.Protocol -eq "UDP" } | Select-Object -First 1
        if ($m) { $upnp = "ok"; $wan = $m.ExternalIPAddress } else { $upnp = "recusado" }
    } catch { $upnp = "recusado" }
}

# 2b. NAT-PMP / PCP (roteadores sem UPnP: Apple, vários de operadora). Pede ao roteador a abertura por 2 h.
$natpmp = "sem resposta"
function Abrir-NatPmp([int]$proto, [int]$porta) {
    # proto: 1 = UDP, 2 = TCP. Pacote NAT-PMP v0 (RFC 6886); roteadores PCP também respondem a ele.
    $u = New-Object Net.Sockets.UdpClient
    try {
        $u.Client.ReceiveTimeout = 1500
        $pb = [BitConverter]::GetBytes([uint16]$porta); [Array]::Reverse($pb)
        $vida = [BitConverter]::GetBytes([uint32]7200); [Array]::Reverse($vida)
        $pkt = [byte[]](@(0, $proto, 0, 0) + $pb + $pb + $vida)
        $null = $u.Send($pkt, $pkt.Length, $gateway, 5351)
        $ep = New-Object Net.IPEndPoint([Net.IPAddress]::Any, 0)
        $r = $u.Receive([ref]$ep)
        return ($r.Length -ge 16 -and $r[3] -eq 0)   # código de resultado 0 = sucesso
    } catch { return $false } finally { $u.Close() }
}
if ($gateway -and $upnp -ne "ok") {
    $ok1 = Abrir-NatPmp 1 21130 # só a porta P2P (a 21118 do motor fica fechada)
    if ($ok1) { $natpmp = "ok"; $upnp = "ok" }
}

# 2c. Autorreparo: o serviço do motor precisa existir e estar rodando (senão ninguém acessa este computador)
$motor = Join-Path $InstallDir "SSAdesk.exe"
$reparo = ""
if (Test-Path $motor) {
    $svc = Get-Service SSAdesk -ErrorAction SilentlyContinue
    if (-not $svc) {
        sc.exe create SSAdesk binPath= "`"$motor`" --service" start= auto DisplayName= "SSAdesk" | Out-Null
        sc.exe failure SSAdesk reset= 60 actions= restart/5000/restart/5000/restart/10000 | Out-Null
        sc.exe start SSAdesk | Out-Null
        $reparo = "serviço do motor recriado"
    } elseif ($svc.Status -ne 'Running') {
        sc.exe config SSAdesk start= auto | Out-Null
        sc.exe start SSAdesk | Out-Null
        $reparo = "serviço do motor reiniciado"
    }
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

$L = @("SSAdesk — este computador", "", "Código: $id", "", "COMO CONECTAR A ESTE COMPUTADOR (digite no SSAdesk + a senha permanente):", "")
if ($v4) { $L += "  Na mesma rede ......... $v4" }
if ($internetV6) { $L += "  Pela internet (IPv6) .. [$($v6[0])]" }
if ($internetV4) { $L += "  Pela internet (IPv4) .. $public" }
$keyFile = Join-Path $InstallDir "chave-internet.txt"
# Túnel que subiu depois da instalação: pega a chave do registro dele
if (-not (Test-Path $keyFile)) {
    $p2pLog = Join-Path $InstallDir "dados\p2p.log"
    $k = if (Test-Path $p2pLog) { ([regex]::Match("$(Get-Content $p2pLog -Raw -ErrorAction SilentlyContinue)", 'hypertele:\s*([0-9a-f]{64})')).Groups[1].Value } else { "" }
    if ($k) { $k | Set-Content -Path $keyFile -Encoding ASCII }
}
$p2pKey = if (Test-Path $keyFile) { (Get-Content $keyFile -Raw).Trim() } else { "" }
if ($p2pKey) {
    $L += ""
    $L += "  Pela internet, QUALQUER rede (inclusive CGNAT), use o atalho 'SSAdesk - Conectar pela internet' com a chave:"
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
$L += "Porta: $Port (TCP). Diagnóstico refeito sozinho a cada inicialização e a cada 15 minutos."
$L | Set-Content -Path (Join-Path $InstallDir "SSADESK-ESTE-COMPUTADOR.txt") -Encoding UTF8

[ordered]@{
    data = (Get-Date).ToString("s"); codigo = $id; ipv4_local = $v4; ipv6 = $v6; ip_publico = $public; mac = $mac
    upnp = $upnp; natpmp = $natpmp; reparo = $reparo; wan_upnp = $wan; cgnat = $cgnat; internet_ipv4 = [bool]$internetV4; internet_ipv6 = $internetV6
} | ConvertTo-Json | Set-Content -Path (Join-Path $InstallDir "rede.json") -Encoding UTF8
