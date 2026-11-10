// SSAdesk — comportamento da interface
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
  // Rede ainda sendo analisada (ou arquivo sendo regravado): confere de novo em instantes
  clearTimeout(carregar.t); if (info.status.tipo === 'desconhecido') carregar.t = setTimeout(carregar, 4000)
  setTema(info.tema)

  $('codigo').onclick = () => { if (info.codigo) { api.copiar(info.codigo.replace(/\s/g, '')); toast('Código copiado') } }
}

document.querySelectorAll('#tema button').forEach(b => {
  b.addEventListener('click', () => { setTema(b.dataset.tema); api.tema(b.dataset.tema) })
})
document.querySelectorAll('.wbtn').forEach(b => b.addEventListener('click', () => api.janela(b.dataset.acao)))

$('go').addEventListener('click', () => $('form').requestSubmit())
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

// Ligar (só chamada de vídeo, sem acesso à tela). Pela chamada dá para pedir o acesso depois, como atalho.
async function ligarPara (codigo) {
  const btn = $('ligarBtn'); const msg = $('msg')
  if (btn.classList.contains('busy')) return
  btn.classList.add('busy'); msg.className = 'hint'; msg.textContent = 'Ligando…'
  const r = await api.ligar(codigo)
  btn.classList.remove('busy')
  msg.className = 'hint ' + (r.ok ? 'ok' : 'err'); msg.textContent = r.msg
}
$('ligarBtn').addEventListener('click', () => {
  const v = $('destino').value.trim()
  if (!v) { $('destino').focus(); const m = $('msg'); m.className = 'hint'; m.textContent = 'Digite o código de quem você quer ligar, ou escolha na lista.'; return }
  ligarPara(v)
})
// O cartão "Chamada de vídeo" leva ao campo do código, pronto para ligar
if ($('chamada')) $('chamada').addEventListener('click', () => {
  $('destino').focus()
  const m = $('msg'); m.className = 'hint'; m.innerHTML = 'Digite o código e toque em <b>Ligação</b>.'
  $('ligarBtn').classList.add('destaque'); setTimeout(() => $('ligarBtn').classList.remove('destaque'), 1600)
})

// Nome opcional: salva sozinho ao sair do campo (aparece para o outro lado ao conectar)
$('nome').addEventListener('change', () => { api.nome($('nome').value); toast($('nome').value.trim() ? 'Nome salvo' : 'Nome removido') })
$('nome').addEventListener('keydown', e => { if (e.key === 'Enter') e.target.blur() })
// Andamento da conexão pelo código
api.onStatus(s => { const m = $('msg'); m.className = 'hint'; m.textContent = s })
// Código digitado com espaços (como aparece na tela) também vale
$('destino').addEventListener('input', e => { const v = e.target.value; if (/^[\d\s]+$/.test(v)) e.target.value = v.replace(/\D/g, '').replace(/(\d{3})(?=\d)/g, '$1 ').slice(0, 11) })

// ---------- Ajustes ----------
async function abrirAjustes () {
  const a = await api.ajustes.ler()
  document.querySelectorAll('input[name=receber]').forEach(r => { r.checked = r.value === a.receber })
  document.querySelectorAll('[data-aj-perm]').forEach(c => { c.checked = !!a.permissoes[c.dataset.ajPerm] })
  $('ajIniciar').checked = a.iniciar
  $('ajRetransmitir').checked = a.retransmitir
  document.body.classList.add('ajustes-aberto'); $('ajustes').setAttribute('aria-hidden', 'false')
}
function fecharAjustes () { document.body.classList.remove('ajustes-aberto'); $('ajustes').setAttribute('aria-hidden', 'true') }
$('abrirAjustes').addEventListener('click', abrirAjustes)
$('diagnostico').addEventListener('click', async () => { $('diagMsg').textContent = 'Verificando… (até 20 s)'; await api.ajustes.diagnostico(); $('diagMsg').textContent = 'Relatório salvo na Área de Trabalho' })
$('fecharAjustes').addEventListener('click', fecharAjustes)

// ---------- Senha de acesso (Ajustes) ----------
function msgSenha (texto, tipo) { const m = $('senhaMsg'); m.textContent = texto; m.className = 'senha-msg ' + (tipo || '') }
let senhaVisivel = false
$('verSenha').addEventListener('click', async () => {
  if (senhaVisivel) { $('minhaSenha').textContent = '••••••••'; $('verSenha').textContent = 'Mostrar'; senhaVisivel = false; return }
  const r = await api.senha.ver()
  if (!r.ok) return msgSenha(r.msg, 'err')
  $('minhaSenha').textContent = r.senha; $('verSenha').textContent = 'Ocultar'; senhaVisivel = true
  setTimeout(() => { if (senhaVisivel) $('verSenha').click() }, 15000) // esconde sozinha
})
$('abrirAlterar').addEventListener('click', () => { $('formAlterar').hidden = false; $('abrirAlterar').hidden = true; $('novaSenha1').focus() })
$('cancelarAlterar').addEventListener('click', () => { $('formAlterar').hidden = true; $('abrirAlterar').hidden = false; $('novaSenha1').value = ''; $('novaSenha2').value = '' })
$('formAlterar').addEventListener('submit', async e => {
  e.preventDefault()
  const a = $('novaSenha1').value; const b = $('novaSenha2').value
  if (a.length < 8) return msgSenha('A senha precisa ter ao menos 8 caracteres.', 'err')
  if (a !== b) return msgSenha('As duas senhas não são iguais.', 'err')
  $('salvarSenha').disabled = true; msgSenha('Confirme na janela de permissão do Windows…')
  const r = await api.senha.alterar(a)
  $('salvarSenha').disabled = false
  if (r.ok) { $('cancelarAlterar').click(); msgSenha('Senha alterada ✓ Quem tinha a senha antiga salva precisa da nova.', 'ok') } else msgSenha(r.msg, 'err')
})
let confirmarRevogar = null
$('revogar').addEventListener('click', async () => {
  // Pede um segundo clique para confirmar (não tem como desfazer)
  if (!confirmarRevogar) {
    $('revogar').textContent = 'Clique de novo para confirmar'
    confirmarRevogar = setTimeout(() => { $('revogar').textContent = 'Revogar acessos salvos'; confirmarRevogar = null }, 4000)
    return
  }
  clearTimeout(confirmarRevogar); confirmarRevogar = null; $('revogar').textContent = 'Revogar acessos salvos'
  const r = await api.senha.revogar()
  msgSenha(r.n ? r.n + (r.n === 1 ? ' computador perdeu' : ' computadores perderam') + ' o "Permitir sempre". Para cortar também quem salvou a senha, altere a senha.' : 'Nenhum computador com "Permitir sempre". Para cortar quem salvou a senha, altere a senha.', 'ok')
})
$('veu').addEventListener('click', fecharAjustes)
addEventListener('keydown', e => { if (e.key === 'Escape') fecharAjustes() })
// Salva na hora, a cada mudança
$('ajustes').addEventListener('change', async () => {
  const receber = (document.querySelector('input[name=receber]:checked') || {}).value
  const permissoes = {}; document.querySelectorAll('[data-aj-perm]').forEach(c => { permissoes[c.dataset.ajPerm] = c.checked })
  await api.ajustes.salvar({ receber, permissoes, iniciar: $('ajIniciar').checked, retransmitir: $('ajRetransmitir').checked })
  toast('Ajustes salvos')
})

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
    const x = document.createElement('button'); x.className = 'x acao-item'; x.title = 'Remover da lista'; x.setAttribute('aria-label', 'Remover da lista')
    x.innerHTML = '<svg viewBox="0 0 16 16"><path d="M4.5 4.5l7 7M11.5 4.5l-7 7"/></svg>'
    x.addEventListener('click', async e => { e.stopPropagation(); await api.biblioteca.remover(c.codigo); montarBiblioteca() })
    // Desligado: botão para ligar pela rede (Wake-on-LAN, por um vizinho da mesma rede)
    const ligar = document.createElement('button'); ligar.className = 'ligar'; ligar.title = 'Ligar este computador'; ligar.setAttribute('aria-label', 'Ligar este computador')
    ligar.innerHTML = '<svg viewBox="0 0 24 24"><path d="M12 3.5v8"/><path d="M7.2 6.6a7 7 0 1 0 9.6 0"/></svg>'
    ligar.addEventListener('click', async e => {
      e.stopPropagation(); ligar.disabled = true; toast('Enviando sinal para ligar…')
      const r = await api.biblioteca.acordar(c.codigo); ligar.disabled = false
      const m = $('msg'); m.className = 'hint ' + (r.ok ? 'ok' : 'err'); m.textContent = r.msg
      if (r.ok) setTimeout(montarBiblioteca, 45000)
    })
    // Ligar para ele (só chamada de vídeo)
    // Três ações em cada computador: Acesso remoto (azul), Ligação (verde) e Remover
    const acessar = document.createElement('button'); acessar.className = 'acessar acao-item'; acessar.title = 'Acesso remoto'; acessar.setAttribute('aria-label', 'Acesso remoto a ' + (c.nome || fmt(c.codigo)))
    acessar.innerHTML = '<svg viewBox="0 0 24 24"><rect x="3" y="4.5" width="18" height="12" rx="2"/><path d="M8.5 20h7M12 16.5V20"/></svg>'
    acessar.addEventListener('click', e => { e.stopPropagation(); $('destino').value = fmt(c.codigo); $('form').requestSubmit() })
    const chamar = document.createElement('button'); chamar.className = 'chamar acao-item'; chamar.title = 'Ligação'; chamar.setAttribute('aria-label', 'Ligar para ' + (c.nome || fmt(c.codigo)))
    chamar.innerHTML = '<svg viewBox="0 0 24 24"><path d="M5 4.5h3.2l1.6 4-2 1.3a10.5 10.5 0 0 0 6.4 6.4l1.3-2 4 1.6V19a1.5 1.5 0 0 1-1.6 1.5A15.5 15.5 0 0 1 3.5 6.1 1.5 1.5 0 0 1 5 4.5z"/></svg>'
    chamar.addEventListener('click', e => { e.stopPropagation(); $('destino').value = fmt(c.codigo); ligarPara(c.codigo) })
    li.append(av, tx, acessar, chamar, ligar, x)
    li.addEventListener('click', () => { $('destino').value = fmt(c.codigo); $('form').requestSubmit() })
    ul.appendChild(li)
    // Bolinha verde (online) ou vermelha (offline), verificada na rede P2P
    api.biblioteca.online(c.codigo).then(on => { li.classList.toggle('on', on); li.classList.toggle('off', !on); cd.textContent = fmt(c.codigo) + (on ? ' · online' : ' · offline') })
  }
}
api.biblioteca.onMudou(montarBiblioteca)
if (new URLSearchParams(location.search).get('pagina') === 'ajustes') setTimeout(abrirAjustes, 300)
montarBiblioteca()
setInterval(() => { if (!document.hidden) montarBiblioteca() }, 60000) // online/offline a cada minuto, só com o painel visível
api.onVisivel(() => { montarBiblioteca(); carregar() }) // ao reabrir: dados atualizados na hora

carregar()
// ---------- Altura automática do painel: a janela fica do tamanho do conteúdo ----------
function ajustarAltura () {
  const main = document.querySelector('main'); const topo = document.querySelector('.titlebar'); const rodape = document.querySelector('footer')
  if (!main) return
  const estilo = getComputedStyle(main)
  const conteudo = [...main.children].filter(el => !el.hidden && el.offsetParent !== null).reduce((t, el) => t + el.offsetHeight, 0)
  const espacos = Math.max(0, main.children.length - 1) * parseFloat(estilo.rowGap || estilo.gap || 12)
  const total = (topo ? topo.offsetHeight : 0) + parseFloat(estilo.paddingTop) + conteudo + espacos + 18 + (rodape ? rodape.offsetHeight : 0)
  api.altura(total)
}
const observaAltura = new ResizeObserver(() => { clearTimeout(ajustarAltura.t); ajustarAltura.t = setTimeout(ajustarAltura, 120) })
document.querySelectorAll('main > *').forEach(el => observaAltura.observe(el)) // cada cartão (a lista cresce, mensagens mudam)
setTimeout(ajustarAltura, 700)
