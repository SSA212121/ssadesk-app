<#
Gera a identidade visual do SSADesk (ícone e imagens do instalador), sem arquivos de terceiros.
Estilo DESIGN_GUIDELINES.md: azul iOS (#007AFF), cantos contínuos grandes, glifo de linha fina branco.
  powershell -ExecutionPolicy Bypass -File installer\make-icon.ps1
Saída: installer\assets\ssadesk.ico, ssadesk-256.png, wizard-small.bmp, wizard-large.bmp
#>
Add-Type -AssemblyName System.Drawing
$out = Join-Path $PSScriptRoot "assets"
New-Item -ItemType Directory -Force $out | Out-Null

function New-RoundRect([single]$x, [single]$y, [single]$w, [single]$h, [single]$r) {
    $p = New-Object Drawing.Drawing2D.GraphicsPath
    $d = $r * 2
    $p.AddArc($x, $y, $d, $d, 180, 90); $p.AddArc($x + $w - $d, $y, $d, $d, 270, 90)
    $p.AddArc($x + $w - $d, $y + $h - $d, $d, $d, 0, 90); $p.AddArc($x, $y + $h - $d, $d, $d, 90, 90)
    $p.CloseFigure(); return $p
}

# Desenha o símbolo SSADesk num retângulo (x,y,s): tela + cursor, linha fina branca
function Draw-Mark($g, [single]$x, [single]$y, [single]$s, [bool]$tile) {
    $g.SmoothingMode = "AntiAlias"; $g.PixelOffsetMode = "HighQuality"
    if ($tile) {
        $bg = New-RoundRect $x $y $s $s ($s * 0.225)
        $g.FillPath((New-Object Drawing.SolidBrush ([Drawing.Color]::FromArgb(0, 122, 255))), $bg)
    }
    $w = [Math]::Max(1.2, $s * 0.065)
    $pen = New-Object Drawing.Pen ([Drawing.Color]::White), $w
    $pen.LineJoin = "Round"; $pen.StartCap = "Round"; $pen.EndCap = "Round"
    # Tela
    $scr = New-RoundRect ($x + $s * 0.20) ($y + $s * 0.24) ($s * 0.60) ($s * 0.40) ($s * 0.06)
    $g.DrawPath($pen, $scr)
    # Pé da tela
    $g.DrawLine($pen, $x + $s * 0.50, $y + $s * 0.64, $x + $s * 0.50, $y + $s * 0.73)
    $g.DrawLine($pen, $x + $s * 0.38, $y + $s * 0.75, $x + $s * 0.62, $y + $s * 0.75)
    # Cursor (acesso remoto): seta clássica de mouse
    $cx = $x + $s * 0.44; $cy = $y + $s * 0.31; $c = $s * 0.20
    $rel = @(@(0, 0), @(0, 1), @(0.27, 0.76), @(0.45, 1.12), @(0.58, 1.06), @(0.40, 0.70), @(0.74, 0.70))
    $pts = [Drawing.PointF[]]($rel | ForEach-Object { New-Object Drawing.PointF ([single]($cx + $_[0] * $c)), ([single]($cy + $_[1] * $c)) })
    $g.FillPolygon([Drawing.Brushes]::White, $pts)
}

function New-Png([int]$size) {
    $bmp = New-Object Drawing.Bitmap $size, $size, ([Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [Drawing.Graphics]::FromImage($bmp); $g.Clear([Drawing.Color]::Transparent)
    Draw-Mark $g 0 0 $size $true
    $g.Dispose()
    $ms = New-Object IO.MemoryStream; $bmp.Save($ms, [Drawing.Imaging.ImageFormat]::Png); $bmp.Dispose()
    return , $ms.ToArray()
}

# ICO com várias resoluções (entradas PNG, suportado desde o Windows Vista)
$sizes = 16, 24, 32, 48, 64, 128, 256
$pngs = foreach ($s in $sizes) { , (New-Png $s) }
$fs = [IO.File]::Create((Join-Path $out "ssadesk.ico")); $bw = New-Object IO.BinaryWriter $fs
$bw.Write([UInt16]0); $bw.Write([UInt16]1); $bw.Write([UInt16]$sizes.Count)
$offset = 6 + 16 * $sizes.Count
for ($i = 0; $i -lt $sizes.Count; $i++) {
    $s = $sizes[$i]; $d = $pngs[$i]
    $bw.Write([byte]($(if ($s -ge 256) { 0 } else { $s }))); $bw.Write([byte]($(if ($s -ge 256) { 0 } else { $s })))
    $bw.Write([byte]0); $bw.Write([byte]0); $bw.Write([UInt16]1); $bw.Write([UInt16]32)
    $bw.Write([UInt32]$d.Length); $bw.Write([UInt32]$offset); $offset += $d.Length
}
foreach ($d in $pngs) { $bw.Write($d) }
$bw.Close()
[IO.File]::WriteAllBytes((Join-Path $out "ssadesk-256.png"), (New-Png 256))

# Imagens do assistente de instalação (BMP, fundo neutro claro estilo Apple)
function New-WizardBmp([int]$w, [int]$h, [string]$file) {
    $bmp = New-Object Drawing.Bitmap $w, $h
    $g = [Drawing.Graphics]::FromImage($bmp)
    $g.Clear([Drawing.Color]::FromArgb(246, 246, 248))
    $s = [Math]::Min($w, $h) * 0.62
    Draw-Mark $g (($w - $s) / 2) (($h - $s) / 2) $s $true
    $g.Dispose(); $bmp.Save((Join-Path $out $file), [Drawing.Imaging.ImageFormat]::Bmp); $bmp.Dispose()
}
New-WizardBmp 138 140 "wizard-small.bmp"
New-WizardBmp 410 797 "wizard-large.bmp"
Write-Host "OK: $out"
