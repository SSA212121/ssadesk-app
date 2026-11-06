// SSADesk — envio e recebimento de áudio/vídeo pelo canal P2P (sem servidor).
// Vídeo: VP8 (WebCodecs) a partir do <video> local.  Áudio: Opus em blocos de 20 ms.
// Formato de cada pacote de mídia: [1 byte flags (bit0 = quadro-chave)][8 bytes timestamp µs][dados]
;(function () {
  const api = window.ssadesk.chamada
  const TAXA = 48000

  function empacotar (chave, timestamp, bytes) {
    const out = new Uint8Array(9 + bytes.byteLength)
    out[0] = chave ? 1 : 0
    new DataView(out.buffer).setFloat64(1, timestamp)
    out.set(bytes, 9)
    return out.buffer
  }
  function desempacotar (buf) {
    const u = new Uint8Array(buf)
    return { chave: (u[0] & 1) === 1, timestamp: new DataView(u.buffer, u.byteOffset).getFloat64(1), dados: u.subarray(9) }
  }

  // ================= ENVIO =================
  // Um único contexto de áudio; o módulo é carregado uma vez só (chamadas simultâneas esperam a mesma carga)
  let ctxPronto = null
  function contexto () {
    if (!ctxPronto) {
      ctxPronto = (async () => {
        const c = new AudioContext({ sampleRate: TAXA, latencyHint: 'interactive' })
        await c.audioWorklet.addModule('audio-worklet.js')
        return c
      })()
    }
    return ctxPronto.then(async c => { if (c.state === 'suspended') await c.resume().catch(() => {}); return c })
  }

  // --- Vídeo ---
  let vEnc = null; let vAtivo = false; let vQuadros = 0; let pedirChave = true; let vTam = ''
  function iniciarVideo (videoEl) {
    pararVideo()
    vAtivo = true; vQuadros = 0; pedirChave = true
    const enviar = () => {
      if (!vAtivo) return
      try {
        if (videoEl.readyState >= 2 && videoEl.videoWidth) {
          const w = videoEl.videoWidth & ~1; const h = videoEl.videoHeight & ~1
          if (!vEnc || vTam !== w + 'x' + h) {
            if (vEnc && vEnc.state !== 'closed') vEnc.close()
            vEnc = new VideoEncoder({
              output: chunk => { const b = new Uint8Array(chunk.byteLength); chunk.copyTo(b); api.enviarMidia('video', empacotar(chunk.type === 'key', chunk.timestamp, b)) },
              error: () => { vEnc = null }
            })
            vEnc.configure({ codec: 'vp8', width: w, height: h, bitrate: 1_200_000, framerate: 30, latencyMode: 'realtime' })
            vTam = w + 'x' + h; pedirChave = true
          }
          if (vEnc.encodeQueueSize < 3) { // codificador atrasado: pula o quadro em vez de acumular atraso
            const frame = new VideoFrame(videoEl, { timestamp: performance.now() * 1000 })
            const chave = pedirChave || vQuadros % 60 === 0 // quadro-chave a cada ~2 s (recupera de perdas)
            vEnc.encode(frame, { keyFrame: chave }); frame.close()
            pedirChave = false; vQuadros++
          }
        }
      } catch {}
      videoEl.requestVideoFrameCallback ? videoEl.requestVideoFrameCallback(enviar) : setTimeout(enviar, 33)
    }
    enviar()
  }
  function pararVideo () {
    vAtivo = false
    if (vEnc && vEnc.state !== 'closed') vEnc.close()
    vEnc = null; vTam = ''
  }

  // --- Áudio ---
  let aEnc = null; let aFonte = null; let aNo = null; let aTs = 0
  async function iniciarAudio (stream) {
    pararAudio()
    const c = await contexto()
    aEnc = new AudioEncoder({
      output: chunk => { const b = new Uint8Array(chunk.byteLength); chunk.copyTo(b); api.enviarMidia('audio', empacotar(true, chunk.timestamp, b)) },
      error: () => {}
    })
    aEnc.configure({ codec: 'opus', sampleRate: TAXA, numberOfChannels: 1, bitrate: 32000 })
    aFonte = c.createMediaStreamSource(stream)
    aNo = new AudioWorkletNode(c, 'ssadesk-captura', { numberOfInputs: 1, numberOfOutputs: 0, channelCount: 1, channelCountMode: 'explicit' })
    aNo.port.onmessage = e => {
      if (!aEnc || aEnc.state !== 'configured') return
      const data = new AudioData({ format: 'f32-planar', sampleRate: TAXA, numberOfFrames: 960, numberOfChannels: 1, timestamp: aTs, data: e.data })
      aTs += 20000
      aEnc.encode(data); data.close()
    }
    aFonte.connect(aNo)
  }
  function pararAudio () {
    try { if (aFonte) aFonte.disconnect(); if (aNo) aNo.disconnect() } catch {}
    if (aEnc && aEnc.state !== 'closed') aEnc.close()
    aEnc = null; aFonte = null; aNo = null
  }

  // ================= RECEBIMENTO =================
  let vDec = null; let esperandoChave = true; let canvas = null; let g2d = null
  function decodificadorVideo () {
    if (vDec && vDec.state !== 'closed') return vDec
    esperandoChave = true
    vDec = new VideoDecoder({
      output: frame => {
        if (canvas.width !== frame.displayWidth || canvas.height !== frame.displayHeight) { canvas.width = frame.displayWidth; canvas.height = frame.displayHeight }
        g2d.drawImage(frame, 0, 0); frame.close()
        window.dispatchEvent(new Event('ssadesk-video-remoto'))
      },
      error: () => { vDec = null; api.controle({ t: 'quadro-chave' }) }
    })
    vDec.configure({ codec: 'vp8', optimizeForLatency: true })
    return vDec
  }
  function receberVideo (buf) {
    const p = desempacotar(buf)
    const d = decodificadorVideo()
    if (esperandoChave && !p.chave) return
    esperandoChave = false
    try { d.decode(new EncodedVideoChunk({ type: p.chave ? 'key' : 'delta', timestamp: p.timestamp, data: p.dados })) } catch { vDec = null; api.controle({ t: 'quadro-chave' }) }
  }

  let aDec = null; let saida = null; let saidaPronta = null
  async function receberAudio (buf) {
    const p = desempacotar(buf)
    if (!saida) {
      saidaPronta = saidaPronta || contexto().then(c => { const n = new AudioWorkletNode(c, 'ssadesk-saida', { numberOfInputs: 0, outputChannelCount: [2] }); n.connect(c.destination); return n })
      saida = await saidaPronta
    }
    if (!aDec || aDec.state === 'closed') {
      aDec = new AudioDecoder({
        output: data => {
          const amostras = new Float32Array(data.numberOfFrames)
          data.copyTo(amostras, { planeIndex: 0, format: 'f32-planar' }); data.close()
          saida.port.postMessage(amostras, [amostras.buffer])
        },
        error: () => { aDec = null }
      })
      aDec.configure({ codec: 'opus', sampleRate: TAXA, numberOfChannels: 1 })
    }
    try { aDec.decode(new EncodedAudioChunk({ type: 'key', timestamp: p.timestamp, data: p.dados })) } catch { aDec = null }
  }

  function pararRecebimento () {
    if (vDec && vDec.state !== 'closed') vDec.close()
    if (aDec && aDec.state !== 'closed') aDec.close()
    vDec = null; aDec = null
    if (g2d) g2d.clearRect(0, 0, canvas.width, canvas.height)
  }

  window.ssadeskMidia = {
    ligar (canvasRemoto) { canvas = canvasRemoto; g2d = canvas.getContext('2d') },
    iniciarVideo, pararVideo, iniciarAudio, pararAudio, pararRecebimento,
    pedirQuadroChave () { pedirChave = true },
    contexto
  }
  api.onMidia((tipo, dados) => { if (tipo === 'video') receberVideo(dados); else receberAudio(dados) })
})()
