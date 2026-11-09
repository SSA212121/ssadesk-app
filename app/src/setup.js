// SSAdesk — telas de instalação/desinstalação
const $ = id => document.getElementById(id)
const api = window.ssadesk
const params = new URLSearchParams(location.search)
document.body.classList.add('platform-' + (params.get('platform') || ''))

let atual = null
let ocupado = false
function ir (nome) {
  const nova = document.querySelector(`.page[data-page="${nome}"]`)
  if (!nova || nova === atual) return
  if (atual) { atual.classList.remove('ativa'); atual.classList.add('saiu'); const a = atual; setTimeout(() => a.classList.remove('saiu'), 600) }
  nova.classList.add('ativa'); atual = nova
  const foco = nova.querySelector('input, .btn.primary, .btn.danger'); if (foco) setTimeout(() => foco.focus(), 350)
}

document.querySelectorAll('[data-ir]').forEach(b => b.addEventListener('click', () => ir(b.dataset.ir)))
document.querySelectorAll('[data-acao-fechar]').forEach(b => b.addEventListener('click', () => api.janela('fechar')))
document.querySelectorAll('.wbtn').forEach(b => b.addEventListener('click', () => {
  if (b.dataset.acao === 'fechar' && ocupado) return // não fecha no meio da instalação
  api.janela(b.dataset.acao)
}))

// Local
let destino = 'C:\\SSAdesk'
$('alterar').addEventListener('click', async () => {
  const p = await api.setup.escolherPasta(destino)
  if (p) { destino = p; $('pasta').textContent = p }
})

// Senha
function validar () {
  const a = $('senha1').value; const b = $('senha2').value
  const tam = a.length >= 8; const ig = tam && a === b
  $('chkTam').classList.toggle('ok', tam); $('chkIg').classList.toggle('ok', ig)
  $('instalar').disabled = !ig
  return ig
}
$('senha1').addEventListener('input', validar); $('senha2').addEventListener('input', validar)
$('senha2').addEventListener('keydown', e => { if (e.key === 'Enter' && validar()) $('instalar').click() })

// Progresso
function montarPassos (nomes) {
  $('passos').innerHTML = nomes.map(n => `<li><span class="ico"></span>${n}</li>`).join('')
}
function marcar (i) {
  [...$('passos').children].forEach((li, j) => { li.className = j < i ? 'feito' : j === i ? 'ativo' : '' })
}
api.setup.onPasso(i => marcar(i))

async function instalarAgora (manterSenha) {
  ocupado = true; ir('progresso'); marcar(0)
  const r = await api.setup.instalar(manterSenha ? { destino, senha: '', manterSenha: true } : { destino, senha: $('senha1').value })
  ocupado = false
  $('senha1').value = ''; $('senha2').value = ''; validar()
  if (r.ok) {
    marcar(99); $('codigoFinal').textContent = r.codigo || '—'
    setTimeout(() => ir('pronto'), 500)
  } else { $('erroMsg').textContent = r.msg; ir('erro') }
}
$('instalar').addEventListener('click', () => { if (validar()) instalarAgora(false) })
// Atualização: dá para manter a senha atual (sem digitar de novo)
$('manterSenha').addEventListener('click', () => instalarAgora(true))
$('abrir').addEventListener('click', () => api.setup.abrirApp())

// Desinstalar
$('remover').addEventListener('click', async () => {
  ocupado = true; ir('removendo')
  await api.setup.desinstalar()
  ocupado = false; ir('removido')
})

;(async () => {
  const info = await api.setup.info()
  destino = info.destino; $('pasta').textContent = info.destino
  $('versao').textContent = 'Versão ' + info.versao
  if (info.existente) $('manterSenha').hidden = false
  montarPassos(info.passos)
  ir(params.get('pagina') || (info.modo === 'desinstalar' ? 'remover' : 'boas'))
  if (params.get('pagina') === 'progresso') marcar(2)
})()
