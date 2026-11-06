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

// ---------- Biblioteca de conexões ----------
const fmt = c => String(c).replace(/(\d{3})(?=\d)/g, '$1 ')
async function montarBiblioteca () {
  const lista = await api.biblioteca.listar()
  $('recentes').hidden = !lista.length
  const ul = $('lista'); ul.innerHTML = ''
  for (const c of lista) {
    const li = document.createElement('li'); li.className = 'item'; li.title = 'Conectar a ' + (c.nome || fmt(c.codigo))
    const av = document.createElement('span'); av.className = 'av'; av.textContent = ((c.nome || '#').trim()[0] || '#').toUpperCase(); av.appendChild(document.createElement('i'))
    const tx = document.createElement('span'); tx.className = 'tx'
    const nm = document.createElement('span'); nm.className = 'nm'; nm.textContent = c.nome || 'Computador'
    const cd = document.createElement('span'); cd.className = 'cd'; cd.textContent = fmt(c.codigo)
    tx.append(nm, cd)
    const x = document.createElement('button'); x.className = 'x'; x.setAttribute('aria-label', 'Remover da lista')
    x.innerHTML = '<svg viewBox="0 0 16 16"><path d="M4.5 4.5l7 7M11.5 4.5l-7 7"/></svg>'
    x.addEventListener('click', async e => { e.stopPropagation(); await api.biblioteca.remover(c.codigo); montarBiblioteca() })
    li.append(av, tx, x)
    li.addEventListener('click', () => { $('destino').value = fmt(c.codigo); $('form').requestSubmit() })
    ul.appendChild(li)
    // Bolinha verde (online) ou vermelha (offline), verificada na rede P2P
    api.biblioteca.online(c.codigo).then(on => { li.classList.toggle('on', on); li.classList.toggle('off', !on); cd.textContent = fmt(c.codigo) + (on ? ' · online' : ' · offline') })
  }
}
api.biblioteca.onMudou(montarBiblioteca)
montarBiblioteca()
setInterval(montarBiblioteca, 60000) // atualiza o online/offline a cada minuto

carregar()