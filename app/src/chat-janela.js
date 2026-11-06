// SSADesk — janela de mensagens. As mensagens ficam no processo principal,
// então fechar ("guardar") esta janela não apaga a conversa.
const $ = id => document.getElementById(id)
const chat = window.ssadesk.chat
let ultimaHora = 0

function adicionar ({ texto, quem, hora }) {
  $('vazio')?.remove()
  if (hora - ultimaHora > 5 * 60 * 1000) {
    const h = document.createElement('li'); h.className = 'hora'
    h.textContent = new Date(hora).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    $('msgs').appendChild(h)
  }
  ultimaHora = hora
  const li = document.createElement('li'); li.className = 'msg ' + quem
  li.textContent = texto // texto puro: nunca interpreta HTML vindo do outro lado
  $('msgs').appendChild(li)
  $('msgs').scrollTop = $('msgs').scrollHeight
}

chat.onMsg(adicionar)
chat.historico().then(lista => lista.forEach(adicionar))

$('chatTexto').addEventListener('input', () => { $('enviar').disabled = !$('chatTexto').value.trim() })
$('chatForm').addEventListener('submit', e => {
  e.preventDefault()
  const texto = $('chatTexto').value.trim()
  if (!texto) return
  chat.enviar(texto)
  $('chatTexto').value = ''; $('enviar').disabled = true
})
addEventListener('keydown', e => { if (e.key === 'Escape') chat.janela('guardar') })
addEventListener('focus', () => $('chatTexto').focus())
document.querySelectorAll('.wbtn').forEach(b => b.addEventListener('click', () => chat.janela(b.dataset.acao)))
$('chatTexto').focus()
