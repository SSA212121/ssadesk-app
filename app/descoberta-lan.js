// SSADesk — descoberta na rede local (sem internet, sem servidor), como o mDNS/Bonjour faz.
// Quem procura manda "quem é o código X?" em broadcast UDP; o computador com esse código responde
// direto com o endereço dele. Só o endereço e a porta: o acesso continua exigindo a senha.
const dgram = require('dgram')
const os = require('os')

const PORTA = 21131
const MAGICO = 'ssadesk1'
const soDigitos = c => String(c || '').replace(/\D/g, '')

// Endereços de broadcast de cada placa de rede (ex.: 192.168.3.255) + o geral
function enderecosBroadcast () {
  const lista = new Set(['255.255.255.255'])
  for (const ifs of Object.values(os.networkInterfaces())) {
    for (const i of ifs || []) {
      if (i.family !== 'IPv4' || i.internal || !i.netmask) continue
      const ip = i.address.split('.').map(Number); const m = i.netmask.split('.').map(Number)
      lista.add(ip.map((o, k) => (o & m[k]) | (~m[k] & 255)).join('.'))
    }
  }
  return [...lista]
}

class DescobertaLan {
  constructor ({ meuCodigo, meuNome, minhaPorta }) {
    this.meuCodigo = meuCodigo; this.meuNome = meuNome; this.minhaPorta = minhaPorta || (() => 21118)
    this.esperas = new Map() // codigo -> [resolve]
    this.sock = null
  }

  iniciar () {
    if (this.sock) return
    const s = dgram.createSocket({ type: 'udp4', reuseAddr: true })
    s.on('error', () => { try { s.close() } catch {} ; this.sock = null })
    s.on('message', (buf, rinfo) => this._mensagem(buf, rinfo))
    s.bind(PORTA, () => { try { s.setBroadcast(true) } catch {} })
    this.sock = s
  }

  _mensagem (buf, rinfo) {
    let m; try { m = JSON.parse(buf.toString('utf8')) } catch { return }
    if (!m || m.m !== MAGICO) return
    const meu = soDigitos(this.meuCodigo())
    if (m.t === 'quem' && meu && soDigitos(m.codigo) === meu) {
      // Responde direto para quem perguntou, com o endereço de onde a pergunta chegou na mesma rede
      const resp = Buffer.from(JSON.stringify({ m: MAGICO, t: 'eu', codigo: meu, nome: this.meuNome(), porta: this.minhaPorta() }))
      this.sock.send(resp, rinfo.port, rinfo.address)
    }
    if (m.t === 'eu') {
      const c = soDigitos(m.codigo)
      const espera = this.esperas.get(c)
      if (espera) { this.esperas.delete(c); espera.forEach(r => r({ ip: rinfo.address, porta: Number(m.porta) || 21118, nome: String(m.nome || '').slice(0, 40) })) }
    }
  }

  // Procura o código na rede local; resolve com { ip, porta, nome } ou null
  procurar (codigo, ms = 2500) {
    const c = soDigitos(codigo)
    this.iniciar()
    return new Promise(resolve => {
      const lista = this.esperas.get(c) || []
      lista.push(resolve); this.esperas.set(c, lista)
      const pergunta = Buffer.from(JSON.stringify({ m: MAGICO, t: 'quem', codigo: c }))
      const enviar = () => { if (!this.sock) return; for (const b of enderecosBroadcast()) { try { this.sock.send(pergunta, PORTA, b) } catch {} } }
      enviar(); const rep = setInterval(enviar, 700) // repete: UDP pode perder pacotes
      setTimeout(() => {
        clearInterval(rep)
        const l = this.esperas.get(c); if (l) { const i = l.indexOf(resolve); if (i >= 0) l.splice(i, 1); if (!l.length) this.esperas.delete(c) }
        resolve(null)
      }, ms)
      // limpa o intervalo quando alguém responder
      const original = resolve
      lista[lista.length - 1] = v => { clearInterval(rep); original(v) }
    })
  }

  parar () { if (this.sock) { try { this.sock.close() } catch {} this.sock = null } }
}

module.exports = { DescobertaLan, PORTA_LAN: PORTA }
