// SSAdesk — sessão P2P entre dois computadores (Hyperswarm), sem servidor.
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

// Retransmissores SSAdesk se anunciam neste tópico (rede de retransmissão sem servidor central)
const TOPICO_RETRANSMISSORES = crypto.createHash('sha256').update('ssadesk-retransmissores-v1').digest()
const PORTA_P2P = 21130 // porta UDP fixa: permite abrir no roteador (UPnP) e ficar alcançável direto

// Confere (de forma síncrona) se a porta UDP está livre, abrindo e fechando um socket de teste
function portaUdpLivre (porta) {
  try { require('child_process').execFileSync(process.execPath, ['-e', 'const s=require("dgram").createSocket("udp4");s.on("error",()=>process.exit(1));s.bind(' + porta + ',()=>{s.close();process.exit(0)})'], { env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' }, timeout: 3000, windowsHide: true }); return true } catch { return false }
}

class Canal extends EventEmitter {
  // opcoes: { chaveRetransmissor (seed 32 bytes), retransmitir (bool), forcarRetransmissao (bool, testes), retransmissoresExtra ([hex]) }
  constructor (Hyperswarm, opcoes = {}) {
    super()
    this.Hyperswarm = Hyperswarm
    this.opcoes = opcoes
    this.swarm = null
    this.conexao = null // uma sessão por vez
    this.escutas = new Set()
    this.procurando = null
    this.retransmissores = new Set((opcoes.retransmissoresExtra || []).filter(k => /^[0-9a-f]{64}$/i.test(k)))
    this.meuRetransmissor = null
  }

  _swarm () {
    if (this.swarm) return this.swarm
    const base = {
      // Se o furo direto falhar (ex.: dois lados em 4G/5G com NAT aleatório), passa pela retransmissão
      relayThrough: (forcar, swarm) => {
        if (!(forcar || this.opcoes.forcarRetransmissao || swarm.dht.randomized)) return null
        return this.escolherRetransmissor()
      }
    }
    // Porta UDP fixa (abrível no roteador). Se estiver ocupada, a rede nunca ficaria pronta: confere antes e usa outra.
    const porta = this.opcoes.porta === undefined ? PORTA_P2P : this.opcoes.porta
    this.swarm = new this.Hyperswarm(porta && portaUdpLivre(porta) ? { ...base, port: porta } : base)
    this.swarm.on('connection', (sock, info) => this._nova(sock, info))
    this._iniciarRetransmissao().catch(() => {})
    return this.swarm
  }

  // ---------- Rede de retransmissão ----------
  escolherRetransmissor () {
    const lista = [...this.retransmissores].filter(k => !this.meuRetransmissor || k !== this.meuRetransmissor)
    return lista.length ? Buffer.from(lista[Math.floor(Math.random() * lista.length)], 'hex') : null
  }

  async _iniciarRetransmissao () {
    const dht = this.swarm.dht
    await dht.ready()
    // Descobre retransmissores já existentes (e atualiza a cada 10 min)
    const descobrir = async () => {
      try {
        for await (const d of dht.lookup(TOPICO_RETRANSMISSORES)) {
          for (const p of (d.peers || [])) if (p.publicKey) this.retransmissores.add(p.publicKey.toString('hex'))
          if (this.retransmissores.size > 40) break
        }
      } catch {}
    }
    descobrir(); setInterval(descobrir, 10 * 60 * 1000).unref()

    // Vira retransmissor se a rede deste computador permite (NAT não aleatório) e o ajuste estiver ligado
    if (this.opcoes.retransmitir === false) return
    await new Promise(r => setTimeout(r, 5000)) // tempo para o nó descobrir o tipo de NAT
    if (dht.randomized) return
    const BlindRelay = require('blind-relay')
    const semente = this.opcoes.chaveRetransmissor && Buffer.from(this.opcoes.chaveRetransmissor, 'hex')
    const par = require('hyperdht').keyPair(semente || undefined)
    const relay = new BlindRelay.Server({ createStream: opts => dht.createRawStream({ ...opts, framed: true }) })
    const servidor = dht.createServer({ shareLocalAddress: false }, socket => {
      const sessao = relay.accept(socket, { id: socket.remotePublicKey })
      sessao.on('error', () => {})
      socket.on('error', () => {})
    })
    await servidor.listen(par)
    this.meuRetransmissor = par.publicKey.toString('hex')
    const anunciar = () => dht.announce(TOPICO_RETRANSMISSORES, par).finished().catch(() => {})
    anunciar(); setInterval(anunciar, 10 * 60 * 1000).unref()
    this.emit('retransmissor', this.meuRetransmissor)
  }

  // Diagnóstico de NAT deste computador (para a tela de rede)
  tipoDeRede () {
    const d = this.swarm && this.swarm.dht
    if (!d) return null
    return { firewalled: d.firewalled, randomized: d.randomized, host: d.host, port: d.port, retransmissores: this.retransmissores.size, souRetransmissor: !!this.meuRetransmissor }
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
    // Sessão "fantasma": o outro lado sumiu sem se despedir (ficou sem sinal de vida). Libera para a nova.
    if (this.conexao && (this.conexao.destroyed || Date.now() - (this.conexao._ultimoSinal || 0) > 30000)) {
      const velha = this.conexao; this.conexao = null; try { velha.destroy() } catch {}
      this.emit('desconectado')
    }
    // O mesmo computador voltando (reconexão): a conexão nova substitui a antiga
    const chaveNova = sock.remotePublicKey && sock.remotePublicKey.toString('hex')
    if (this.conexao && chaveNova && this.conexao.remotePublicKey && this.conexao.remotePublicKey.toString('hex') === chaveNova) {
      const velha = this.conexao; this.conexao = null; try { velha.destroy() } catch {}
      this.emit('desconectado')
    }
    if (this.conexao) { // já em sessão: avisa quem tentou (em vez de só derrubar) e fecha
      try { const j = Buffer.from(JSON.stringify({ t: 'ocupado' }), 'utf8'); const h = Buffer.alloc(5); h[0] = TIPO.CONTROLE; h.writeUInt32BE(j.length, 1); sock.write(Buffer.concat([h, j])) } catch {}
      setTimeout(() => sock.destroy(), 400); return
    }
    this.conexao = sock
    sock._ultimoSinal = Date.now()
    // Sinal de vida a cada 10 s; sem nada do outro lado por 30 s, a sessão é encerrada (não fica "fantasma")
    sock._vivo = setInterval(() => {
      if (sock.destroyed) return clearInterval(sock._vivo)
      if (Date.now() - sock._ultimoSinal > 30000) { clearInterval(sock._vivo); try { sock.destroy() } catch {} return }
      try { const j = Buffer.from('{"t":"vivo"}', 'utf8'); const h = Buffer.alloc(5); h[0] = TIPO.CONTROLE; h.writeUInt32BE(j.length, 1); sock.write(Buffer.concat([h, j])) } catch {}
    }, 10000)
    this.cheio = false
    sock.on('drain', () => { this.cheio = false })
    let buf = Buffer.alloc(0)
    sock.on('data', d => {
      sock._ultimoSinal = Date.now()
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
      clearInterval(sock._vivo)
      if (this.conexao !== sock) return
      this.conexao = null
      this.emit('desconectado')
    }
    sock.on('close', fim)
    if (process.env.SSADESK_LOG) { const rs = sock.rawStream; require('fs').appendFileSync(process.env.SSADESK_LOG, 'sessão via ' + (rs ? rs.remoteHost + ':' + rs.remotePort : '?') + '\n') }
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

module.exports = { Canal, soDigitos, nomeComputador: () => os.hostname(), PORTA_P2P }
