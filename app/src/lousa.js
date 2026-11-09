// SSAdesk — lousa digital (parte do Modo My). Os dois computadores veem e podem anotar.
// Coordenadas normalizadas (0..1) em relação à tela inteira: no Modo My a tela remota ocupa a tela toda,
// então o mesmo ponto cai no mesmo lugar dos dois lados.
const $ = id => document.getElementById(id)
const api = window.ssadesk.lousa
const cv = $('tela'); const g = cv.getContext('2d')
const tracos = new Map() // id -> { cor, larg, alfa, pts: [[x,y],...] }
let ferr = 'caneta'; let cor = '#ff3b30'
let desenhando = true

function ajustar () {
  const dpr = window.devicePixelRatio || 1
  cv.width = innerWidth * dpr; cv.height = innerHeight * dpr
  g.setTransform(dpr, 0, 0, dpr, 0, 0)
  redesenhar()
}
function estilo (t) {
  g.strokeStyle = t.cor; g.lineWidth = t.larg; g.globalAlpha = t.alfa
  g.lineCap = 'round'; g.lineJoin = 'round'
  g.globalCompositeOperation = t.alfa < 1 ? 'multiply' : 'source-over'
}
function desenhar (t, desde = 1) {
  if (!t.pts.length) return
  estilo(t)
  g.beginPath()
  const p0 = t.pts[Math.max(0, desde - 1)]
  g.moveTo(p0[0] * innerWidth, p0[1] * innerHeight)
  if (t.pts.length === 1) g.lineTo(p0[0] * innerWidth + .01, p0[1] * innerHeight)
  for (let i = desde; i < t.pts.length; i++) g.lineTo(t.pts[i][0] * innerWidth, t.pts[i][1] * innerHeight)
  g.stroke()
  g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'
}
function redesenhar () { g.clearRect(0, 0, innerWidth, innerHeight); for (const t of tracos.values()) desenhar(t) }
function limparTudo () { tracos.clear(); redesenhar() }

// Cores das bolinhas (via script: a política de segurança da página bloqueia estilo embutido no HTML)
document.querySelectorAll('[data-cor]').forEach(b => b.style.setProperty('--c', b.dataset.cor))

// ---------- Borracha: apaga o traço inteiro em que o ponteiro passar por cima ----------
function apagarEm (x, y) {
  const raio = 14; const ids = []
  for (const [id, t] of tracos) {
    const folga = raio + t.larg / 2
    if (t.pts.some(p => Math.hypot(p[0] * innerWidth - x, p[1] * innerHeight - y) <= folga)) ids.push(id)
  }
  if (!ids.length) return
  ids.forEach(id => tracos.delete(id)); redesenhar()
  api.enviar({ acao: 'apagar', ids })
}
let apagando = false

// ---------- Desenho local ----------
let atual = null; let pendentes = []; let envio = null
const novoId = () => Math.random().toString(36).slice(2, 10)
cv.addEventListener('pointerdown', e => {
  if (!desenhando) return
  cv.setPointerCapture(e.pointerId)
  if (ferr === 'borracha') { apagando = true; apagarEm(e.clientX, e.clientY); return }
  const marca = ferr === 'marca'
  atual = { id: novoId(), cor, larg: marca ? 22 : 4, alfa: marca ? 0.35 : 1, pts: [[e.clientX / innerWidth, e.clientY / innerHeight]] }
  tracos.set(atual.id, atual)
  desenhar(atual)
  api.enviar({ acao: 'inicio', id: atual.id, cor: atual.cor, larg: atual.larg, alfa: atual.alfa, pts: atual.pts })
})
cv.addEventListener('pointermove', e => {
  if (apagando) { apagarEm(e.clientX, e.clientY); return }
  if (!atual) return
  const pts = (e.getCoalescedEvents ? e.getCoalescedEvents() : [e]).map(p => [p.clientX / innerWidth, p.clientY / innerHeight])
  const antes = atual.pts.length
  atual.pts.push(...pts); desenhar(atual, antes)
  pendentes.push(...pts)
  if (!envio) envio = setTimeout(() => { api.enviar({ acao: 'pontos', id: atual ? atual.id : null, pts: pendentes }); pendentes = []; envio = null }, 30)
})
const soltar = () => {
  apagando = false
  if (!atual) return
  if (envio) { clearTimeout(envio); envio = null }
  api.enviar({ acao: 'pontos', id: atual.id, pts: pendentes }); pendentes = []
  atual = null
}
cv.addEventListener('pointerup', soltar); cv.addEventListener('pointercancel', soltar)

// ---------- Anotações do outro lado ----------
api.onRemoto(m => {
  if (m.acao === 'inicio') { const t = { cor: String(m.cor).slice(0, 9), larg: Math.min(40, +m.larg || 4), alfa: Math.min(1, +m.alfa || 1), pts: (m.pts || []).slice(0, 5000) }; tracos.set(m.id, t); desenhar(t) }
  if (m.acao === 'pontos' && tracos.has(m.id)) { const t = tracos.get(m.id); const antes = t.pts.length; t.pts.push(...(m.pts || []).slice(0, 5000)); desenhar(t, antes) }
  if (m.acao === 'limpar') { limparTudo(); aviso('Anotações apagadas') }
  if (m.acao === 'apagar') { (m.ids || []).slice(0, 500).forEach(id => tracos.delete(id)); redesenhar() }
})

// ---------- Ferramentas ----------
document.querySelectorAll('[data-ferr]').forEach(b => b.addEventListener('click', () => {
  ferr = b.dataset.ferr
  document.body.classList.toggle('borracha', ferr === 'borracha')
  document.querySelectorAll('[data-ferr]').forEach(x => x.classList.toggle('ativa', x === b))
  definirModo(true)
}))
document.querySelectorAll('[data-cor]').forEach(b => b.addEventListener('click', () => {
  cor = b.dataset.cor
  if (ferr === 'borracha') document.querySelector('[data-ferr="caneta"]').click()
  document.querySelectorAll('[data-cor]').forEach(x => x.classList.toggle('ativa', x === b))
  definirModo(true)
}))
$('limpar').addEventListener('click', () => { limparTudo(); api.enviar({ acao: 'limpar' }) })
$('fechar').addEventListener('click', () => api.fechar())
$('modo').addEventListener('click', () => definirModo(!desenhando))

// Mouse: os cliques passam para a tela por baixo (a barra continua clicável)
function definirModo (desenhar) {
  desenhando = desenhar
  document.body.classList.toggle('desenhar', desenhar)
  $('modo').classList.toggle('ativa', !desenhar)
  $('modo').setAttribute('aria-label', desenhar ? 'Usar o mouse' : 'Voltar a desenhar')
  document.querySelectorAll('[data-ferr]').forEach(x => x.classList.toggle('ativa', desenhar && x.dataset.ferr === ferr))
  api.atravessar(!desenhar)
}
const barra = $('ferramentas')
barra.addEventListener('mouseenter', () => { if (!desenhando) api.atravessar(false) })
barra.addEventListener('mouseleave', () => { if (!desenhando) api.atravessar(true) })
addEventListener('keydown', e => { if (e.key === 'Escape') definirModo(!desenhando) })

function aviso (t) { const a = $('aviso'); a.textContent = t; a.classList.add('show'); clearTimeout(aviso.t); aviso.t = setTimeout(() => a.classList.remove('show'), 1800) }

addEventListener('resize', ajustar)
ajustar()
// Aberta porque o outro lado desenhou: o mouse continua passando para a tela (quem controla não é bloqueado)
if (new URLSearchParams(location.search).get('mouse') === '1') definirModo(false)
aviso('Lousa ligada · Esc alterna entre desenhar e usar o mouse')
