// SSADesk — sessão P2P entre dois computadores (Hyperswarm), sem servidor.
// Cada computador "escuta" num tópico derivado do PRÓPRIO CÓDIGO (9 dígitos, como no AnyDesk) e,
// por compatibilidade, também no da chave de internet. Quem digita o código encontra o computador.
// A sessão carrega: pedido de permissão, endereços para conectar, chamada (áudio/vídeo), chat e arquivos.
//
// Quadros: [1 byte tipo][4 bytes tamanho (UInt32 BE)][dados]
//   1 = controle (JSON)   2 = áudio (Opus)   3 = vídeo (VP8)   4 = arquivo (pedaço binário)
const crypto = require('crypto')
const os = require('os')
const { EventEmitter } = require('events')

const TIPO = { CONTROLE: 1, AUDIO: 2, VIDEO: 3, ARQUIVO: 4 }
const soDigitos = c => String(c || '').replace(/\D/g, '')
const topicoChave = chave => crypto.createHash('sha256').update('ssadesk-chamada:' + String(chave).toLowerCase()).digest()
const topicoCodigo = codigo => crypto.createHash('sha256').update('ssadesk-codigo:' + soDigitos(codigo)).digest()

class Canal extends EventEmitter {
  constructor (Hyperswarm) {
    super()
    this.Hyperswarm = Hyperswarm
    this.swarm = null
    this.conexao = null // uma sessão por vez
    this.escutas = new Set()
    this.procurando = null
  }

  _swarm () {
    if (this.swarm) return this.swarm
    this.swarm = new this.Hyperswarm()
    this.swarm.on('connection', (sock, info) => this._nova(sock, info))
    return this.swarm
  }

  // Fica disponível para ser encontrado pelo código (e pela chave de internet)
  async escutar ({ codigo, chave }) {
    const topicos = []
    if (soDigitos(codigo).length >= 6) topicos.push(topicoCodigo(codigo))
    if (/^[0-9a-f]{64}$/i.test(chave || '')) topicos.push(topicoChave(chave))
    for (const t of topicos) {
      const id = t.toString('hex')
      if (this.escutas.has(id)) continue
      this.escutas.add(id)
      await this._swarm().join(t, { server: true, client: false }).flushed().catch(() => {})
    }
  }

  // Procura o outro computador pelo código (ou pela chave, nas versões anteriores)
  async procurar ({ codigo, chave }) {
    if (this.conexao) return
    await this.pararProcura()
    const topico = codigo ? topicoCodigo(codigo) : topicoChave(chave)
    this.procurando = topico
    this._swarm().join(topico, { server: false, client: true })
    this.emit('estado', 'procurando')
  }
  async pararProcura () {
    if (this.procurando) { const t = this.procurando; this.procurando = null; await this._swarm().leave(t).catch(() => {}) }
  }

  _nova (sock, info) {
    sock.on('error', () => {})
    if (this.conexao) { sock.destroy(); return } // já em sessão
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
        } else if (tipo === TIPO.ARQUIVO) {
          this.emit('arquivo', Buffer.from(dados))
        }
      }
    })
    const fim = () => {
      if (this.conexao !== sock) return
      this.conexao = null
      this.emit('desconectado')
    }
    sock.on('close', fim)
    const quemChamou = !!info.client
    this.emit('conectado', { recebida: !quemChamou })
    if (quemChamou) this.pararProcura()
  }

  conectado () { return !!(this.conexao && !this.conexao.destroyed) }

  // Está online? Procura na rede P2P se o computador está anunciado pelo código (sem conectar nele)
  online (codigo, ms = 8000) {
    return new Promise(resolve => {
      let fim = false
      const terminar = v => { if (fim) return; fim = true; clearTimeout(t); try { busca.destroy() } catch {} resolve(v) }
      const busca = this._swarm().dht.lookup(topicoCodigo(codigo))
      const t = setTimeout(() => terminar(false), ms)
      busca.on('data', d => { if (d && d.peers && d.peers.length) terminar(true) })
      busca.on('end', () => terminar(false))
      busca.on('error', () => terminar(false))
    })
  }

  _enviar (tipo, dados) {
    const s = this.conexao
    if (!s || s.destroyed) return false
    // Sem fila infinita: com a rede congestionada, descarta áudio/vídeo (nunca controle nem arquivo)
    if ((tipo === TIPO.AUDIO || tipo === TIPO.VIDEO) && this.cheio) return false
    const cab = Buffer.alloc(5); cab[0] = tipo; cab.writeUInt32BE(dados.length, 1)
    if (!s.write(Buffer.concat([cab, dados]))) this.cheio = true
    return true
  }
  controle (obj) { return this._enviar(TIPO.CONTROLE, Buffer.from(JSON.stringify(obj), 'utf8')) }
  midia (tipo, dados) { return this._enviar(tipo === 'audio' ? TIPO.AUDIO : TIPO.VIDEO, Buffer.from(dados)) }
  arquivo (dados) { return this._enviar(TIPO.ARQUIVO, Buffer.from(dados)) }
  // Espera a rede escoar (usado no envio de arquivos grandes, para não lotar a memória)
  esperarVazao () { return new Promise(r => { if (!this.cheio || !this.conexao) return r(); this.conexao.once('drain', r) }) }

  encerrar () {
    if (this.conexao) { this.controle({ t: 'tchau' }); const s = this.conexao; setTimeout(() => s.destroy(), 200) }
    this.pararProcura()
  }

  async destruir () { if (this.swarm) await this.swarm.destroy().catch(() => {}) }
}

module.exports = { Canal, soDigitos, nomeComputador: () => os.hostname() }
