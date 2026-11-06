<#
SSADesk - Conectar pela internet.
Pede a chave de internet do outro computador, ABRE O TÚNEL P2P PRIMEIRO (mostrando "Conectando...")
e só então abre o SSADesk, que já conecta de primeira. Funciona mesmo atrás de CGNAT.
#>
$ErrorActionPreference = "Stop"
Add-Type -AssemblyName Microsoft.VisualBasic, System.Windows.Forms, System.Drawing
[System.Windows.Forms.Application]::EnableVisualStyles()
$app  = Split-Path $PSScriptRoot -Parent
$node = Join-Path $app "p2p\node.exe"
$cli  = Join-Path $app "p2p\cliente.js"
$exe  = (Get-ChildItem (Join-Path $app "RustDesk") -Filter rustdesk.exe -Recurse | Select-Object -First 1).FullName
$last = Join-Path $env:LOCALAPPDATA "SSADesk\ultima-chave.txt"

function Show-Msg($t) { [System.Windows.Forms.MessageBox]::Show($t, "SSADesk") | Out-Null }

$prev = if (Test-Path $last) { (Get-Content $last -Raw).Trim() } else { "" }
$key = [Microsoft.VisualBasic.Interaction]::InputBox(
    "Cole a chave de internet do computador que você quer acessar." + [Environment]::NewLine +
    "(ela aparece em SSADESK-ESTE-COMPUTADOR.txt no outro computador)",
    "SSADesk - Conectar pela internet", $prev)
$key = ($key -replace '\s', '').ToLower()
if (-not $key) { exit 0 }
if ($key -notmatch '^[0-9a-f]{64}$') { Show-Msg "Chave inválida. Ela tem 64 letras e números (0-9, a-f)."; exit 1 }
New-Item -ItemType Directory -Force (Split-Path $last) | Out-Null
$key | Set-Content $last -Encoding ASCII

# --- Janela "Conectando..." (tema claro/escuro do sistema) ---
$light = 1
try { $light = (Get-ItemProperty "HKCU:\Software\Microsoft\Windows\CurrentVersion\Themes\Personalize").AppsUseLightTheme } catch {}
$bg = if ($light -eq 0) { [Drawing.Color]::FromArgb(30, 30, 32) } else { [Drawing.Color]::FromArgb(246, 246, 248) }
$fg = if ($light -eq 0) { [Drawing.Color]::FromArgb(245, 245, 247) } else { [Drawing.Color]::FromArgb(29, 29, 31) }
$sub = if ($light -eq 0) { [Drawing.Color]::FromArgb(152, 152, 157) } else { [Drawing.Color]::FromArgb(110, 110, 115) }
$accent = if ($light -eq 0) { [Drawing.Color]::FromArgb(10, 132, 255) } else { [Drawing.Color]::FromArgb(0, 122, 255) }

$form = New-Object Windows.Forms.Form
$form.Text = "SSADesk"; $form.Size = New-Object Drawing.Size(420, 190); $form.StartPosition = "CenterScreen"
$form.FormBorderStyle = "FixedSingle"; $form.MaximizeBox = $false; $form.MinimizeBox = $true; $form.BackColor = $bg
$font = "Segoe UI Variable Display"; if (-not ([Drawing.FontFamily]::Families.Name -contains $font)) { $font = "Segoe UI" }
$title = New-Object Windows.Forms.Label
$title.Text = "Conectando pela internet"; $title.Font = New-Object Drawing.Font($font, 14, [Drawing.FontStyle]::Bold)
$title.ForeColor = $fg; $title.AutoSize = $true; $title.Location = New-Object Drawing.Point(24, 22)
$status = New-Object Windows.Forms.Label
$status.Text = "Iniciando..."; $status.Font = New-Object Drawing.Font($font, 10); $status.ForeColor = $sub
$status.AutoSize = $false; $status.Size = New-Object Drawing.Size(370, 40); $status.Location = New-Object Drawing.Point(24, 58)
$bar = New-Object Windows.Forms.ProgressBar
$bar.Style = "Marquee"; $bar.MarqueeAnimationSpeed = 25; $bar.Size = New-Object Drawing.Size(370, 4); $bar.Location = New-Object Drawing.Point(24, 104)
$bar.ForeColor = $accent
$form.Controls.AddRange(@($title, $status, $bar))

# --- Túnel: processo node com saída lida linha a linha ---
$psi = New-Object Diagnostics.ProcessStartInfo $node
$psi.Arguments = "`"$cli`" $key"
$psi.UseShellExecute = $false; $psi.RedirectStandardOutput = $true; $psi.CreateNoWindow = $true
$psi.StandardOutputEncoding = [Text.Encoding]::UTF8
$psi.EnvironmentVariables["SSADESK_P2P"] = Join-Path $app "p2p"
$tun = [Diagnostics.Process]::Start($psi)
$queue = [Collections.Concurrent.ConcurrentQueue[string]]::new()
$reader = [PowerShell]::Create().AddScript({
    param($p, $q)
    while (-not $p.StandardOutput.EndOfStream) { $q.Enqueue($p.StandardOutput.ReadLine()) }
}).AddArgument($tun).AddArgument($queue)
$null = $reader.BeginInvoke()

$script:port = 0
$script:fail = $null
$timer = New-Object Windows.Forms.Timer
$timer.Interval = 200
$timer.Add_Tick({
    $line = $null
    while ($queue.TryDequeue([ref]$line)) {
        if ($line -like "STATUS *") { $status.Text = $line.Substring(7) }
        elseif ($line -like "PRONTO *") { $script:port = [int]$line.Substring(7) }
        elseif ($line -like "ERRO *") { $script:fail = $line.Substring(5) }
    }
    if ($script:port -or $script:fail -or $tun.HasExited) { $timer.Stop(); $form.Close() }
})
$form.Add_Shown({ $timer.Start() })
[void]$form.ShowDialog()

try {
    if (-not $script:port) {
        if (-not $script:fail) { $script:fail = "O túnel foi interrompido." }
        Show-Msg ("Não foi possível conectar.`n`n" + $script:fail)
        exit 1
    }
    # Túnel já aberto: o SSADesk conecta de primeira
    $null = Start-Process $exe -ArgumentList "--connect", "127.0.0.1:$($script:port)" -PassThru
    # Mantém o túnel enquanto houver conexão passando por ele (ou a janela ainda estiver abrindo)
    $start = Get-Date
    do {
        Start-Sleep 3
        $conn = Get-NetTCPConnection -RemotePort $script:port -State Established -ErrorAction SilentlyContinue
        $alive = $conn -or ((Get-Date) - $start).TotalSeconds -lt 90
    } while ($alive -and -not $tun.HasExited)
} finally {
    if (-not $tun.HasExited) { $tun.Kill() }
}
