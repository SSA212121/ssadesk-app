// SSAdesk — painel ⓘ: caminho da conexão, latência e recursos dos dois computadores
const $ = id => document.getElementById(id)
const api = window.ssadesk

const par = (u, t) => { const tb = t >= 1e12; const f = n => tb ? (n / 1e12).toFixed(1).replace('.', ',') : String(Math.round(n / 1073741824 * (t < 1e11 ? 10 : 1)) / (t < 1e11 ? 10 : 1)).replace('.', ','); return f(u) + '/' + f(t) + (tb ? ' TB' : ' GB') }
const pct = (a, b) => b ? Math.round(a / b * 100) : 0
function medidor (id, p) {
  const el = $(id); const v = Math.max(0, Math.min(100, p || 0))
  el.style.width = v + '%'
  el.className = v >= 90 ? 'alto' : v >= 70 ? 'medio' : ''
}
function preencher (lado, s) {
  const L = lado
  if (!s) { for (const k of ['cpu', 'ram', 'hd', 'gpu', 'rede']) $(k + L).textContent = '—'; for (const k of ['cpu', 'ram', 'hd']) medidor(k + L + 'm', 0); return }
  $('cpu' + L).textContent = s.cpu == null ? '…' : s.cpu + '%'; medidor('cpu' + L + 'm', s.cpu)
  const r = s.ram || {}; $('ram' + L).textContent = r.total ? par(r.usado, r.total) : '—'; medidor('ram' + L + 'm', pct(r.usado, r.total))
  const d = s.disco; $('hd' + L).textContent = d && d.total ? par(d.usado, d.total) : '—'; medidor('hd' + L + 'm', d ? pct(d.usado, d.total) : 0)
  $('gpu' + L).textContent = s.gpu && s.gpu.uso != null ? s.gpu.uso + '%' : '…'
  $('rede' + L).textContent = s.rede || '—'
}

api.info.onDados(d => {
  $('nome').textContent = d.conectado ? d.nome : 'Sem conexão ativa'
  $('outroTitulo').textContent = d.conectado ? (d.nome.length > 12 ? d.nome.slice(0, 11) + '…' : d.nome) : 'Outro'
  $('caminho').textContent = d.conectado ? d.caminho.tipo : '—'
  $('detalhe').textContent = d.conectado ? d.caminho.detalhe : ''
  const ms = d.latencia
  $('latencia').textContent = ms == null ? (d.conectado ? 'medindo…' : '—') : ms + ' ms'
  $('qualidade').textContent = ms == null ? '—' : ms < 60 ? 'Excelente' : ms < 130 ? 'Boa' : ms < 250 ? 'Regular' : 'Fraca'
  $('qualidade').className = ms == null ? '' : ms < 60 ? 'ok' : ms < 130 ? 'ok' : ms < 250 ? 'medio' : 'alto'
  preencher('L', d.local); preencher('R', d.remoto)
  const nomes = [d.local && d.local.gpu && d.local.gpu.nome, d.remoto && d.remoto.gpu && d.remoto.gpu.nome].filter(Boolean)
  $('gpuNome').textContent = nomes.length ? 'GPU: ' + nomes.join(' · ') : ''
  if (document.activeElement !== $('fps')) $('fps').checked = !!d.fps
})

$('fps').addEventListener('change', async e => { const r = await api.info.fps(e.target.checked); if (r && r.ok) e.target.checked = r.fps })
$('fechar').addEventListener('click', () => api.info.fechar())
addEventListener('keydown', e => { if (e.key === 'Escape') api.info.fechar() })
