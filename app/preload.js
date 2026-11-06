// Ponte segura entre a interface e o processo principal
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('ssadesk', {
  info: () => ipcRenderer.invoke('info'),
  copiar: texto => ipcRenderer.invoke('copiar', texto),
  tema: tema => ipcRenderer.invoke('tema', tema),
  conectar: destino => ipcRenderer.invoke('conectar', destino),
  janela: acao => ipcRenderer.send('janela', acao),
  chamada: {
    abrir: dados => ipcRenderer.send('abrir-chamada', dados),
    janela: acao => ipcRenderer.send('janela-chamada', acao)
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
