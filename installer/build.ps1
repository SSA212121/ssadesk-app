<#
Gera dist\SSADesk-Setup.exe (instalador unico: conexao direta IPv4/IPv6).
  powershell -ExecutionPolicy Bypass -File installer\build.ps1
Requer Inno Setup 6 (winget install JRSoftware.InnoSetup).
Todos os binarios sao oficiais do RustDesk e tem o SHA-256 conferido.
#>
$ErrorActionPreference = "Stop"
$here    = $PSScriptRoot
$payload = Join-Path $here "payload"

$ServerVer = "1.1.16"
$ServerUrl = "https://github.com/rustdesk/rustdesk-server/releases/download/$ServerVer/rustdesk-server-windows-x86_64-unsigned.zip"
$ServerSha = "b865a3a62fc8755b45480c508f1c4871c3338590408dda8c58c7e9c373b7adb0"
$ClientVer = "1.5.1"
$ClientUrl = "https://github.com/rustdesk/rustdesk/releases/download/$ClientVer/rustdesk-$ClientVer-x86_64.msi"
$ClientSha = "71069183cbc6124273138684ab4032d2211e83efa035886f9c774fe1d3eba3f0"

$iscc = @("$env:LOCALAPPDATA\Programs\Inno Setup 6\ISCC.exe", "${env:ProgramFiles(x86)}\Inno Setup 6\ISCC.exe") | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $iscc) { throw "Inno Setup 6 nao encontrado. Instale: winget install JRSoftware.InnoSetup" }

function Get-Verified($url, $out, $sha) {
    Write-Host "Baixando $url"
    Invoke-WebRequest -Uri $url -OutFile $out -UseBasicParsing
    $h = (Get-FileHash $out -Algorithm SHA256).Hash.ToLower()
    if ($h -ne $sha) { throw "SHA-256 nao confere para $url ($h)" }
}

if (Test-Path $payload) { Remove-Item -Recurse -Force $payload }
New-Item -ItemType Directory -Force $payload | Out-Null
$tmp = Join-Path $env:TEMP "ssadesk-build-$([guid]::NewGuid())"
New-Item -ItemType Directory -Force $tmp | Out-Null
try {
    Get-Verified $ServerUrl "$tmp\server.zip" $ServerSha
    Expand-Archive "$tmp\server.zip" -DestinationPath "$tmp\x" -Force
    Get-ChildItem "$tmp\x" -Recurse -Include hbbs.exe, hbbr.exe | Copy-Item -Destination $payload
    Get-Verified $ClientUrl "$payload\rustdesk.msi" $ClientSha
    Invoke-WebRequest "https://raw.githubusercontent.com/rustdesk/rustdesk-server/$ServerVer/LICENSE" -OutFile "$payload\LICENSE-SERVER-AGPL.txt" -UseBasicParsing
    Invoke-WebRequest "https://raw.githubusercontent.com/rustdesk/rustdesk/$ClientVer/LICENCE" -OutFile "$payload\LICENSE-RUSTDESK-AGPL.txt" -UseBasicParsing
} finally { Remove-Item -Recurse -Force $tmp -ErrorAction SilentlyContinue }

# Windows PowerShell 5.1 e o Inno precisam de UTF-8 com BOM para acentos
$bom = New-Object System.Text.UTF8Encoding($true)
foreach ($f in "configure.ps1", "network.ps1", "conectar.ps1", "SSADesk.iss") {
    [IO.File]::WriteAllText("$payload\$f", [IO.File]::ReadAllText("$here\$f"), $bom)
}

# Túnel P2P: Node.js (runtime oficial instalado nesta máquina) + hypertele (p2p\, via npm ci)
$p2pSrc = Join-Path $here "..\p2p"
Push-Location $p2pSrc
try { npm ci --ignore-scripts --no-audit --no-fund | Out-Null; if ($LASTEXITCODE -ne 0) { throw "npm ci falhou" } } finally { Pop-Location }
New-Item -ItemType Directory -Force "$payload\p2p" | Out-Null
Copy-Item (Get-Command node).Source "$payload\p2p\node.exe"
Copy-Item "$p2pSrc\node_modules" "$payload\p2p\node_modules" -Recurse
Copy-Item "$p2pSrc\package.json", "$p2pSrc\cliente.js", "$p2pSrc\diagnostico.js" "$payload\p2p\"

& $iscc /Qp "$payload\SSADesk.iss"
if ($LASTEXITCODE -ne 0) { throw "ISCC falhou ($LASTEXITCODE)." }
Write-Host "OK: $(Resolve-Path (Join-Path $here '..\dist\SSADesk-Setup.exe'))"
