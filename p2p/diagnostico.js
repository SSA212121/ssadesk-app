// SSADesk - diagnóstico do túnel P2P.
// Uso: node diagnostico.js <chave-de-internet-do-outro-computador>
// Mostra o tipo de NAT desta rede e tenta abrir o túnel até o outro computador, explicando o resultado.
const path = require('path')
const base = process.env.SSADESK_P2P || __dirname
const DHT = require(path.join(base, 'node_modules', 'hyperdht'))

const key = (process.argv[2] || '').trim().toLowerCase()
if (!/^[0-9a-f]{64}$/.test(key)) {
  console.log('Chave inválida. Ela tem 64 letras e números (0-9, a-f).')
  process.exit(1)
}

function tipoNat (d) {
  if (!d.firewalled) return 'aberta (sem bloqueio)'
  if (d.randomized) return 'restrita (NAT aleatório/simétrico, comum em 4G)'
  return 'com bloqueio, mas consistente (bom para P2P)'
}

async function main () {
  const dht = new DHT()
  console.log('1) Entrando na rede P2P...')
  await dht.ready()
  await new Promise(r => setTimeout(r, 4000))
  console.log('   IP público visto pela rede P2P: ' + dht.host)
  console.log('   Tipo de rede deste computador: ' + tipoNat(dht))

  console.log('2) Procurando o outro computador pela chave e abrindo o túnel (até 60s)...')
  const t0 = Date.now()
  const sock = dht.connect(Buffer.from(key, 'hex'))
  const timer = setTimeout(() => { sock.destroy(new Error('tempo esgotado (60s)')) }, 60000)
  try {
    await new Promise((resolve, reject) => {
      sock.once('open', resolve)
      sock.once('error', reject)
      sock.once('close', () => reject(new Error('conexão fechada antes de abrir')))
    })
    console.log('   OK! Túnel aberto em ' + ((Date.now() - t0) / 1000).toFixed(1) + 's.')
    console.log('   Caminho: ' + (sock.rawStream && sock.rawStream.remoteHost ? sock.rawStream.remoteHost + ':' + sock.rawStream.remotePort : 'direto P2P'))
    console.log('RESULTADO: o túnel funciona daqui. Se o SSADesk ainda falhar, o problema é no atalho/RustDesk, não na rede.')
  } catch (e) {
    const m = String(e && (e.code || e.message) || e)
    console.log('   FALHOU: ' + m)
    if (/PEER_NOT_FOUND/.test(m)) console.log('RESULTADO: o outro computador não foi encontrado. Ele está ligado, com internet e com o SSADesk instalado? A chave está certa?')
    else if (/HOLEPUNCH|PEER_CONNECTION_FAILED|tempo esgotado/i.test(m)) console.log('RESULTADO: os dois se acharam, mas as redes não deixaram o túnel passar (NAT restrito dos dois lados).')
    else console.log('RESULTADO: erro inesperado (veja a mensagem acima).')
  } finally {
    clearTimeout(timer)
    sock.destroy()
    await dht.destroy()
  }
}
main().catch(e => { console.log('Erro: ' + e.message); process.exit(1) })
