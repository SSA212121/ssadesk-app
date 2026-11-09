// SSAdesk — informações do computador para o painel ⓘ da sessão (CPU, RAM, disco, GPU, rede).
// Leve: só é chamado enquanto o painel está aberto, e a parte lenta (GPU) roda em segundo plano.
const os = require('os')
const fs = require('fs')
const { execFile } = require('child_process')

let cpuAnterior = null
function usoCpu () {
  const t = os.cpus().reduce((a, c) => { const v = c.times; a.ocioso += v.idle; a.total += v.user + v.nice + v.sys + v.idle + v.irq; return a }, { ocioso: 0, total: 0 })
  const ant = cpuAnterior; cpuAnterior = t
  if (!ant || t.total === ant.total) return null
  return Math.round(100 * (1 - (t.ocioso - ant.ocioso) / (t.total - ant.total)))
}

function disco () {
  try {
    const raiz = process.platform === 'win32' ? (process.env.SystemDrive || 'C:') + '\\' : '/'
    const s = fs.statfsSync(raiz)
    const total = s.blocks * s.bsize; const livre = s.bavail * s.bsize
    return { total, usado: total - livre }
  } catch { return null }
}

// GPU: nome (uma vez) e uso do 3D (contador do Windows); atualizado a cada consulta, sem travar
let gpu = { nome: '', uso: null }
let gpuOcupado = false
function atualizarGpu () {
  if (process.platform !== 'win32' || gpuOcupado) return
  gpuOcupado = true
  const script = "$ErrorActionPreference='SilentlyContinue';" +
    "$n=(Get-CimInstance Win32_VideoController | Where-Object { $_.Name -notmatch 'Virtual|Basic|Remote|Mirror' } | Select-Object -First 1).Name;" +
    "$u=(Get-Counter '\\GPU Engine(*engtype_3D)\\Utilization Percentage').CounterSamples | Measure-Object -Property CookedValue -Sum;" +
    "Write-Output ($n + '|' + [math]::Round($u.Sum))"
  execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { windowsHide: true, timeout: 8000 }, (_e, out) => {
    gpuOcupado = false
    const [nome, uso] = String(out || '').trim().split('|')
    if (nome) gpu.nome = nome.trim()
    const u = Number(uso); gpu.uso = Number.isFinite(u) && uso !== '' ? Math.min(100, Math.max(0, u)) : null
  })
}

function redeLocal () {
  const ifs = os.networkInterfaces()
  for (const [nome, lista] of Object.entries(ifs)) {
    if (/virtual|vEthernet|loopback|vmware|hyper-v|bluetooth/i.test(nome)) continue
    if ((lista || []).some(i => i.family === 'IPv4' && !i.internal)) return /wi-?fi|wlan|sem fio|wireless/i.test(nome) ? 'Wi‑Fi' : 'Cabo / Ethernet'
  }
  return ''
}

function coletar () {
  atualizarGpu()
  const total = os.totalmem()
  return {
    cpu: usoCpu(),
    cpuNome: (os.cpus()[0] && os.cpus()[0].model || '').replace(/\s+/g, ' ').trim(),
    nucleos: os.cpus().length,
    ram: { total, usado: total - os.freemem() },
    disco: disco(),
    gpu: { ...gpu },
    rede: redeLocal(),
    sistema: process.platform === 'win32' ? 'Windows ' + (os.release().split('.')[2] >= 22000 ? '11' : '10') : os.type(),
    ligadoHa: Math.round(os.uptime())
  }
}

module.exports = { coletar }
