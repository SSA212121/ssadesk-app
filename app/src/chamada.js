// SSADesk — chamada de vídeo durante o acesso remoto.
// Janela pequena e flutuante. Cada lado liga o PRÓPRIO microfone/câmera quando quiser (começam desligados).
// A imagem do outro lado ocupa a janela; a sua aparece num quadradinho arrastável e redimensionável.
// Áudio/vídeo/chat vão e vêm pelo canal P2P próprio (midia.js + canal.js no processo principal), sem servidor.
const $ = id => document.getElementById(id)
const api = window.ssadesk
const params = new URLSearchParams(location.search)
document.body.classList.add('platform-' + (params.get('platform') || ''))
if (params.get('nome')) $('nome').textContent = params.get('nome')

const local = new MediaStream() // suas faixas de áudio/vídeo (só existem enquanto ligadas)
$('local').srcObject = local

function aviso (texto) {
  const a = $('aviso'); a.textContent = texto; a.classList.add('show')
  clearTimeout(aviso.t); aviso.t = setTimeout(() => a.classList.remove('show'), 2000)
}

// ---------- Microfone e câmera (liga sob demanda, desliga liberando o dispositivo) ----------
async function ligar (tipo) {
  const restr = tipo === 'video'
    ? { video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } } }
    : { audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } }
  const s = await navigator.mediaDevices.getUserMedia(restr)
  s.getTracks().forEach(t => local.addTrack(t))
}
function desligar (tipo) {
  const faixas = tipo === 'video' ? local.getVideoTracks() : local.getAudioTracks()
  faixas.forEach(t => { t.stop(); local.removeTrack(t) })
}
const ligado = tipo => (tipo === 'video' ? local.getVideoTracks() : local.getAudioTracks()).some(t => t.readyState === 'live')

async function alternar (tipo, botao, nomeOn, nomeOff) {
  if (tipo === 'video' && telaStream) pararTela()
  botao.disabled = true
  try {
    if (ligado(tipo)) { desligar(tipo); aviso(nomeOff) } else { await ligar(tipo); aviso(nomeOn) }
  } catch (e) {
    console.log('falha ao ligar ' + tipo + ': ' + (e && e.message))
    aviso(tipo === 'video' ? 'Câmera indisponível' : 'Microfone indisponível')
  }
  botao.disabled = false
  botao.setAttribute('aria-pressed', String(ligado(tipo)))
  atualizarPip()
  // Envia (ou para de enviar) ao outro computador
  const M = window.ssadeskMidia
  if (tipo === 'video') { if (ligado('video')) M.iniciarVideo($('local')); else M.pararVideo() }
  if (tipo === 'audio') { if (ligado('audio')) await M.iniciarAudio(new MediaStream(local.getAudioTracks())); else M.pararAudio() }
  informarEstado()
}
function informarEstado () { api.chamada.controle({ t: 'estado', mic: ligado('audio'), cam: ligado('video') || !!telaStream, tela: !!telaStream }) }

// ---------- Transmitir minha tela (como no Meet): substitui a câmera enquanto transmite ----------
let telaStream = null
async function alternarTela () {
  const M = window.ssadeskMidia
  if (telaStream) { pararTela(); return }
  try {
    const id = await api.chamada.fonteTela()
    if (!id) throw new Error('sem tela')
    telaStream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { mandatory: { chromeMediaSource: 'desktop', chromeMediaSourceId: id, maxWidth: 1920, maxHeight: 1080, maxFrameRate: 15 } } })
  } catch (e) { console.log('transmissão: ' + (e && (e.name + ' ' + e.message))); aviso('Transmissão cancelada'); return }
  const v = $('telaLocal'); v.srcObject = telaStream; await v.play().catch(() => {})
  telaStream.getVideoTracks()[0].addEventListener('ended', pararTela)
  if (ligado('video')) { desligar('video'); $('cam').setAttribute('aria-pressed', 'false'); atualizarPip() }
  console.log('transmissão: tela ' + v.videoWidth + 'x' + v.videoHeight)
  M.iniciarVideo(v, { taxa: 2_500_000 })
  $('tela').setAttribute('aria-pressed', 'true')
  aviso('Transmitindo sua tela')
  informarEstado()
}
function pararTela () {
  if (!telaStream) return
  telaStream.getTracks().forEach(t => t.stop()); telaStream = null
  window.ssadeskMidia.pararVideo(); $('telaLocal').srcObject = null
  $('tela').setAttribute('aria-pressed', 'false')
  aviso('Transmissão encerrada')
  informarEstado()
}
$('tela').addEventListener('click', alternarTela)
if (params.get('tela') === '1') setTimeout(alternarTela, 600)
$('mic').addEventListener('click', () => alternar('audio', $('mic'), 'Microfone ligado', 'Microfone desligado'))
$('cam').addEventListener('click', () => alternar('video', $('cam'), 'Câmera ligada', 'Câmera desligada'))

function atualizarPip () {
  const cam = ligado('video')
  $('pip').classList.toggle('sem-video', !cam)
}

function encerrar () {
  if (telaStream) { telaStream.getTracks().forEach(t => t.stop()); telaStream = null }
  window.ssadeskMidia.pararVideo(); window.ssadeskMidia.pararAudio()
  local.getTracks().forEach(t => t.stop())
  api.chamada.janela('fechar')
}
$('encerrar').addEventListener('click', encerrar)
document.querySelectorAll('.wbtn').forEach(b => b.addEventListener('click', () => {
  if (b.dataset.acao === 'fechar') return encerrar()
  api.chamada.janela(b.dataset.acao)
}))

// ---------- Seu quadradinho: arrastar (encaixa no canto) e redimensionar ----------
const pip = $('pip')
const MARGEM = 10
let canto = localStorage.getItem('pipCanto') || 'inf-dir'
let largura = Number(localStorage.getItem('pipLargura')) || 0

// Largura útil do vídeo (desconta o chat aberto)
function areaW () { return innerWidth }
function limitesLargura () { return { min: 72, max: Math.max(90, Math.min(areaW() * 0.7, (innerHeight - 40) * 4 / 3)) } }
function aplicarTamanho () {
  const { min, max } = limitesLargura()
  if (!largura) largura = Math.round(areaW() * 0.28)
  const w = Math.round(Math.min(max, Math.max(min, largura)))
  pip.style.width = w + 'px'; pip.style.height = Math.round(w * 3 / 4) + 'px'
}
function posicionar () {
  aplicarTamanho()
  const w = pip.offsetWidth; const h = pip.offsetHeight
  const baixo = document.body.classList.contains('ocioso') ? 0 : $('controles').offsetHeight + 18
  const x = canto.endsWith('dir') ? areaW() - w - MARGEM : MARGEM
  const y = canto.startsWith('inf') ? innerHeight - h - MARGEM - baixo : MARGEM + 34
  pip.dataset.canto = canto
  pip.style.left = x + 'px'; pip.style.top = Math.max(MARGEM, y) + 'px'
}

let arraste = null
pip.addEventListener('pointerdown', e => {
  if (e.target.closest('.pip-resize')) return
  pip.setPointerCapture(e.pointerId); pip.classList.add('arrastando')
  arraste = { dx: e.clientX - pip.offsetLeft, dy: e.clientY - pip.offsetTop }
})
pip.addEventListener('pointermove', e => {
  if (!arraste) return
  pip.style.left = (e.clientX - arraste.dx) + 'px'; pip.style.top = (e.clientY - arraste.dy) + 'px'
})
pip.addEventListener('pointerup', () => {
  if (!arraste) return
  arraste = null; pip.classList.remove('arrastando')
  const cx = pip.offsetLeft + pip.offsetWidth / 2; const cy = pip.offsetTop + pip.offsetHeight / 2
  canto = (cy > innerHeight / 2 ? 'inf' : 'sup') + '-' + (cx > areaW() / 2 ? 'dir' : 'esq')
  localStorage.setItem('pipCanto', canto)
  posicionar()
})

// Alça de redimensionar: fica no canto do quadradinho voltado para o centro da janela
const alca = $('pipResize')
let redim = null
alca.addEventListener('pointerdown', e => {
  e.stopPropagation(); alca.setPointerCapture(e.pointerId); pip.classList.add('arrastando')
  redim = { x: e.clientX, w: pip.offsetWidth }
})
alca.addEventListener('pointermove', e => {
  if (!redim) return
  const sentido = canto.endsWith('dir') ? -1 : 1 // puxando para o centro aumenta
  largura = redim.w + sentido * (e.clientX - redim.x)
  posicionar()
})
alca.addEventListener('pointerup', () => {
  if (!redim) return
  redim = null; pip.classList.remove('arrastando')
  localStorage.setItem('pipLargura', String(Math.round(pip.offsetWidth)))
})
pip.addEventListener('dblclick', e => { if (!e.target.closest('.pip-resize')) { largura = 0; localStorage.removeItem('pipLargura'); posicionar() } })
addEventListener('resize', posicionar)

// ---------- Controles somem com o mouse parado ----------
let ocioso
function acordar () {
  const estava = document.body.classList.contains('ocioso')
  document.body.classList.remove('ocioso'); clearTimeout(ocioso)
  if (estava) posicionar()
  ocioso = setTimeout(() => { if (!arraste && !redim) { document.body.classList.add('ocioso'); posicionar() } }, 3000)
}
addEventListener('mousemove', acordar); addEventListener('keydown', acordar); acordar()

// Atalhos: M = microfone, V = câmera, F = tela cheia
addEventListener('keydown', e => {
  if (e.target && e.target.tagName === 'INPUT') return
  const k = e.key.toLowerCase()
  if (k === 'm') $('mic').click()
  if (k === 'v') $('cam').click()
  if (k === 'f') api.chamada.janela('tela-cheia')
})

posicionar()
atualizarPip()

// ---------- Estado da chamada (vem do processo principal) ----------
window.ssadeskMidia.ligar($('remoto'))
let inicio = 0; let relogio = null; let remotoCam = false
const textos = { aguardando: 'Aguardando o outro lado', procurando: 'Chamando…', conectado: 'Câmera desligada', encerrada: 'Chamada encerrada' }
function mostrarPlaceholder () { $('aguardando').classList.toggle('oculto', remotoCam) }
function aplicarEstado (s) {
  if (s.nome) $('nome').textContent = s.nome
  $('estado').textContent = textos[s.fase] || ''
  document.body.dataset.fase = s.fase
  if (s.fase === 'conectado') {
    informarEstado(); window.ssadeskMidia.pedirQuadroChave()
    if (params.get('autoteste') === '1' && !aplicarEstado.testado) { aplicarEstado.testado = true; setTimeout(() => { $('cam').click(); $('mic').click() }, 1500) }
    if (!inicio) { inicio = Date.now(); relogio = setInterval(() => { const s = Math.floor((Date.now() - inicio) / 1000); $('tempo').textContent = Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0') }, 1000) }
  } else {
    if (s.fase === 'encerrada') { clearInterval(relogio); inicio = 0; $('tempo').textContent = ''; remotoCam = false; window.ssadeskMidia.pararRecebimento(); mostrarPlaceholder() }
  }
}
api.chamada.onEstado(aplicarEstado)
api.chamada.estadoAtual().then(aplicarEstado) // estado que chegou antes de a janela terminar de abrir
api.chamada.onRemoto(({ mic, cam, tela }) => {
  document.body.classList.toggle('vendo-tela', !!tela)
  remotoCam = cam
  if (!cam) window.ssadeskMidia.pararRecebimento()
  $('estado').textContent = cam ? '' : (mic ? 'Microfone ligado · câmera desligada' : textos.conectado)
  mostrarPlaceholder()
})
window.addEventListener('ssadesk-video-remoto', () => { if (!remotoCam) { remotoCam = true; mostrarPlaceholder() } })
api.chamada.onQuadroChave(() => window.ssadeskMidia.pedirQuadroChave())