// SSAdesk — motor de instalação em linha de comando (roda no SSAdesk.exe em modo Node).
// Usado pela janela leve de instalação (SetupUI.exe): recebe os dados por stdin (JSON, inclusive a senha,
// que nunca vai na linha de comando) e devolve o progresso em linhas JSON pelo stdout.
const motor = require('./instalador')

let entrada = ''
process.stdin.setEncoding('utf8')
process.stdin.on('data', d => { entrada += d })
process.stdin.on('end', async () => {
  const saida = obj => process.stdout.write(JSON.stringify(obj) + '\n')
  try {
    const dados = JSON.parse(entrada)
    const r = await motor.instalar(dados, ev => saida(ev))
    saida({ ok: true, codigo: r.codigo, exe: r.exe })
  } catch (e) {
    saida({ ok: false, msg: String((e && e.message) || e).slice(0, 220) })
  }
  process.exit(0)
})
