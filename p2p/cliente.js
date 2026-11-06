// SSADesk - cliente do túnel P2P (compatível com o hypertele-server do outro lado).
// Diferença do hypertele: abre o túnel ANTES de o SSADesk conectar e mantém sempre uma
// conexão reserva pronta. Assim o SSADesk não fica reiniciando enquanto o túnel "fura" o CGNAT.
//
// Uso: node cliente.js <chave-de-internet>
// Saída (uma linha por evento, para o atalho ler):
//   STATUS <texto>   andamento, em português
//   PRONTO <porta>   túnel aberto; conecte o SSADesk em 127.0.0.1:<porta>
//   ERRO <texto>     não foi possível abrir o túnel
const path = require('path')
const net = require('net')
const base = process.env.SSADESK_P2P || __dirname
const DHT = require(path.join(base, 'node_modules', 'hyperdht'))

const key = (process.argv[2] || '').trim().toLowerCase()
if (!/^[0-9a-f]{64}$/.test(key)) { console.log('ERRO Chave inválida'); process.exit(1) }
const peer = Buffer.from(key, 'hex')
const LIMITE_MS = 120000

const dht = new DHT({ connectionKeepAlive: 5000 })
let reserva = null // conexão P2P já aberta, esperando o SSADesk

function abrir () {
  return new Promise((resolve, reject) => {
    const s = dht.connect(peer, { reusableSocket: true })
    const falha = e => { s.removeListener('open', ok); reject(e || new Error('fechada')) }
    const ok = () => { s.removeListener('error', falha); s.removeListener('close', falha); resolve(s) }
    s.once('open', ok)
    s.once('error', falha)
    s.once('close', falha)
  })
}

// Tenta abrir até conseguir (ou até o limite), avisando o andamento
async function abrirComTentativas () {
  const inicio = Date.now()
  let n = 0
  for (;;) {
    n++
    try {
      return await abrir()
    } catch (e) {
      const code = (e && (e.code || e.message)) || 'erro'
      if (Date.now() - inicio > LIMITE_MS) throw new Error(code)
      console.log('STATUS Atravessando as redes (tentativa ' + (n + 1) + ')...')
      await new Promise(r => setTimeout(r, 1000))
    }
  }
}

function prepararReserva () {
  abrirComTentativas().then(s => {
    reserva = s
    s.once('close', () => { if (reserva === s) { reserva = null; prepararReserva() } })
  }).catch(() => setTimeout(prepararReserva, 3000))
}

function ligar (local, remoto) {
  local.pipe(remoto).pipe(local)
  const fim = () => { local.destroy(); remoto.destroy() }
  local.on('error', fim).on('close', fim)
  remoto.on('error', fim).on('close', fim)
}

async function main () {
  console.log('STATUS Entrando na rede P2P...')
  await dht.ready()
  console.log('STATUS Procurando o outro computador...')
  try {
    reserva = await abrirComTentativas()
  } catch (e) {
    const m = String(e.message)
    console.log('ERRO ' + (/PEER_NOT_FOUND/.test(m)
      ? 'O outro computador não foi encontrado. Ele está ligado e com internet? A chave está certa?'
      : 'As redes não deixaram o túnel passar (' + m + ').'))
    await dht.destroy()
    process.exit(2)
  }

  const server = net.createServer({ allowHalfOpen: true }, async local => {
    let remoto = reserva
    reserva = null
    if (!remoto || remoto.destroyed) {
      local.pause()
      try { remoto = await abrirComTentativas() } catch { local.destroy(); return }
      local.resume()
    }
    ligar(local, remoto)
    prepararReserva() // já deixa a próxima pronta (o SSADesk pode abrir mais de uma conexão)
  })
  server.listen(0, '127.0.0.1', () => {
    console.log('PRONTO ' + server.address().port)
  })
}

process.on('SIGINT', async () => { await dht.destroy(); process.exit(0) })
main().catch(e => { console.log('ERRO ' + e.message); process.exit(1) })
