// SSAdesk — "Fulano deseja conectar": Permitir / Negar, com as permissões (tudo liberado por padrão)
const $ = id => document.getElementById(id)
const pedido = window.ssadesk.pedido

function permissoes () {
  const p = {}
  document.querySelectorAll('[data-perm]').forEach(c => { p[c.dataset.perm] = c.checked })
  return p
}
$('permitir').addEventListener('click', () => pedido.responder({ permitir: true, permissoes: permissoes() }))
$('negar').addEventListener('click', () => pedido.responder({ permitir: false }))

pedido.dados().then(d => {
  if (!d) return
  const nome = d.nome || 'Alguém'
  $('nome').textContent = nome
  $('inicial').textContent = (nome.trim()[0] || '?').toUpperCase()
  if (d.codigo) $('sub').textContent = 'ao seu computador · código ' + String(d.codigo).replace(/(\d{3})(?=\d)/g, '$1 ')
  // Permissões já vêm como definidas nos Ajustes
  document.querySelectorAll('[data-perm]').forEach(c => { if (d.permissoes && c.dataset.perm in d.permissoes) c.checked = !!d.permissoes[c.dataset.perm] })
  // Sem resposta, permite sozinho (computador sem ninguém na frente); a senha continua sendo exigida
  if (!d.segundos) { $('contagem').textContent = ''; $('permitir').focus(); return }
  let s = d.segundos
  let mexeu = false
  document.querySelectorAll('[data-perm]').forEach(c => c.addEventListener('change', () => { if (!mexeu) pedido.adiar(); mexeu = true; $('contagem').textContent = '' }))
  const tick = () => {
    if (mexeu) return
    $('contagem').textContent = 'Permitindo automaticamente em ' + s + ' s'
    if (s-- > 0) setTimeout(tick, 1000)
  }
  tick()
  $('permitir').focus()
})
