// SSADesk — na janela da chamada: a aba que abre o chat (janela própria), o som de aviso
// a cada mensagem recebida e o contador de não lidas enquanto o chat está guardado.
;(function () {
  const $ = id => document.getElementById(id)
  const body = document.body
  const chat = window.ssadesk.chat
  let naoLidas = 0

  // Som de aviso (sintetizado aqui mesmo: dois toques suaves e curtos)
  let audioCtx = null
  function tocarAviso () {
    try {
      audioCtx = audioCtx || new AudioContext()
      const agora = audioCtx.currentTime
      ;[[1046.5, 0], [1568, 0.11]].forEach(([freq, atraso]) => {
        const osc = audioCtx.createOscillator(); const g = audioCtx.createGain()
        osc.type = 'sine'; osc.frequency.value = freq
        g.gain.setValueAtTime(0, agora + atraso)
        g.gain.linearRampToValueAtTime(0.18, agora + atraso + 0.012)
        g.gain.exponentialRampToValueAtTime(0.0001, agora + atraso + 0.45)
        osc.connect(g).connect(audioCtx.destination)
        osc.start(agora + atraso); osc.stop(agora + atraso + 0.5)
      })
    } catch {}
  }

  function atualizarBadge () {
    $('badge').textContent = naoLidas > 9 ? '9+' : String(naoLidas)
    body.classList.toggle('tem-nao-lidas', naoLidas > 0)
  }

  $('chatTab').addEventListener('click', () => chat.abrir())
  addEventListener('keydown', e => {
    if (e.target && e.target.tagName === 'INPUT') return
    if (e.key.toLowerCase() === 'c') chat.abrir()
  })

  chat.onRecebida(({ visivel }) => {
    tocarAviso() // toda mensagem recebida avisa com som
    if (!visivel) { naoLidas++; atualizarBadge() }
  })
  chat.onVisivel(visivel => {
    body.classList.toggle('chat-visivel', visivel)
    $('chatTab').setAttribute('aria-expanded', String(visivel))
    if (visivel) { naoLidas = 0; atualizarBadge() }
  })
})()
