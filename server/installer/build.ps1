<#
Gera dist\SSADesk-Servidor-Setup.exe.
  powershell -ExecutionPolicy Bypass -File server\installer\build.ps1
Requer Inno Setup 6 (winget install JRSoftware.InnoSetup).
#>
$ErrorActionPreference = "Stop"
$here    = $PSScriptRoot
$payload = Join-Path $here "payload"
$Version = "1.1.16"
$Url     = "https://github.com/rustdesk/rustdesk-server/releases/download/$Version/rustdesk-server-windows-x86_64-unsigned.zip"
$Sha256  = "b865a3a62fc8755b45480c508f1c4871c3338590408dda8c58c7e9c373b7adb0"

$iscc = @("$env:LOCALAPPDATA\Programs\Inno Setup 6\ISCC.exe", "${env:ProgramFiles(x86)}\Inno Setup 6\ISCC.exe") | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $iscc) { throw "Inno Setup 6 não encontrado. Instale: winget install JRSoftware.InnoSetup" }

if (Test-Path $payload) { Remove-Item -Recurse -Force $payload }
New-Item -ItemType Directory -Force $payload | Out-Null
$tmp = Join-Path $env:TEMP "ssadesk-build-$([guid]::NewGuid())"
New-Item -ItemType Directory -Force $tmp | Out-Null
try {
    $zip = Join-Path $tmp "server.zip"
    Write-Host "Baixando rustdesk-server $Version..."
    Invoke-WebRequest -Uri $Url -OutFile $zip -UseBasicParsing
    $hash = (Get-FileHash $zip -Algorithm SHA256).Hash.ToLower()
    if ($hash -ne $Sha256) { throw "SHA-256 não confere ($hash)." }
    Expand-Archive $zip -DestinationPath "$tmp\x" -Force
    Get-ChildItem "$tmp\x" -Recurse -Include hbbs.exe, hbbr.exe | Copy-Item -Destination $payload
    Invoke-WebRequest -Uri "https://raw.githubusercontent.com/rustdesk/rustdesk-server/$Version/LICENSE" -OutFile "$payload\LICENSE-AGPL.txt" -UseBasicParsing
} finally { Remove-Item -Recurse -Force $tmp -ErrorAction SilentlyContinue }

# Windows PowerShell 5.1 e o Inno precisam de UTF-8 com BOM para acentos
$bom = New-Object System.Text.UTF8Encoding($true)
[IO.File]::WriteAllText("$payload\configure.ps1", [IO.File]::ReadAllText("$here\configure.ps1"), $bom)
$iss = "$payload\SSADesk-Servidor.iss"
[IO.File]::WriteAllText($iss, ([IO.File]::ReadAllText("$here\SSADesk-Servidor.iss") -replace 'Source: "payload\\', 'Source: "' -replace 'OutputDir=\.\.\\\.\.\\dist', 'OutputDir=..\..\..\dist'), $bom)

& $iscc /Qp $iss
if ($LASTEXITCODE -ne 0) { throw "ISCC falhou ($LASTEXITCODE)." }
Write-Host "OK: $(Resolve-Path (Join-Path $here '..\..\dist\SSADesk-Servidor-Setup.exe'))"
