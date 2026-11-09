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
    $('titulo').textContent = nome + ' está ligando'
    $('sub').textContent = 'Chamada de vídeo · câmera e microfone começam desligados'
    $('negar').textContent = 'Recusar'; $('permitir').textContent = 'Atender'
    tocar(); $('permitir').focus(); return
  }
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
