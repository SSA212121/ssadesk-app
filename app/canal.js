// SSADesk — canal P2P da chamada (Hyperswarm), sem servidor.
// Cada computador "escuta" num tópico derivado da PRÓPRIA chave de internet.
// Quem conhece essa chave (a mesma usada para o acesso remoto) consegue chamar.
//
// Protocolo (sobre o stream criptografado do Hyperswarm), quadros:
//   [1 byte tipo][4 bytes tamanho (UInt32 BE)][dados]
//   tipo 1 = controle (JSON: ola, chat, estado, tchau)
//   tipo 2 = áudio (Opus)   tipo 3 = vídeo (VP8)
//   dados de mídia = [1 byte flags (bit0 = quadro-chave)][8 bytes timestamp µs (Float64 BE)][bytes codificados]
const crypto = require('crypto')
const os = require('os')
const { EventEmitter } = require('events')

const TIPO = { CONTROLE: 1, AUDIO: 2, VIDEO: 3 }
const topicoDe = chave => crypto.createHash('sha256').update('ssadesk-chamada:' + String(chave).toLowerCase()).digest()

class Canal extends EventEmitter {
  constructor (Hyperswarm) {
    super()
    this.Hyperswarm = Hyperswarm
    this.swarm = null
    this.conexao = null // uma chamada por vez
    this.escutando = null
    this.chamando = null
  }

  _swarm () {
    if (this.swarm) return this.swarm
    this.swarm = new this.Hyperswarm()
    this.swarm.on('connection', (sock, info) => this._nova(sock, info))
    return this.swarm
  }

  // Computador acessado: fica disponível para receber chamadas
  async escutar (minhaChave) {
    if (!/^[0-9a-f]{64}$/i.test(minhaChave || '') || this.escutando) return
    this.escutando = this._swarm().join(topicoDe(minhaChave), { server: true, client: false })
    await this.escutando.flushed()
  }

  // Quem acessa: chama o outro computador pela chave dele
  async chamar (chaveDestino) {
    if (this.conexao) return
    if (this.chamando) { await this._swarm().leave(this.chamando.topico).catch(() => {}) }
    const topico = topicoDe(chaveDestino)
    this.chamando = { topico }
    this._swarm().join(topico, { server: false, client: true })
    this.emit('estado', 'procurando')
  }

  _nova (sock, info) {
    sock.on('error', () => {})
    if (this.conexao) { sock.destroy(); return } // já em chamada
    this.conexao = sock
    this.cheio = false
    sock.on('drain', () => { this.cheio = false })
    let buf = Buffer.alloc(0)
    sock.on('data', d => {
      buf = buf.length ? Buffer.concat([buf, d]) : d
      while (buf.length >= 5) {
        const tipo = buf[0]; const n = buf.readUInt32BE(1)
        if (n > 8 * 1024 * 1024) { sock.destroy(); return } // proteção contra quadros absurdos
        if (buf.length < 5 + n) break
        const dados = buf.subarray(5, 5 + n); buf = buf.subarray(5 + n)
        if (tipo === TIPO.CONTROLE) {
          try { this.emit('controle', JSON.parse(dados.toString('utf8'))) } catch {}
        } else if (tipo === TIPO.AUDIO || tipo === TIPO.VIDEO) {
          this.emit('midia', tipo === TIPO.AUDIO ? 'audio' : 'video', Buffer.from(dados))
        }
      }
    })
    const fim = () => {
      if (this.conexao !== sock) return
      this.conexao = null
      this.emit('desconectado')
    }
    sock.on('close', fim)
    this.controle({ t: 'ola', nome: os.hostname(), lado: info.client ? 'chamou' : 'recebeu' })
    this.emit('conectado', { recebida: !info.client })
    if (this.chamando) { this._swarm().leave(this.chamando.topico).catch(() => {}); this.chamando = null }
  }

  _enviar (tipo, dados) {
    const s = this.conexao
    if (!s || s.destroyed) return false
    // Sem fila infinita: se a rede estiver congestionada, descarta mídia (nunca o controle)
    if (tipo !== TIPO.CONTROLE && this.cheio) return false
    const cab = Buffer.alloc(5); cab[0] = tipo; cab.writeUInt32BE(dados.length, 1)
    if (!s.write(Buffer.concat([cab, dados]))) this.cheio = true
    return true
  }
  controle (obj) { return this._enviar(TIPO.CONTROLE, Buffer.from(JSON.stringify(obj), 'utf8')) }
  midia (tipo, dados) { return this._enviar(tipo === 'audio' ? TIPO.AUDIO : TIPO.VIDEO, Buffer.from(dados)) }

  encerrar () {
    if (this.conexao) { this.controle({ t: 'tchau' }); const s = this.conexao; setTimeout(() => s.destroy(), 200) }
    if (this.chamando) { this._swarm().leave(this.chamando.topico).catch(() => {}); this.chamando = null }
  }

  async destruir () { if (this.swarm) await this.swarm.destroy().catch(() => {}) }
}

module.exports = { Canal }
