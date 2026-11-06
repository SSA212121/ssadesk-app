<#
Gera dist\SSADesk-Setup.exe.
  powershell -ExecutionPolicy Bypass -File installer\build.ps1
Requer Inno Setup 6 (winget install JRSoftware.InnoSetup) e Node.js.

O Setup.exe é só um envelope: extrai a pasta "stage" e abre a tela de instalação do próprio app
(app\SSADesk.exe --instalar). Layout da stage = layout final da instalação:
  app\  (SSADesk.exe = Electron oficial + resources\app)   p2p\  (node.exe + túnel)
  bin\hbbs.exe   tools\*.ps1   rustdesk.msi   ssadesk.ico/png   licenças
Todos os binários de terceiros são oficiais e têm o SHA-256 conferido.
#>
$ErrorActionPreference = "Stop"
$here    = $PSScriptRoot
$payload = Join-Path $here "payload"
$stage   = Join-Path $payload "stage"
$appSrc  = Join-Path $here "..\app"
$p2pSrc  = Join-Path $here "..\p2p"
$version = (Get-Content "$appSrc\package.json" -Raw | ConvertFrom-Json).version

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
New-Item -ItemType Directory -Force "$stage\bin", "$stage\tools" | Out-Null

# 1. RustDesk oficial (cliente MSI + hbbs local)
$tmp = Join-Path $env:TEMP "ssadesk-build-$([guid]::NewGuid())"
New-Item -ItemType Directory -Force $tmp | Out-Null
try {
    Get-Verified $ServerUrl "$tmp\server.zip" $ServerSha
    Expand-Archive "$tmp\server.zip" -DestinationPath "$tmp\x" -Force
    Get-ChildItem "$tmp\x" -Recurse -Include hbbs.exe | Copy-Item -Destination "$stage\bin"
    Get-Verified $ClientUrl "$stage\rustdesk.msi" $ClientSha
    Invoke-WebRequest "https://raw.githubusercontent.com/rustdesk/rustdesk-server/$ServerVer/LICENSE" -OutFile "$stage\LICENSE-SERVER-AGPL.txt" -UseBasicParsing
    Invoke-WebRequest "https://raw.githubusercontent.com/rustdesk/rustdesk/$ClientVer/LICENCE" -OutFile "$stage\LICENSE-RUSTDESK-AGPL.txt" -UseBasicParsing
} finally { Remove-Item -Recurse -Force $tmp -ErrorAction SilentlyContinue }

# 2. Scripts de configuração (Windows PowerShell 5.1 precisa de UTF-8 com BOM para acentos)
$bom = New-Object System.Text.UTF8Encoding($true)
foreach ($f in "configure.ps1", "network.ps1", "tunel.ps1") {
    [IO.File]::WriteAllText("$stage\tools\$f", [IO.File]::ReadAllText("$here\$f"), $bom)
}

# 3. Túnel P2P: Node.js + hypertele
Push-Location $p2pSrc
try { npm ci --ignore-scripts --no-audit --no-fund | Out-Null; if ($LASTEXITCODE -ne 0) { throw "npm ci (p2p) falhou" } } finally { Pop-Location }
New-Item -ItemType Directory -Force "$stage\p2p" | Out-Null
Copy-Item (Get-Command node).Source "$stage\p2p\node.exe"
Copy-Item "$p2pSrc\node_modules" "$stage\p2p\node_modules" -Recurse
Copy-Item "$p2pSrc\package.json", "$p2pSrc\cliente.js", "$p2pSrc\diagnostico.js" "$stage\p2p\"

# 4. Identidade visual
& (Join-Path $here "make-icon.ps1") | Out-Null
Copy-Item "$here\assets\ssadesk.ico" "$stage\ssadesk.ico"
Copy-Item "$here\assets\ssadesk-256.png" "$stage\ssadesk.png"
Copy-Item "$here\assets\ssadesk.ico" "$payload\ssadesk.ico"

# 5. App SSADesk (Electron oficial + código do app)
Push-Location $appSrc
try { npm ci --no-audit --no-fund | Out-Null; if ($LASTEXITCODE -ne 0) { throw "npm ci (app) falhou" }; node node_modules\electron\install.js } finally { Pop-Location }
New-Item -ItemType Directory -Force "$appSrc\assets", "$appSrc\src\fonts" | Out-Null
Copy-Item "$here\assets\ssadesk-256.png" "$appSrc\assets\icon.png" -Force
Copy-Item "$here\assets\ssadesk.ico" "$appSrc\assets\icon.ico" -Force
Copy-Item "$appSrc\node_modules\@fontsource-variable\inter\files\inter-latin-wght-normal.woff2" "$appSrc\src\fonts\inter.woff2" -Force
$appOut = Join-Path $stage "app"
Copy-Item "$appSrc\node_modules\electron\dist" $appOut -Recurse
Remove-Item "$appOut\resources\default_app.asar" -ErrorAction SilentlyContinue
Rename-Item "$appOut\electron.exe" "SSADesk.exe"
New-Item -ItemType Directory -Force "$appOut\resources\app" | Out-Null
Copy-Item "$appSrc\main.js", "$appSrc\preload.js", "$appSrc\instalador.js", "$appSrc\package.json" "$appOut\resources\app\"
Copy-Item "$appSrc\src", "$appSrc\assets" "$appOut\resources\app\" -Recurse
Copy-Item "$appSrc\canal.js" "$appOut\resources\app\"
# Dependências de produção (rede P2P da chamada); electron e rcedit são só de build
robocopy "$appSrc\node_modules" "$appOut\resources\app\node_modules" /E /NFL /NDL /NJH /NJS /NP /XD electron rcedit @types | Out-Null
if ($LASTEXITCODE -ge 8) { throw "robocopy falhou ($LASTEXITCODE)" }
& "$appSrc\node_modules\rcedit\bin\rcedit-x64.exe" "$appOut\SSADesk.exe" --set-icon "$here\assets\ssadesk.ico" `
    --set-version-string "ProductName" "SSADesk" --set-version-string "FileDescription" "SSADesk" `
    --set-version-string "CompanyName" "SSA Comercio" --set-file-version $version --set-product-version $version
if ($LASTEXITCODE -ne 0) { throw "rcedit falhou" }

# 6. Enxugar o pacote (instala mais rápido): só binários nativos de Windows x64 e idiomas pt-BR/en-US
function Remove-OutrasPlataformas($raiz) {
    Get-ChildItem $raiz -Recurse -Directory -Filter prebuilds -ErrorAction SilentlyContinue | ForEach-Object {
        Get-ChildItem $_.FullName -Directory | Where-Object { $_.Name -ne "win32-x64" } | Remove-Item -Recurse -Force
    }
}
Remove-OutrasPlataformas "$stage\p2p\node_modules"
Remove-OutrasPlataformas "$appOut\resources\app\node_modules"
Get-ChildItem "$appOut\locales" -Filter *.pak | Where-Object { $_.Name -notin "pt-BR.pak", "en-US.pak" } | Remove-Item -Force
$mb = [math]::Round(((Get-ChildItem $stage -Recurse -File | Measure-Object Length -Sum).Sum / 1MB), 0)
Write-Host "Pacote: $mb MB"

# 7. Envelope (Setup.exe)
$iss = [IO.File]::ReadAllText("$here\SSADesk.iss") -replace '#define AppVersion ".*"', "#define AppVersion `"$version`""
[IO.File]::WriteAllText("$payload\SSADesk.iss", $iss, $bom)
& $iscc /Qp "$payload\SSADesk.iss"
if ($LASTEXITCODE -ne 0) { throw "ISCC falhou ($LASTEXITCODE)." }
Write-Host "OK: $(Resolve-Path (Join-Path $here '..\dist\SSADesk-Setup.exe'))"
