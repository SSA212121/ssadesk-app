// SSADesk — envio de arquivos e pastas pela sessão P2P (sem servidor).
// Quem acessa arrasta arquivos para a barrinha da sessão (ou usa "Enviar para → SSADesk");
// eles chegam na Área de Trabalho do computador acessado.
//
// Protocolo: controle {t:'arq-inicio', id, nome (caminho relativo), tamanho} → pedaços binários (tipo 4)
//            → controle {t:'arq-fim', id}. Um arquivo por vez, em ordem.
const fs = require('fs')
const path = require('path')

const PEDACO = 256 * 1024

// Lista arquivos (pastas viram todos os arquivos dentro delas, com o caminho relativo preservado)
function listar (caminhos) {
  const lista = []
  const visitar = (abs, rel) => {
    let st
    try { st = fs.statSync(abs) } catch { return }
    if (st.isDirectory()) {
      for (const n of fs.readdirSync(abs)) visitar(path.join(abs, n), path.join(rel, n))
    } else if (st.isFile()) lista.push({ abs, rel, tamanho: st.size })
  }
  for (const c of caminhos) visitar(c, path.basename(c))
  return lista
}

// Caminho seguro dentro da pasta de destino (nunca sai dela: sem "..", sem caminho absoluto)
function caminhoSeguro (base, rel) {
  const partes = String(rel || '').split(/[\\/]+/).filter(p => p && p !== '.' && p !== '..')
    .map(p => p.replace(/[<>:"|?*\x00-\x1f]/g, '_').slice(0, 120))
  if (!partes.length) return null
  const alvo = path.join(base, ...partes)
  return alvo.startsWith(path.resolve(base) + path.sep) ? alvo : null
}
// Não sobrescreve: "foto.jpg" vira "foto (1).jpg"
function semConflito (alvo) {
  if (!fs.existsSync(alvo)) return alvo
  const ext = path.extname(alvo); const base = alvo.slice(0, alvo.length - ext.length)
  for (let i = 1; ; i++) { const c = `${base} (${i})${ext}`; if (!fs.existsSync(c)) return c }
}

function criarArquivos ({ canal, pastaDestino, podeReceber, aoProgresso, aoRecebido }) {
  let fila = Promise.resolve()
  let seq = 0

  // ---------- Envio ----------
  function enviar (caminhos) {
    const lista = listar(caminhos)
    if (!lista.length) return Promise.resolve(0)
    const total = lista.reduce((s, a) => s + a.tamanho, 0)
    const lote = { arquivos: lista.length, total, enviado: 0 }
    fila = fila.then(async () => {
      for (const a of lista) {
        if (!canal.conectado()) throw new Error('A conexão foi encerrada.')
        const id = ++seq
        canal.controle({ t: 'arq-inicio', id, nome: a.rel.split(path.sep).join('/'), tamanho: a.tamanho })
        const fd = fs.openSync(a.abs, 'r')
        try {
          const buf = Buffer.alloc(PEDACO)
          let lido
          while ((lido = fs.readSync(fd, buf, 0, PEDACO, null)) > 0) {
            canal.arquivo(buf.subarray(0, lido))
            lote.enviado += lido
            aoProgresso({ ...lote, atual: a.rel })
            await canal.esperarVazao() // não acumula o arquivo inteiro na memória
          }
        } finally { fs.closeSync(fd) }
        canal.controle({ t: 'arq-fim', id })
      }
      aoProgresso({ ...lote, concluido: true })
      return lista.length
    })
    return fila
  }

  // ---------- Recebimento ----------
  let atual = null
  function controle (msg) {
    if (msg.t === 'arq-inicio') {
      if (atual) fechar(false)
      if (!podeReceber()) { atual = { recusado: true, id: msg.id }; return }
      const destino = caminhoSeguro(pastaDestino(), msg.nome)
      if (!destino) { atual = { recusado: true, id: msg.id }; return }
      fs.mkdirSync(path.dirname(destino), { recursive: true })
      const final = semConflito(destino)
      atual = { id: msg.id, final, temp: final + '.ssadesk-parcial', fd: fs.openSync(final + '.ssadesk-parcial', 'w'), nome: msg.nome, recebido: 0, tamanho: Number(msg.tamanho) || 0 }
    } else if (msg.t === 'arq-fim' && atual && atual.id === msg.id) {
      fechar(true)
    }
  }
  function pedaco (dados) {
    if (!atual || atual.recusado) return
    fs.writeSync(atual.fd, dados)
    atual.recebido += dados.length
  }
  function fechar (ok) {
    const a = atual; atual = null
    if (!a || a.recusado) return
    fs.closeSync(a.fd)
    if (ok) { fs.renameSync(a.temp, a.final); aoRecebido({ nome: path.basename(a.final), caminho: a.final, raiz: a.nome.split('/')[0] }) } else fs.rmSync(a.temp, { force: true })
  }
  function sessaoEncerrada () { if (atual) fechar(false) }

  return { enviar, controle, pedaco, sessaoEncerrada }
}

module.exports = { criarArquivos, caminhoSeguro, semConflito }
