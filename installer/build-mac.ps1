<#
Gera dist\Mac-SSAdesk\ (pacote para macOS, para levar no pendrive).
  powershell -ExecutionPolicy Bypass -File installer\build-mac.ps1
Binarios oficiais com SHA-256 conferido: RustDesk 1.5.1 (Intel e Apple Silicon) e Node.js para macOS.
Os node_modules do tunel (p2p\) ja trazem os binarios nativos de macOS (prebuilds darwin-x64/arm64).
#>
$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent
$out  = Join-Path $root "dist\Mac-SSAdesk"
$pay  = Join-Path $out "payload"

$RD   = "1.5.1"
$NODE = "v24.20.0"
$files = @(
    @{ url = "https://github.com/rustdesk/rustdesk/releases/download/$RD/rustdesk-$RD-aarch64.dmg"; out = "rustdesk-arm64.dmg";  sha = "1b94182cba2375ea29a196f2c8183f7feaa00588474ecd76c92c2303ffd70d7b" },
    @{ url = "https://github.com/rustdesk/rustdesk/releases/download/$RD/rustdesk-$RD-x86_64.dmg";  out = "rustdesk-x86_64.dmg"; sha = "457e45a26d3f0919221e6db3dfb8c6a12ca65190307b53a907c3c51b762eb008" },
    @{ url = "https://nodejs.org/dist/$NODE/node-$NODE-darwin-arm64.tar.gz"; out = "node-arm64.tar.gz"; sha = "40e5607e5ecb3db9192723776da2d75d966260fc74a7a9e731c1bd67dda96bc8" },
    @{ url = "https://nodejs.org/dist/$NODE/node-$NODE-darwin-x64.tar.gz";   out = "node-x64.tar.gz";   sha = "9e5b2644cf107befb6aefca676b96d3296bc10138096f022ed378d6233ed81f4" }
)

if (Test-Path $out) { Remove-Item -Recurse -Force $out }
New-Item -ItemType Directory -Force $pay | Out-Null
foreach ($f in $files) {
    $dest = Join-Path $pay $f.out
    Write-Host "Baixando $($f.url)"
    Invoke-WebRequest -Uri $f.url -OutFile $dest -UseBasicParsing
    $h = (Get-FileHash $dest -Algorithm SHA256).Hash.ToLower()
    if ($h -ne $f.sha) { throw "SHA-256 nao confere: $($f.out) ($h)" }
}

# Tunel P2P (mesmos modulos do Windows; JS puro + prebuilds de macOS)
$p2p = Join-Path $root "p2p"
New-Item -ItemType Directory -Force "$pay\p2p" | Out-Null
Copy-Item "$p2p\node_modules" "$pay\p2p\node_modules" -Recurse
Copy-Item "$p2p\package.json", "$p2p\cliente.js", "$p2p\diagnostico.js" "$pay\p2p\"

# Scripts: sempre com quebra de linha LF (macOS)
function Copy-Lf($src, $dst) {
    $t = [IO.File]::ReadAllText($src) -replace "`r`n", "`n"
    [IO.File]::WriteAllText($dst, $t, (New-Object Text.UTF8Encoding($false)))
}
Copy-Lf "$root\mac\instalar.command" "$out\Instalar SSAdesk.command"
Copy-Lf "$root\mac\conectar.sh" "$pay\conectar.sh"
Copy-Item "$root\mac\LEIA-ME.txt" "$out\LEIA-ME.txt"
$mb = [math]::Round(((Get-ChildItem $out -Recurse -File | Measure-Object Length -Sum).Sum / 1MB), 0)
Write-Host "OK: $out ($mb MB)"
