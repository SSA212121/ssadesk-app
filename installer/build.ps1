<#
Gera dist\SSAdesk-Setup.exe.
  powershell -ExecutionPolicy Bypass -File installer\build.ps1
Requer Inno Setup 6 (winget install JRSoftware.InnoSetup) e Node.js.

O Setup.exe é só um envelope: extrai a pasta "stage" e abre a tela de instalação do próprio app
(app\SSAdeskApp.exe --instalar). Layout da stage = layout final da instalação:
  motor\ -> raiz da instalação: SSAdesk.exe (motor próprio, compilado do código do RustDesk com a marca SSAdesk)
  app\  (SSAdeskApp.exe = Electron oficial + resources\app; também é o Node do túnel)
  bin\hbbs.exe   tools\*.ps1   ssadesk.ico/png   licenças
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
    Invoke-WebRequest "https://raw.githubusercontent.com/rustdesk/rustdesk-server/$ServerVer/LICENSE" -OutFile "$stage\LICENSE-SERVER-AGPL.txt" -UseBasicParsing
    Invoke-WebRequest "https://raw.githubusercontent.com/rustdesk/rustdesk/$ClientVer/LICENCE" -OutFile "$stage\LICENSE-RUSTDESK-AGPL.txt" -UseBasicParsing
} finally { Remove-Item -Recurse -Force $tmp -ErrorAction SilentlyContinue }

# 2. Scripts de configuração (Windows PowerShell 5.1 precisa de UTF-8 com BOM para acentos)
$bom = New-Object System.Text.UTF8Encoding($true)
foreach ($f in "configure.ps1", "network.ps1", "tunel.ps1", "chave.js") {
    [IO.File]::WriteAllText("$stage\tools\$f", [IO.File]::ReadAllText("$here\$f"), $bom)
}

# 3. Túnel P2P: roda no motor do próprio app (SSAdesk.exe modo Node); hypertele vem nas dependências do app

# 3b. Motor SSAdesk (compilado de C:\dev\ssadesk-motor, ramo "ssadesk"): vai para a raiz da instalação como SSAdesk.exe
$motorSrc = "C:\dev\ssadesk-motor\flutter\build\windows\x64\runner\Release"
if (-not (Test-Path "$motorSrc\rustdesk.exe")) { throw "Motor não compilado. Compile em C:\dev\ssadesk-motor (cargo build + flutter build windows)." }
Copy-Item $motorSrc "$stage\motor" -Recurse
Rename-Item "$stage\motor\rustdesk.exe" "SSAdesk.exe"
$vd = "C:\dev\ssadesk-motor\target\release\deps\dylib_virtual_display.dll"; if (Test-Path $vd) { Copy-Item $vd "$stage\motor\" }

# 4. Identidade visual
& (Join-Path $here "make-icon.ps1") | Out-Null
Copy-Item "$here\assets\ssadesk.ico" "$stage\ssadesk.ico"
Copy-Item "$here\assets\ssadesk-256.png" "$stage\ssadesk.png"
Copy-Item "$here\assets\ssadesk.ico" "$payload\ssadesk.ico"

# 5. App SSAdesk (Electron oficial + código do app)
Push-Location $appSrc
try { npm ci --no-audit --no-fund | Out-Null; if ($LASTEXITCODE -ne 0) { throw "npm ci (app) falhou" }; node node_modules\electron\install.js } finally { Pop-Location }
New-Item -ItemType Directory -Force "$appSrc\assets", "$appSrc\src\fonts" | Out-Null
Copy-Item "$here\assets\ssadesk-256.png" "$appSrc\assets\icon.png" -Force
Copy-Item "$here\assets\ssadesk.ico" "$appSrc\assets\icon.ico" -Force
Copy-Item "$appSrc\node_modules\@fontsource-variable\inter\files\inter-latin-wght-normal.woff2" "$appSrc\src\fonts\inter.woff2" -Force
$appOut = Join-Path $stage "app"
Copy-Item "$appSrc\node_modules\electron\dist" $appOut -Recurse
Remove-Item "$appOut\resources\default_app.asar" -ErrorAction SilentlyContinue
Rename-Item "$appOut\electron.exe" "SSAdeskApp.exe"
New-Item -ItemType Directory -Force "$appOut\resources\app" | Out-Null
# Todos os módulos .js do app (a lista fixa deixou módulos novos de fora e o canal P2P não iniciava)
Copy-Item "$appSrc\*.js", "$appSrc\package.json" "$appOut\resources\app\"
Copy-Item "$appSrc\src", "$appSrc\assets" "$appOut\resources\app\" -Recurse
# Dependências de produção (rede P2P da chamada); electron e rcedit são só de build
robocopy "$appSrc\node_modules" "$appOut\resources\app\node_modules" /E /NFL /NDL /NJH /NJS /NP /XD electron rcedit @types | Out-Null
if ($LASTEXITCODE -ge 8) { throw "robocopy falhou ($LASTEXITCODE)" }
# Verificação: todo require('./x') do app precisa existir no pacote, e os módulos de rede precisam carregar
$appPkg = "$appOut\resources\app"
foreach ($js in Get-ChildItem $appPkg -Filter *.js) {
  foreach ($m in [regex]::Matches((Get-Content $js.FullName -Raw), "require\('\./([\w-]+)'\)")) {
    if (-not (Test-Path "$appPkg\$($m.Groups[1].Value).js")) { throw "Módulo ausente no pacote: $($m.Groups[1].Value).js (usado em $($js.Name))" }
  }
}
$env:ELECTRON_RUN_AS_NODE = "1"
$saidaTeste = Join-Path $env:TEMP "ssadesk-modulos.txt"; Remove-Item $saidaTeste -ErrorAction SilentlyContinue
Start-Process "$appOut\SSAdeskApp.exe" -ArgumentList "`"$here\verificar-modulos.js`" `"$appPkg`" `"$saidaTeste`"" -Wait -WindowStyle Hidden
$teste = Get-Content $saidaTeste -Raw -ErrorAction SilentlyContinue
Remove-Item Env:ELECTRON_RUN_AS_NODE
if ("$teste" -notmatch 'modulos-ok') { throw "Os módulos do app não carregam no pacote: $teste" }
Write-Host "OK: módulos do app carregam no pacote"
& "$appSrc\node_modules\rcedit\bin\rcedit-x64.exe" "$appOut\SSAdeskApp.exe" --set-icon "$here\assets\ssadesk.ico" `
    --set-version-string "ProductName" "SSAdesk" --set-version-string "FileDescription" "SSAdesk" `
    --set-version-string "CompanyName" "SSA Comercio" --set-file-version $version --set-product-version $version
if ($LASTEXITCODE -ne 0) { throw "rcedit falhou" }

# 6. Enxugar o pacote (instala mais rápido): só binários nativos de Windows x64 e idiomas pt-BR/en-US
function Remove-OutrasPlataformas($raiz) {
    Get-ChildItem $raiz -Recurse -Directory -Filter prebuilds -ErrorAction SilentlyContinue | ForEach-Object {
        Get-ChildItem $_.FullName -Directory | Where-Object { $_.Name -ne "win32-x64" } | Remove-Item -Recurse -Force
    }
}
Remove-OutrasPlataformas "$appOut\resources\app\node_modules"
Get-ChildItem "$appOut\locales" -Filter *.pak | Where-Object { $_.Name -notin "pt-BR.pak", "en-US.pak" } | Remove-Item -Force
$mb = [math]::Round(((Get-ChildItem $stage -Recurse -File | Measure-Object Length -Sum).Sum / 1MB), 0)
Write-Host "Pacote: $mb MB"

# 7. Janela leve de instalação (WebView2 do Windows): abre em ~0,5 s com as mesmas telas do app
$wvVer = "1.0.4314.35"
$ui = Join-Path $stage "..\ui"; New-Item -ItemType Directory -Force "$ui\src\fonts", "$ui\assets" | Out-Null
$tmpWv = Join-Path $env:TEMP "ssadesk-wv2-$([guid]::NewGuid())"; New-Item -ItemType Directory $tmpWv | Out-Null
try {
    Invoke-WebRequest "https://api.nuget.org/v3-flatcontainer/microsoft.web.webview2/$wvVer/microsoft.web.webview2.$wvVer.nupkg" -OutFile "$tmpWv\p.zip" -UseBasicParsing
    Expand-Archive "$tmpWv\p.zip" "$tmpWv\x"
    $dlls = "$tmpWv\x\lib\net462\Microsoft.Web.WebView2.Core.dll", "$tmpWv\x\lib\net462\Microsoft.Web.WebView2.WinForms.dll", "$tmpWv\x\runtimes\win-x64\native\WebView2Loader.dll"
    foreach ($d in $dlls) { $s = Get-AuthenticodeSignature $d; if ($s.Status -ne "Valid" -or $s.SignerCertificate.Subject -notmatch "Microsoft Corporation") { throw "Assinatura Microsoft inválida: $d" } }
    Copy-Item $dlls $ui
} finally { Remove-Item -Recurse -Force $tmpWv -ErrorAction SilentlyContinue }
$csc = "$env:WINDIR\Microsoft.NET\Framework64\v4.0.30319\csc.exe"
& $csc /nologo /target:winexe /platform:x64 /optimize+ /out:"$ui\SetupUI.exe" /win32icon:"$here\assets\ssadesk.ico" `
    /r:"$ui\Microsoft.Web.WebView2.Core.dll" /r:"$ui\Microsoft.Web.WebView2.WinForms.dll" /r:System.Web.Extensions.dll /r:System.Windows.Forms.dll /r:System.Drawing.dll "$here\setup-ui\SetupUI.cs"
if ($LASTEXITCODE -ne 0) { throw "csc falhou" }
Copy-Item "$here\assets\ssadesk.ico" $ui
Copy-Item "$appSrc\src\setup.html", "$appSrc\src\setup.css", "$appSrc\src\styles.css", "$appSrc\src\setup.js", "$appSrc\src\ponte-webview.js" "$ui\src\"
Copy-Item "$appSrc\src\fonts\inter.woff2" "$ui\src\fonts\"; Copy-Item "$appSrc\assets\icon.png" "$ui\assets\"

# 8. Envelope (Setup.exe)
$iss = [IO.File]::ReadAllText("$here\SSAdesk.iss") -replace '#define AppVersion ".*"', "#define AppVersion `"$version`""
[IO.File]::WriteAllText("$payload\SSAdesk.iss", $iss, $bom)
& $iscc /Qp "$payload\SSAdesk.iss"
if ($LASTEXITCODE -ne 0) { throw "ISCC falhou ($LASTEXITCODE)." }
# Pasta pronta para o pendrive: instalador + atalho de um clique para liberar o bloqueio do Windows
$pen = Join-Path $here "..\dist\Pendrive-SSAdesk"
if (Test-Path $pen) { Remove-Item -Recurse -Force $pen }
New-Item -ItemType Directory -Force $pen | Out-Null
Copy-Item (Join-Path $here "..\dist\SSAdesk-Setup.exe"), "$here\pendrive\*" $pen
Write-Host "OK: $(Resolve-Path (Join-Path $here '..\dist\SSAdesk-Setup.exe'))"
