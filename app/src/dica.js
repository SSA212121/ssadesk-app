// SSAdesk — dica (tooltip) própria, arredondada e de vidro, no lugar da dica quadrada do Windows.
// Pega qualquer elemento com title (inclusive os criados depois), guarda o texto e mostra uma pílula.
;(function () {
  // Visual em dica.css (as telas não aceitam estilo criado no código)
  const estilo = document.createElement('link'); estilo.rel = 'stylesheet'; estilo.href = 'dica.css'
  document.head.appendChild(estilo)

  let dica = null
  let alvo = null
  let tempo = null

  function texto (el) {
    // Move o title para data-dica: assim o Windows nunca desenha a caixa quadrada
    if (el.hasAttribute('title')) { el.dataset.dica = el.getAttribute('title'); el.removeAttribute('title') }
    return el.dataset.dica || ''
  }
  function esconder () {
    clearTimeout(tempo); alvo = null
    if (dica) dica.classList.remove('mostra')
  }
  function mostrar (el) {
    const t = texto(el); if (!t) return
    if (!dica) { dica = document.createElement('div'); dica.className = 'ssa-dica'; document.body.appendChild(dica) }
    dica.textContent = t
    const r = el.getBoundingClientRect()
    const w = dica.offsetWidth; const h = dica.offsetHeight
    let x = r.left + r.width / 2 - w / 2
    let y = r.bottom + 8
    if (y + h > innerHeight - 4) y = r.top - h - 8 // sem espaço embaixo: aparece em cima
    x = Math.max(6, Math.min(x, innerWidth - w - 6))
    dica.style.left = x + 'px'; dica.style.top = y + 'px'
    dica.classList.add('mostra')
  }

  addEventListener('mouseover', e => {
    const el = e.target.closest && e.target.closest('[title], [data-dica]')
    if (!el || el === alvo) return
    esconder(); alvo = el; texto(el)
    tempo = setTimeout(() => { if (alvo === el) mostrar(el) }, 550)
  }, true)
  addEventListener('mouseout', e => {
    if (alvo && (!e.relatedTarget || !alvo.contains(e.relatedTarget))) esconder()
  }, true)
  addEventListener('mousedown', esconder, true)
  addEventListener('blur', esconder)

  // Converte os title já existentes e os que forem criados depois
  const converter = raiz => raiz.querySelectorAll && raiz.querySelectorAll('[title]').forEach(texto)
  const iniciar = () => {
    converter(document)
    new MutationObserver(ms => ms.forEach(m => {
      if (m.type === 'attributes' && m.target.hasAttribute('title')) texto(m.target)
      m.addedNodes && m.addedNodes.forEach(n => { if (n.nodeType === 1) { if (n.hasAttribute('title')) texto(n); converter(n) } })
    })).observe(document.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: ['title'] })
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar); else iniciar()
})()
