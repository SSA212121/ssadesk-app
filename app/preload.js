// Ponte segura entre a interface e o processo principal
const { contextBridge, ipcRenderer, webUtils } = require('electron')

contextBridge.exposeInMainWorld('ssadesk', {
  info: () => ipcRenderer.invoke('info'),
  copiar: texto => ipcRenderer.invoke('copiar', texto),
  tema: tema => ipcRenderer.invoke('tema', tema),
  ligar: d => ipcRenderer.invoke('ligar', d),
  altura: h => ipcRenderer.send('painel-altura', h),
  conectar: destino => ipcRenderer.invoke('conectar', destino),
  nome: nome => ipcRenderer.invoke('nome', nome),
  ajustes: { ler: () => ipcRenderer.invoke('ajustes'), salvar: a => ipcRenderer.invoke('ajustes-salvar', a), diagnostico: () => ipcRenderer.invoke('diagnostico') },
  biblioteca: {
    listar: () => ipcRenderer.invoke('biblioteca'),
    remover: codigo => ipcRenderer.invoke('biblioteca-remover', codigo),
    online: codigo => ipcRenderer.invoke('biblioteca-online', codigo),
    acordar: codigo => ipcRenderer.invoke('biblioteca-acordar', codigo),
    onMudou: cb => ipcRenderer.on('biblioteca-mudou', () => cb())
  },
  onStatus: cb => ipcRenderer.on('conectar-status', (_e, s) => cb(s)),
  onSessao: cb => ipcRenderer.on('sessao', (_e, s) => cb(s)),
  onVisivel: cb => ipcRenderer.on('painel-visivel', () => cb()),
  sessao: {
    info: () => ipcRenderer.invoke('sessao-info'),
    acao: a => ipcRenderer.send('sessao-acao', a),
    onAtualizar: cb => ipcRenderer.on('barra-sessao', (_e, s) => cb(s)),
    onEstado: cb => ipcRenderer.on('barra-estado', (_e, t) => cb(t)),
    onChat: cb => ipcRenderer.on('chat-recebida', (_e, d) => cb(d)),
    onChatVisivel: cb => ipcRenderer.on('chat-visivel', (_e, v) => cb(v))
  },
  senha: {
    ver: () => ipcRenderer.invoke('senha-ver'),
    alterar: nova => ipcRenderer.invoke('senha-alterar', nova),
    revogar: () => ipcRenderer.invoke('senha-revogar')
  },
  mais: {
    comando: (acao, valor) => ipcRenderer.send('mais-comando', acao, valor),
    estado: () => ipcRenderer.invoke('mais-estado'),
    fechar: () => ipcRenderer.send('mais-fechar')
  },
  painelInfo: {
    onDados: cb => ipcRenderer.on('info-dados', (_e, d) => cb(d)),
    fps: ligar => ipcRenderer.invoke('info-fps', ligar),
    fechar: () => ipcRenderer.send('info-fechar')
  },
  arquivos: {
    // Caminho real de um arquivo arrastado (o Electron não expõe mais File.path)
    caminhoDe: arquivo => webUtils.getPathForFile(arquivo),
    enviar: caminhos => ipcRenderer.invoke('arquivos-enviar', caminhos),
    escolher: () => ipcRenderer.invoke('arquivos-escolher'),
    onProgresso: cb => ipcRenderer.on('arquivos-progresso', (_e, p) => cb(p))
  },
  lousa: {
    enviar: d => ipcRenderer.send('lousa-enviar', d),
    atravessar: sim => ipcRenderer.send('lousa-atravessar', sim),
    fechar: () => ipcRenderer.send('lousa-fechar'),
    onRemoto: cb => ipcRenderer.on('lousa-remoto', (_e, d) => cb(d))
  },
  pedido: {
    dados: () => ipcRenderer.invoke('pedido-dados'),
    responder: r => ipcRenderer.send('pedido-resposta', r),
    adiar: () => ipcRenderer.send('pedido-adiar')
  },
  janela: acao => ipcRenderer.send('janela', acao),
  chamada: {
    abrir: dados => ipcRenderer.send('abrir-chamada', dados),
    acessar: () => ipcRenderer.invoke('chamada-acessar'),
    janela: acao => ipcRenderer.send('janela-chamada', acao),
    enviarMidia: (tipo, buf) => ipcRenderer.send('chamada-midia', tipo, buf),
    controle: obj => ipcRenderer.send('chamada-controle', obj),
    onMidia: cb => ipcRenderer.on('chamada-midia', (_e, tipo, dados) => cb(tipo, dados)),
    onEstado: cb => ipcRenderer.on('chamada-estado', (_e, s) => cb(s)),
    estadoAtual: () => ipcRenderer.invoke('chamada-estado-atual'),
    fonteTela: () => ipcRenderer.invoke('tela-fonte'),
    onRemoto: cb => ipcRenderer.on('chamada-remoto', (_e, s) => cb(s)),
    onQuadroChave: cb => ipcRenderer.on('chamada-quadro-chave', () => cb())
  },
  chat: {
    abrir: () => ipcRenderer.send('chat-abrir'),
    enviar: texto => ipcRenderer.send('chat-enviar', texto),
    historico: () => ipcRenderer.invoke('chat-historico'),
    janela: acao => ipcRenderer.send('chat-janela', acao),
    onMsg: cb => ipcRenderer.on('chat-msg', (_e, m) => cb(m)),
    onRecebida: cb => ipcRenderer.on('chat-recebida', (_e, d) => cb(d)),
    onVisivel: cb => ipcRenderer.on('chat-visivel', (_e, v) => cb(v))
  },
  setup: {
    info: () => ipcRenderer.invoke('setup-info'),
    escolherPasta: atual => ipcRenderer.invoke('setup-pasta', atual),
    instalar: dados => ipcRenderer.invoke('setup-instalar', dados),
    abrirApp: () => ipcRenderer.invoke('setup-abrir'),
    desinstalar: () => ipcRenderer.invoke('setup-desinstalar'),
    onPasso: cb => ipcRenderer.on('setup-passo', (_e, i) => cb(i))
  }
})
