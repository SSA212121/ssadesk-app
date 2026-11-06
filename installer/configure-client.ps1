<#
SSADesk Computador: instala o cliente RustDesk oficial e aponta para o servidor próprio da SSA.
Chamado pelo instalador, já como Administrador.
  -Mode install   : instala o MSI, configura servidor/chave/senha permanente, grava o código (ID) deste computador
  -Mode uninstall : remove o cliente RustDesk
Cada computador recebe do RustDesk um código (ID) único; o servidor hbbs recusa IDs repetidos.
#>
param(
    [Parameter(Mandatory = $true)][ValidateSet("install", "uninstall")][string]$Mode,
    [Parameter(Mandatory = $true)][string]$InstallDir,
    [string]$Msi = "",
    [string]$ServerHost = "",
    [string]$Key = "",
    [string]$PasswordFile = ""
)
$ErrorActionPreference = "Stop"
New-Item -ItemType Directory -Force $InstallDir | Out-Null
$log = Join-Path $InstallDir "instalacao.log"
Start-Transcript -Path $log -Append | Out-Null

function Get-RustDeskUninstall {
    Get-ChildItem "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall", "HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall" -ErrorAction SilentlyContinue |
        Get-ItemProperty | Where-Object { $_.DisplayName -eq "RustDesk" -and $_.PSChildName -like "{*}" } | Select-Object -First 1
}

if ($Mode -eq "uninstall") {
    $u = Get-RustDeskUninstall
    if ($u) { Start-Process msiexec.exe -ArgumentList "/x $($u.PSChildName) /qn /norestart" -Wait }
    Stop-Transcript | Out-Null; exit 0
}

if (-not $ServerHost -or -not $Key -or -not (Test-Path $PasswordFile)) { throw "Servidor, chave ou senha não informados." }
$password = (Get-Content $PasswordFile -Raw).Trim()
Remove-Item $PasswordFile -Force
if ($password.Length -lt 8) { throw "Senha permanente precisa ter ao menos 8 caracteres." }

# 1. Cliente RustDesk oficial (MSI), na pasta escolhida
$p = Start-Process msiexec.exe -ArgumentList "/i `"$Msi`" /qn /norestart INSTALLFOLDER=`"$InstallDir\RustDesk`" CREATESTARTMENUSHORTCUTS=1 CREATEDESKTOPSHORTCUTS=1 /l*v `"$InstallDir\msi.log`"" -Wait -PassThru
if ($p.ExitCode -notin 0, 3010) { throw "Falha no MSI do RustDesk (código $($p.ExitCode)). Veja msi.log." }
$exe = Join-Path $InstallDir "RustDesk\rustdesk.exe"
if (-not (Test-Path $exe)) { $exe = (Get-ChildItem $InstallDir -Recurse -Filter rustdesk.exe | Select-Object -First 1).FullName }
if (-not $exe) { throw "rustdesk.exe não encontrado após a instalação." }
for ($i = 0; $i -lt 30 -and -not (Get-Service RustDesk -ErrorAction SilentlyContinue); $i++) { Start-Sleep 1 }

function RD([string[]]$a) { & $exe @a | Out-Null }

# 2. Servidor próprio (nunca os servidores públicos do RustDesk)
RD "--option", "custom-rendezvous-server", $ServerHost
RD "--option", "relay-server", $ServerHost
RD "--option", "key", $Key
RD "--option", "api-server", ""
# 3. Acesso desassistido SOMENTE com senha permanente (sem senha temporária, sem "aceitar clique")
RD "--option", "verification-method", "use-permanent-password"
RD "--option", "approve-mode", "password"
RD "--password", $password
$password = $null

Restart-Service RustDesk -ErrorAction SilentlyContinue

# 4. Código (ID) único deste computador
$id = ""
for ($i = 0; $i -lt 30 -and -not $id; $i++) {
    $id = ((& $exe --get-id | Out-String) -replace '\D', '')
    if (-not $id) { Start-Sleep 1 }
}
if (-not $id) { throw "Não foi possível obter o código deste computador." }
$fmt = ($id -replace '(\d{3})(?=\d)', '$1 ').Trim()
$fmt | Set-Content -Path (Join-Path $InstallDir "SSADESK-ID.txt") -Encoding ASCII
Write-Host "Código SSADesk deste computador: $fmt"
Stop-Transcript | Out-Null
