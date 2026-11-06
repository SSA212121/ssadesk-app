<#
SSADesk: painel principal (estilo Apple, ver DESIGN_GUIDELINES.md).
  - Este computador: código, chave de internet (copiar) e situação da rede
  - Conectar a outro computador: IP (mesma rede/IPv6) ou chave de internet (qualquer rede)
  - Tema: Automático (segue o Windows), Claro ou Escuro
#>
$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Windows.Forms, System.Drawing
[Windows.Forms.Application]::EnableVisualStyles()
Add-Type -Namespace SSADesk -Name Dwm -MemberDefinition @'
[System.Runtime.InteropServices.DllImport("dwmapi.dll")]
public static extern int DwmSetWindowAttribute(System.IntPtr hwnd, int attr, ref int value, int size);
'@

$app    = Split-Path $PSScriptRoot -Parent
$exe    = (Get-ChildItem (Join-Path $app "RustDesk") -Filter rustdesk.exe -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1).FullName
$icon   = Join-Path $app "ssadesk.ico"
$prefs  = Join-Path $env:LOCALAPPDATA "SSADesk"
New-Item -ItemType Directory -Force $prefs | Out-Null
$temaFile = Join-Path $prefs "tema.txt"
$lastFile = Join-Path $prefs "ultimo-destino.txt"

function Read-Text($p) { if (Test-Path $p) { ([string](Get-Content $p -Raw)).Trim() } else { "" } }
$codigo = Read-Text (Join-Path $app "codigo.txt")
$chave  = Read-Text (Join-Path $app "chave-internet.txt")
$rede   = $null; try { $rede = Get-Content (Join-Path $app "rede.json") -Raw | ConvertFrom-Json } catch {}

# ---------- Tema ----------
$script:tema = Read-Text $temaFile; if ($script:tema -notin "auto", "claro", "escuro") { $script:tema = "auto" }
function Test-Dark {
    if ($script:tema -eq "escuro") { return $true }
    if ($script:tema -eq "claro") { return $false }
    try { return ((Get-ItemProperty "HKCU:\Software\Microsoft\Windows\CurrentVersion\Themes\Personalize").AppsUseLightTheme -eq 0) } catch { return $false }
}
function C($r, $g, $b) { [Drawing.Color]::FromArgb($r, $g, $b) }
function Get-Palette([bool]$dark) {
    if ($dark) { @{ bg = C 28 28 30; card = C 44 44 46; text = C 245 245 247; sub = C 152 152 157; sep = C 58 58 60; accent = C 10 132 255; field = C 58 58 60; seg = C 58 58 60; segOn = C 99 99 102 } }
    else       { @{ bg = C 242 242 247; card = C 255 255 255; text = C 29 29 31; sub = C 110 110 115; sep = C 229 229 234; accent = C 0 122 255; field = C 242 242 247; seg = C 227 227 232; segOn = C 255 255 255 } }
}

$fontName = if ([Drawing.FontFamily]::Families.Name -contains "Segoe UI Variable Display") { "Segoe UI Variable Display" } else { "Segoe UI" }
function F([single]$size, [Drawing.FontStyle]$style = "Regular") { New-Object Drawing.Font($fontName, $size, $style) }

function Set-Round($ctl, [int]$r) {
    $p = New-Object Drawing.Drawing2D.GraphicsPath; $d = $r * 2; $w = $ctl.Width; $h = $ctl.Height
    $p.AddArc(0, 0, $d, $d, 180, 90); $p.AddArc($w - $d, 0, $d, $d, 270, 90)
    $p.AddArc($w - $d, $h - $d, $d, $d, 0, 90); $p.AddArc(0, $h - $d, $d, $d, 90, 90); $p.CloseFigure()
    $ctl.Region = New-Object Drawing.Region($p)
}
function New-Label($text, $font, $x, $y, $w = 0, $h = 0) {
    $l = New-Object Windows.Forms.Label; $l.Text = $text; $l.Font = $font; $l.Location = New-Object Drawing.Point($x, $y)
    if ($w) { $l.AutoSize = $false; $l.Size = New-Object Drawing.Size($w, $h) } else { $l.AutoSize = $true }
    $l.BackColor = [Drawing.Color]::Transparent; return $l
}
function New-Button($text, $x, $y, $w, $h) {
    $b = New-Object Windows.Forms.Button; $b.Text = $text; $b.Font = F 10 "Bold"
    $b.FlatStyle = "Flat"; $b.FlatAppearance.BorderSize = 0; $b.Cursor = "Hand"
    $b.Location = New-Object Drawing.Point($x, $y); $b.Size = New-Object Drawing.Size($w, $h); Set-Round $b 10
    return $b
}

# ---------- Janela ----------
$form = New-Object Windows.Forms.Form
$form.Text = "SSADesk"; $form.ClientSize = New-Object Drawing.Size(460, 560); $form.StartPosition = "CenterScreen"
$form.FormBorderStyle = "FixedSingle"; $form.MaximizeBox = $false; $form.Font = F 10
if (Test-Path $icon) { $form.Icon = New-Object Drawing.Icon($icon) }

$hdrIcon = New-Object Windows.Forms.PictureBox
$hdrIcon.Size = New-Object Drawing.Size(40, 40); $hdrIcon.Location = New-Object Drawing.Point(28, 26); $hdrIcon.SizeMode = "Zoom"
$png = Join-Path $app "ssadesk.png"; if (Test-Path $png) { $hdrIcon.Image = [Drawing.Image]::FromFile($png) }
$hdrTitle = New-Label "SSADesk" (F 18 "Bold") 76 28
$hdrSub = New-Label "Acesso remoto da SSA Comércio" (F 9.5) 78 56

# Card: Este computador
$card1 = New-Object Windows.Forms.Panel; $card1.Location = New-Object Drawing.Point(20, 92); $card1.Size = New-Object Drawing.Size(420, 196)
$c1t = New-Label "ESTE COMPUTADOR" (F 8.5 "Bold") 18 14
$c1lc = New-Label "Código" (F 9.5) 18 40
$c1code = New-Label ($(if ($codigo) { $codigo } else { "—" })) (F 22 "Bold") 16 58
$c1sep = New-Object Windows.Forms.Panel; $c1sep.Location = New-Object Drawing.Point(18, 104); $c1sep.Size = New-Object Drawing.Size(384, 1)
$c1lk = New-Label "Chave de internet (para acessar de qualquer rede)" (F 9.5) 18 114
$keyShort = if ($chave) { $chave.Substring(0, 10) + "…" + $chave.Substring($chave.Length - 10) } else { "não disponível" }
$c1key = New-Label $keyShort (New-Object Drawing.Font("Consolas", 10.5)) 18 136
$btnCopy = New-Button "Copiar" 312 130 90 30
$statusTxt = "Situação da rede: desconhecida"
if ($rede) {
    $statusTxt = if ($rede.internet_ipv6 -or $rede.internet_ipv4) { "● Acessível pela internet (direto)" }
                 elseif ($chave) { "● Acessível pela internet (túnel P2P)" + $(if ($rede.cgnat) { " · rede com CGNAT" } else { "" }) }
                 else { "● Acessível só na rede local" }
}
$c1status = New-Label $statusTxt (F 9) 18 166
$card1.Controls.AddRange(@($c1t, $c1lc, $c1code, $c1sep, $c1lk, $c1key, $btnCopy, $c1status))

# Card: Conectar
$card2 = New-Object Windows.Forms.Panel; $card2.Location = New-Object Drawing.Point(20, 304); $card2.Size = New-Object Drawing.Size(420, 170)
$c2t = New-Label "CONECTAR A OUTRO COMPUTADOR" (F 8.5 "Bold") 18 14
$c2h = New-Label "Digite o IP (mesma rede) ou cole a chave de internet do outro computador." (F 9.5) 18 38 384 36
$fieldWrap = New-Object Windows.Forms.Panel; $fieldWrap.Location = New-Object Drawing.Point(18, 78); $fieldWrap.Size = New-Object Drawing.Size(384, 36)
$txt = New-Object Windows.Forms.TextBox; $txt.BorderStyle = "None"; $txt.Font = F 11; $txt.Location = New-Object Drawing.Point(12, 8); $txt.Width = 360
$txt.Text = Read-Text $lastFile
$fieldWrap.Controls.Add($txt)
$btnGo = New-Button "Conectar" 282 124 120 34
$c2msg = New-Label "" (F 9) 18 132 260 20
$card2.Controls.AddRange(@($c2t, $c2h, $fieldWrap, $btnGo, $c2msg))

# Tema (controle segmentado)
$lblTema = New-Label "Aparência" (F 9.5) 28 500
$seg = New-Object Windows.Forms.Panel; $seg.Location = New-Object Drawing.Point(150, 492); $seg.Size = New-Object Drawing.Size(290, 34)
$segBtns = @{}
$i = 0
foreach ($opt in @(@("auto", "Automático"), @("claro", "Claro"), @("escuro", "Escuro"))) {
    $b = New-Object Windows.Forms.Button; $b.Text = $opt[1]; $b.Tag = $opt[0]; $b.Font = F 9.5
    $b.FlatStyle = "Flat"; $b.FlatAppearance.BorderSize = 0; $b.Cursor = "Hand"
    $b.Location = New-Object Drawing.Point((3 + $i * 95), 3); $b.Size = New-Object Drawing.Size(92, 28)
    $seg.Controls.Add($b); $segBtns[$opt[0]] = $b; $i++
}
$form.Controls.AddRange(@($hdrIcon, $hdrTitle, $hdrSub, $card1, $card2, $lblTema, $seg))

function Apply-Theme {
    $dark = Test-Dark; $p = Get-Palette $dark
    $form.BackColor = $p.bg
    foreach ($l in @($hdrTitle, $c1code, $c1key)) { $l.ForeColor = $p.text }
    foreach ($l in @($hdrSub, $c1t, $c1lc, $c1lk, $c2t, $c2h, $lblTema, $c1status, $c2msg)) { $l.ForeColor = $p.sub }
    if ($statusTxt -like "*internet*") { $c1status.ForeColor = [Drawing.Color]::FromArgb(52, 199, 89) }
    foreach ($cd in @($card1, $card2)) { $cd.BackColor = $p.card; Set-Round $cd 16 }
    $c1sep.BackColor = $p.sep
    $fieldWrap.BackColor = $p.field; $txt.BackColor = $p.field; $txt.ForeColor = $p.text; Set-Round $fieldWrap 10
    foreach ($b in @($btnGo)) { $b.BackColor = $p.accent; $b.ForeColor = [Drawing.Color]::White; $b.FlatAppearance.MouseOverBackColor = [Drawing.Color]::FromArgb(220, $p.accent) }
    $btnCopy.BackColor = $p.field; $btnCopy.ForeColor = $p.accent; $btnCopy.FlatAppearance.MouseOverBackColor = $p.sep
    $seg.BackColor = $p.seg; Set-Round $seg 9
    foreach ($k in $segBtns.Keys) {
        $b = $segBtns[$k]; $on = ($k -eq $script:tema)
        $b.BackColor = $(if ($on) { $p.segOn } else { $p.seg }); $b.ForeColor = $p.text
        $b.FlatAppearance.MouseOverBackColor = $(if ($on) { $p.segOn } else { $p.sep }); Set-Round $b 7
    }
    # Barra de título escura/clara e cantos arredondados (Windows 11)
    $v = [int]$dark; [void][SSADesk.Dwm]::DwmSetWindowAttribute($form.Handle, 20, [ref]$v, 4)
    $r = 2; [void][SSADesk.Dwm]::DwmSetWindowAttribute($form.Handle, 33, [ref]$r, 4)
    $form.Refresh()
}
foreach ($b in $segBtns.Values) {
    $b.Add_Click({ param($s) $script:tema = $s.Tag; $script:tema | Set-Content $temaFile -Encoding ASCII; Apply-Theme })
}
# "Automático" acompanha a troca de tema do Windows na hora
[Microsoft.Win32.SystemEvents]::add_UserPreferenceChanged({ if ($script:tema -eq "auto") { $form.BeginInvoke([Action] { Apply-Theme }) | Out-Null } })

$btnCopy.Add_Click({
    if ($chave) { [Windows.Forms.Clipboard]::SetText($chave); $btnCopy.Text = "Copiado"; $t = New-Object Windows.Forms.Timer; $t.Interval = 1600
        $t.Add_Tick({ $btnCopy.Text = "Copiar"; $this.Stop() }); $t.Start() }
})

# ---------- Conectar ----------
$script:waitTimer = $null
function Set-Busy([bool]$busy, [string]$msg) { $btnGo.Enabled = -not $busy; $txt.Enabled = -not $busy; $c2msg.Text = $msg }
$btnGo.Add_Click({
    $dest = ($txt.Text -replace '\s', '')
    if (-not $dest) { $c2msg.Text = "Digite um IP ou cole uma chave."; return }
    $dest | Set-Content $lastFile -Encoding ASCII
    if (-not $exe) { $c2msg.Text = "RustDesk não encontrado. Reinstale o SSADesk."; return }
    if ($dest -match '^[0-9a-fA-F]{64}$') {
        # Qualquer rede: túnel P2P em segundo plano, depois abre o SSADesk
        $l = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback, 0); $l.Start(); $port = $l.LocalEndpoint.Port; $l.Stop(); $script:port = $port
        Start-Process powershell.exe -WindowStyle Hidden -ArgumentList "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", "`"$(Join-Path $PSScriptRoot 'tunel.ps1')`"", "-Key", $dest.ToLower(), "-Port", $port
        Set-Busy $true "Abrindo túnel pela internet…"
        $script:tries = 0
        $script:waitTimer = New-Object Windows.Forms.Timer; $script:waitTimer.Interval = 500
        $script:waitTimer.Add_Tick({
            $script:tries++
            if (Get-NetTCPConnection -State Listen -LocalPort $script:port -ErrorAction SilentlyContinue) {
                $script:waitTimer.Stop(); Start-Process $exe -ArgumentList "--connect", "127.0.0.1:$($script:port)"
                Set-Busy $false "Conectando… a primeira vez pode levar alguns segundos."
            } elseif ($script:tries -gt 40) { $script:waitTimer.Stop(); Set-Busy $false "Não foi possível abrir o túnel." }
        })
        $script:waitTimer.Start()
    } else {
        Start-Process $exe -ArgumentList "--connect", $dest
        $c2msg.Text = "Conectando a $dest…"
    }
})
$txt.Add_KeyDown({ param($s, $e) if ($e.KeyCode -eq "Enter") { $btnGo.PerformClick(); $e.SuppressKeyPress = $true } })

$form.Add_Shown({
    Apply-Theme; $btnGo.Focus()
    # Modo de pré-visualização (usado no build para validar o visual): salva imagem e fecha
    if ($env:SSADESK_SNAPSHOT) {
        $form.Refresh(); $bmp = New-Object Drawing.Bitmap($form.Width, $form.Height)
        $form.DrawToBitmap($bmp, (New-Object Drawing.Rectangle(0, 0, $form.Width, $form.Height)))
        $bmp.Save($env:SSADESK_SNAPSHOT); $form.Close()
    }
})
[void]$form.ShowDialog()
