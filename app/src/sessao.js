// SSAdesk — barrinha da sessão: soltar arquivos para enviar, chat, chamada, encerrar
const $ = id => document.getElementById(id)
const api = window.ssadesk
const params = new URLSearchParams(location.search)
const padrao = new URLSearchParams(location.search).get('papel') === 'acessado' ? 'Está acessando este computador' : 'Arraste arquivos aqui para enviar'

function mostrarNome (nome) {
  nome = nome || 'Computador conectado'
  $('nome').textContent = nome
  $('inicial').textContent = (nome.trim()[0] || '?').toUpperCase()
}
mostrarNome(params.get('nome'))
$('estado').textContent = padrao
if (params.get('papel') === 'acessado') {
  document.body.classList.add('acessado')
  for (const a of ['arquivos', 'tela', 'mais']) { const b = document.querySelector('[data-acao="' + a + '"]'); if (b) b.remove() }
}
// O outro computador não permitiu: o botão nem aparece
const sem = (params.get('sem') || '').split(',').filter(Boolean)
for (const a of sem) { const b = document.querySelector('[data-acao="' + a + '"]'); if (b) b.remove() }
if (sem.includes('arquivos') && params.get('papel') !== 'acessado') $('estado').textContent = 'Conectado'
api.sessao.onAtualizar(s => mostrarNome(s.nome))
api.sessao.onEstado(t => estado(t, /✓/.test(t)))

document.querySelectorAll('[data-acao]').forEach(b => b.addEventListener('click', async () => {
  if (b.dataset.acao === 'arquivos') { const r = await api.arquivos.escolher(); if (r && r.ok === false && r.msg) estado(r.msg, true) } else api.sessao.acao(b.dataset.acao)
}))

let voltar
function estado (texto, temporario) {
  $('estado').textContent = texto
  clearTimeout(voltar)
  if (temporario) voltar = setTimeout(() => { $('estado').textContent = padrao }, 3500)
}

// ---------- Soltar arquivos ----------
let dentro = 0
addEventListener('dragenter', e => { e.preventDefault(); dentro++; document.body.classList.add('soltar'); estado('Solte para enviar a ' + $('nome').textContent) })
addEventListener('dragover', e => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy' })
addEventListener('dragleave', () => { if (--dentro <= 0) { dentro = 0; document.body.classList.remove('soltar'); estado(padrao) } })
addEventListener('drop', async e => {
  e.preventDefault(); dentro = 0; document.body.classList.remove('soltar')
  const caminhos = [...e.dataTransfer.files].map(f => api.arquivos.caminhoDe(f)).filter(Boolean)
  if (!caminhos.length) return estado(padrao)
  const r = await api.arquivos.enviar(caminhos)
  if (!r.ok) estado(r.msg || 'Não foi possível enviar.', true)
})

// ---------- Progresso ----------
const mb = n => n >= 1048576 ? (n / 1048576).toFixed(1).replace('.', ',') + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB'
api.arquivos.onProgresso(p => {
  if (p.concluido) {
    document.body.classList.remove('enviando'); $('progFill').style.width = '0'
    return estado(p.arquivos === 1 ? 'Arquivo enviado ✓' : p.arquivos + ' arquivos enviados ✓', true)
  }
  document.body.classList.add('enviando')
  const pct = p.total ? Math.round(p.enviado / p.total * 100) : 100
  $('progFill').style.width = pct + '%'
  estado('Enviando ' + (p.arquivos > 1 ? p.arquivos + ' arquivos' : String(p.atual).split(/[\\/]/).pop()) + ' · ' + mb(p.enviado) + ' de ' + mb(p.total))
})

// ---------- Chat: som de mensagem nova e selo de não lidas (também sem chamada aberta) ----------
let naoLidas = 0
let audioCtx = null
function tocarAviso () {
  try {
    audioCtx = audioCtx || new AudioContext()
    const agora = audioCtx.currentTime
    ;[[1046.5, 0], [1568, 0.11]].forEach(([freq, atraso]) => {
      const osc = audioCtx.createOscillator(); const g = audioCtx.createGain()
      osc.type = 'sine'; osc.frequency.value = freq
      g.gain.setValueAtTime(0, agora + atraso)
      g.gain.linearRampToValueAtTime(0.18, agora + atraso + 0.012)
      g.gain.exponentialRampToValueAtTime(0.0001, agora + atraso + 0.45)
      osc.connect(g).connect(audioCtx.destination)
      osc.start(agora + atraso); osc.stop(agora + atraso + 0.5)
    })
  } catch {}
}
function atualizarSelo () {
  $('selo').textContent = naoLidas > 9 ? '9+' : String(naoLidas)
  document.body.classList.toggle('tem-nao-lidas', naoLidas > 0)
}
api.sessao.onChat(({ visivel, som }) => {
  if (som) tocarAviso()
  if (!visivel) { naoLidas++; atualizarSelo(); estado('Nova mensagem de ' + $('nome').textContent, true) }
})
api.sessao.onChatVisivel(v => { if (v) { naoLidas = 0; atualizarSelo() } })

// Botão clicado com o mouse não fica com anel de foco preso quando a janela volta a ter foco
document.addEventListener('click', e => { const b = e.target.closest('button'); if (b && e.detail > 0) setTimeout(() => b.blur(), 0) })
// Barra recolhida (a janela vira só a abinha)
api.sessao.onRecolhida(v => document.body.classList.toggle('recolhida', !!v))
