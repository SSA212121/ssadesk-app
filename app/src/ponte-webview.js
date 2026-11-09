// SSAdesk — ponte das telas de instalação quando abertas pela janela leve (WebView2 do Windows).
// No app (Electron) esta ponte não faz nada: lá o window.ssadesk vem do preload.js.
;(function () {
  const wv = window.chrome && window.chrome.webview
  if (!wv || window.ssadesk) return
  let seq = 0
  const pendentes = new Map()
  const ouvintes = { passo: [] }
  wv.addEventListener('message', e => {
    const m = e.data || {}
    if (m.id !== undefined && pendentes.has(m.id)) { pendentes.get(m.id)(m.resultado); pendentes.delete(m.id) }
    if (m.evento === 'passo') ouvintes.passo.forEach(cb => cb(m.valor))
  })
  const chamar = (acao, dados) => new Promise(resolve => { const id = ++seq; pendentes.set(id, resolve); wv.postMessage({ id, acao, dados }) })
  window.ssadesk = {
    janela: acao => wv.postMessage({ acao: 'janela', dados: acao }),
    setup: {
      info: () => chamar('info'),
      escolherPasta: atual => chamar('pasta', atual),
      instalar: dados => chamar('instalar', dados),
      abrirApp: () => chamar('abrir'),
      desinstalar: () => Promise.resolve(true),
      onPasso: cb => ouvintes.passo.push(cb)
    }
  }
})()
