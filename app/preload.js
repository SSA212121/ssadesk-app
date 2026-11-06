// Ponte segura entre a interface e o processo principal
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('ssadesk', {
  info: () => ipcRenderer.invoke('info'),
  copiar: texto => ipcRenderer.invoke('copiar', texto),
  tema: tema => ipcRenderer.invoke('tema', tema),
  conectar: destino => ipcRenderer.invoke('conectar', destino),
  janela: acao => ipcRenderer.send('janela', acao),
  setup: {
    info: () => ipcRenderer.invoke('setup-info'),
    escolherPasta: atual => ipcRenderer.invoke('setup-pasta', atual),
    instalar: dados => ipcRenderer.invoke('setup-instalar', dados),
    abrirApp: () => ipcRenderer.invoke('setup-abrir'),
    desinstalar: () => ipcRenderer.invoke('setup-desinstalar'),
    onPasso: cb => ipcRenderer.on('setup-passo', (_e, i) => cb(i))
  }
})
