// SSAdesk — "Fulano deseja conectar": Permitir / Negar, com as permissões (tudo liberado por padrão)
const $ = id => document.getElementById(id)
const pedido = window.ssadesk.pedido

function permissoes () {
  const p = {}
  document.querySelectorAll('[data-perm]').forEach(c => { p[c.dataset.perm] = c.checked })
  return p
}
$('permitir').addEventListener('click', () => pedido.responder({ permitir: true, permissoes: permissoes(), sempre: $('sempre').checked }))
$('negar').addEventListener('click', () => pedido.responder({ permitir: false }))

// Toque de chamada (gerado na hora, sem arquivo de áudio)
function tocar () {
  const ctx = new AudioContext()
  const bip = t => { for (const f of [880, 1320]) { const o = ctx.createOscillator(); const g = ctx.createGain(); o.frequency.value = f; o.connect(g); g.connect(ctx.destination)
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.08, t + 0.02); g.gain.setValueAtTime(0.08, t + 0.35); g.gain.linearRampToValueAtTime(0, t + 0.4); o.start(t); o.stop(t + 0.45) } }
  const ciclo = () => { const t = ctx.currentTime; bip(t); bip(t + 0.5) }
  ciclo(); setInterval(ciclo, 2500)
}
pedido.dados().then(d => {
  if (!d) return
  const nome = d.nome || 'Alguém'
  $('nome').textContent = nome
  $('inicial').textContent = (nome.trim()[0] || '?').toUpperCase()
  if (d.codigo) $('sub').textContent = 'ao seu computador · código ' + String(d.codigo).replace(/(\d{3})(?=\d)/g, '$1 ')
  if (d.tipo === 'chamada') { // só uma ligação: sem acesso à tela, sem permissões para escolher
    document.body.classList.add('ligacao')
    $('titulo').textContent = nome
    $('sub').textContent = 'Ligação SSAdesk…'
    const DESLIGAR = '<svg viewBox="0 0 24 24"><path d="M3.2 14.6c-.4-.4-.4-1.1 0-1.5C5.6 10.8 8.7 9.6 12 9.6s6.4 1.2 8.8 3.5c.4.4.4 1.1 0 1.5l-1.7 1.7c-.4.4-1 .4-1.4.1l-2-1.5a1 1 0 0 1-.4-.8v-2.1a10 10 0 0 0-6.6 0v2.1c0 .3-.2.6-.4.8l-2 1.5c-.4.3-1 .3-1.4-.1z"/></svg>'
    const ATENDER = '<svg viewBox="0 0 24 24"><path d="M5 4.5h3.2l1.6 4-2 1.3a10.5 10.5 0 0 0 6.4 6.4l1.3-2 4 1.6V19a1.5 1.5 0 0 1-1.6 1.5A15.5 15.5 0 0 1 3.5 6.1 1.5 1.5 0 0 1 5 4.5z"/></svg>'
    $('negar').innerHTML = DESLIGAR + '<span>Recusar</span>'; $('permitir').innerHTML = ATENDER + '<span>Atender</span>'
    tocar(); $('permitir').focus(); return
  }
  // Permissões já vêm como definidas nos Ajustes
  document.querySelectorAll('[data-perm]').forEach(c => { if (d.permissoes && c.dataset.perm in d.permissoes) c.checked = !!d.permissoes[c.dataset.perm] })
  // Sem resposta, permite sozinho (computador sem ninguém na frente); a senha continua sendo exigida
  if (!d.codigo) $('sempre').closest('.sempre').hidden = true // sem código não dá para reconhecer depois
  $('sempre').addEventListener('change', () => pedido.adiar())
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
