// SSADesk — comportamento da interface
const $ = id => document.getElementById(id)
const api = window.ssadesk
const plataforma = new URLSearchParams(location.search).get('platform') || ''
document.body.classList.add('platform-' + plataforma)

let toastTimer
function toast (texto) {
  const t = $('toast')
  t.textContent = texto
  t.classList.add('show')
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => t.classList.remove('show'), 1500)
}

function setTema (tema) {
  const botoes = [...document.querySelectorAll('#tema button')]
  const i = Math.max(0, botoes.findIndex(b => b.dataset.tema === tema))
  botoes.forEach((b, j) => b.setAttribute('aria-checked', String(j === i)))
  document.querySelector('#tema .thumb').style.transform = `translateX(${i * 100}%)`
}

async function carregar () {
  const info = await api.info()
  $('codigo').textContent = info.codigo || '—'
  $('chave').textContent = info.chave ? info.chave.slice(0, 12) + '…' + info.chave.slice(-12) : 'Indisponível'
  $('chave').title = info.chave || ''
  $('statusTxt').textContent = info.status.texto
  $('status').className = 'status ' + info.status.tipo
  setTema(info.tema)

  $('codigo').onclick = () => { if (info.codigo) { api.copiar(info.codigo.replace(/\s/g, '')); toast('Código copiado') } }
  $('copiarChave').onclick = () => { if (info.chave) { api.copiar(info.chave); toast('Chave copiada') } }
}

document.querySelectorAll('#tema button').forEach(b => {
  b.addEventListener('click', () => { setTema(b.dataset.tema); api.tema(b.dataset.tema) })
})
document.querySelectorAll('.wbtn').forEach(b => b.addEventListener('click', () => api.janela(b.dataset.acao)))

$('form').addEventListener('submit', async e => {
  e.preventDefault()
  const go = $('go'); const msg = $('msg')
  if (go.classList.contains('busy')) return
  const destino = $('destino').value.trim()
  if (!destino) { $('destino').focus(); return }
  go.classList.add('busy')
  msg.className = 'hint'
  msg.textContent = /^[0-9a-f]{64}$/i.test(destino.replace(/\s/g, '')) ? 'Abrindo túnel seguro…' : 'Conectando…'
  const r = await api.conectar(destino)
  go.classList.remove('busy')
  msg.className = 'hint ' + (r.ok ? 'ok' : 'err')
  msg.textContent = r.msg
})

$('chamada').addEventListener('click', () => api.chamada.abrir({ nome: 'Chamada de vídeo' }))

carregar()
