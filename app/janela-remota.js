// SSAdesk — acompanha a posição da janela da tela remota (motor SSAdesk.exe) para a lousa ficar só sobre ela.
// Um único PowerShell leve fica lendo o retângulo da maior janela visível do motor a cada 400 ms.
const { spawn } = require('child_process')

const SCRIPT = `
Add-Type @"
using System; using System.Runtime.InteropServices; using System.Text;
public static class JR {
  public delegate bool CB(IntPtr h, IntPtr p);
  [DllImport("user32.dll")] public static extern bool EnumWindows(CB cb, IntPtr p);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr h);
  [DllImport("user32.dll")] public static extern int GetWindowThreadProcessId(IntPtr h, out int pid);
  [DllImport("user32.dll")] public static extern int GetWindowTextLength(IntPtr h);
  [DllImport("dwmapi.dll")] public static extern int DwmGetWindowAttribute(IntPtr h, int a, out RECT r, int s);
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int L, T, R, B; }
  public static string Maior(int[] pids) {
    RECT melhor = new RECT(); long area = 0;
    EnumWindows((h, p) => {
      int pid; GetWindowThreadProcessId(h, out pid);
      if (Array.IndexOf(pids, pid) < 0 || !IsWindowVisible(h) || IsIconic(h) || GetWindowTextLength(h) == 0) return true;
      RECT r; if (DwmGetWindowAttribute(h, 9, out r, 16) != 0) return true;
      long a = (long)(r.R - r.L) * (r.B - r.T);
      if (a > area && r.R - r.L > 200 && r.B - r.T > 150) { area = a; melhor = r; }
      return true; }, IntPtr.Zero);
    return area == 0 ? "" : melhor.L + "," + melhor.T + "," + (melhor.R - melhor.L) + "," + (melhor.B - melhor.T);
  }
}
"@
$ultimo = ''
while ($true) {
  $pids = @(Get-Process SSAdesk -ErrorAction SilentlyContinue | ForEach-Object Id)
  $r = if ($pids.Count) { [JR]::Maior([int[]]$pids) } else { '' }
  if ($r -ne $ultimo) { [Console]::Out.WriteLine($r); [Console]::Out.Flush(); $ultimo = $r }
  Start-Sleep -Milliseconds 400
}
`

// aoMudar({x,y,width,height} em pixels físicos | null). Devolve uma função para parar.
function acompanharJanelaRemota (aoMudar) {
  if (process.platform !== 'win32') return () => {}
  const cod = Buffer.from(SCRIPT, 'utf16le').toString('base64')
  const ps = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', cod], { windowsHide: true })
  let resto = ''
  ps.stdout.on('data', d => {
    resto += d.toString()
    const linhas = resto.split(/\r?\n/); resto = linhas.pop()
    for (const l of linhas) {
      const n = l.trim().split(',').map(Number)
      aoMudar(n.length === 4 && n.every(Number.isFinite) ? { x: n[0], y: n[1], width: n[2], height: n[3] } : null)
    }
  })
  ps.on('error', () => {})
  return () => { try { ps.kill() } catch {} }
}

module.exports = { acompanharJanelaRemota }
