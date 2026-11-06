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
  $('nome').value = info.nome || ''
  $('statusTxt').textContent = info.status.texto
  $('status').className = 'status ' + info.status.tipo
  setTema(info.tema)

  $('codigo').onclick = () => { if (info.codigo) { api.copiar(info.codigo.replace(/\s/g, '')); toast('Código copiado') } }
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
  msg.textContent = 'Conectando…'
  const r = await api.conectar(destino)
  go.classList.remove('busy')
  msg.className = 'hint ' + (r.ok ? 'ok' : 'err')
  msg.textContent = r.msg
})

$('chamada').addEventListener('click', () => api.chamada.abrir({ nome: 'Chamada de vídeo' }))

// Nome opcional: salva sozinho ao sair do campo (aparece para o outro lado ao conectar)
$('nome').addEventListener('change', () => { api.nome($('nome').value); toast($('nome').value.trim() ? 'Nome salvo' : 'Nome removido') })
$('nome').addEventListener('keydown', e => { if (e.key === 'Enter') e.target.blur() })
// Andamento da conexão pelo código
api.onStatus(s => { const m = $('msg'); m.className = 'hint'; m.textContent = s })
// Código digitado com espaços (como aparece na tela) também vale
$('destino').addEventListener('input', e => { const v = e.target.value; if (/^[\d\s]+$/.test(v)) e.target.value = v.replace(/\D/g, '').replace(/(\d{3})(?=\d)/g, '$1 ').slice(0, 11) })

carregar()
