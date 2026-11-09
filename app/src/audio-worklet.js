// SSAdesk — processadores de áudio da chamada (rodam na thread de áudio).
//  'ssadesk-captura': junta o microfone em blocos de 20 ms (960 amostras a 48 kHz) e envia à página.
//  'ssadesk-saida'  : toca o áudio recebido com uma pequena reserva (jitter buffer) para não picotar.

class Captura extends AudioWorkletProcessor {
  constructor () { super(); this.buf = new Float32Array(960); this.n = 0 }
  process (inputs) {
    const ch = inputs[0] && inputs[0][0]
    if (ch) {
      for (let i = 0; i < ch.length; i++) {
        this.buf[this.n++] = ch[i]
        if (this.n === 960) { this.port.postMessage(this.buf.slice(0)); this.n = 0 }
      }
    }
    return true
  }
}

class Saida extends AudioWorkletProcessor {
  constructor () {
    super()
    this.tam = 48000 * 2 // 2 s de capacidade
    this.anel = new Float32Array(this.tam)
    this.ler = 0; this.escr = 0; this.cheio = 0
    this.tocando = false
    this.alvo = 48000 * 0.08  // começa a tocar com 80 ms acumulados
    this.maximo = 48000 * 0.35 // acima de 350 ms de atraso, descarta o excesso (mantém a conversa em tempo real)
    this.port.onmessage = e => this.receber(e.data)
  }
  receber (amostras) {
    for (let i = 0; i < amostras.length; i++) {
      this.anel[this.escr] = amostras[i]; this.escr = (this.escr + 1) % this.tam
      if (this.cheio < this.tam) this.cheio++; else this.ler = (this.ler + 1) % this.tam
    }
    if (this.cheio > this.maximo) { const sobra = this.cheio - this.alvo; this.ler = (this.ler + sobra) % this.tam; this.cheio -= sobra }
  }
  process (_in, outputs) {
    const out = outputs[0][0]
    if (!this.tocando && this.cheio >= this.alvo) this.tocando = true
    for (let i = 0; i < out.length; i++) {
      if (this.tocando && this.cheio > 0) { out[i] = this.anel[this.ler]; this.ler = (this.ler + 1) % this.tam; this.cheio-- } else out[i] = 0
    }
    if (this.cheio === 0) this.tocando = false
    for (let c = 1; c < outputs[0].length; c++) outputs[0][c].set(out)
    return true
  }
}

registerProcessor('ssadesk-captura', Captura)
registerProcessor('ssadesk-saida', Saida)
