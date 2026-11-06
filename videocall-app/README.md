# videocall-app/ — Chamada de vídeo SSADesk

App companheiro de chamada de vídeo bidirecional (estilo FaceTime), independente da sessão de controle de tela do RustDesk. Os dois lados (Windows/Lages e Mac/Itajaí) ligam câmera e microfone quando quiserem, numa janela flutuante.

## Stack (Fases 5 e 6)

- **Electron** para a janela nativa no Windows e no macOS
- **WebRTC** para áudio/vídeo ponto a ponto
- **Servidor de sinalização próprio**, na mesma infraestrutura de Lages que o servidor RustDesk

## Interface

Segue [`../DESIGN_GUIDELINES.md`](../DESIGN_GUIDELINES.md):
- vídeo remoto em tela cheia, PiP local arrastável
- barra de controles translúcida (mudo, câmera, encerrar)
- tema claro, escuro e automático

## Estrutura (a criar na Fase 5)

```
videocall-app/
  src/main/       processo principal do Electron (janela, ciclo de vida)
  src/renderer/   interface (HTML/CSS/JS) e WebRTC
  signaling/      servidor de sinalização (Fase 6)
```
