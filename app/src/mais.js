// SSAdesk — menu "Mais opções": manda o comando para a tela remota (motor) e fecha
const api = window.ssadesk
document.querySelectorAll('[data-acao]').forEach(b => b.addEventListener('click', () => {
  const valor = b.dataset.valor || ''
  if (b.closest('.seg')) { b.parentElement.querySelectorAll('button').forEach(x => x.classList.toggle('ativo', x === b)) }
  api.mais.comando(b.dataset.acao, valor)
}))
api.mais.estado().then(e => {
  for (const [acao, valor] of Object.entries(e || {})) {
    const b = document.querySelector(`.seg [data-acao="${acao}"][data-valor="${valor}"]`)
    if (b) b.classList.add('ativo')
  }
})
addEventListener('keydown', e => { if (e.key === 'Escape') api.mais.fechar() })
