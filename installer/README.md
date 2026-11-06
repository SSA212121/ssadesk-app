# installer/: SSADesk-Setup.exe (instalador universal Windows)

Um único instalador para todos os computadores Windows. No assistente você escolhe o que este computador é:

| Tipo | Instala | Onde |
|---|---|---|
| **Servidor de Lages** | servidor SSADesk (hbbs+hbbr) **e** acesso remoto | só no servidor do InfoArte |
| **Computador** | acesso remoto (cliente RustDesk apontado para Lages) | qualquer outro Windows |

## Código único por computador

Cada computador recebe do RustDesk um **código (ID) numérico único**, gerado na instalação e registrado no servidor de Lages, que recusa códigos repetidos. O código aparece na tela final do instalador e fica salvo em `<pasta>\Cliente\SSADESK-ID.txt`. Para conectar a um computador, basta o código dele + a senha permanente.

## Instalação rápida

1. **Lages primeiro:** `SSADesk-Setup.exe` → escolher disco → tipo *Servidor de Lages* → IP/DNS público → senha permanente → Concluir. Não reinicia o Windows nem fecha o InfoArte.
2. Copie `<pasta>\Servidor\ssadesk.ini` para junto do `SSADesk-Setup.exe` (pen drive/rede).
3. **Demais computadores:** dois cliques → disco → *Computador* → senha. Servidor e chave já vêm preenchidos pelo `ssadesk.ini`.
4. No roteador de Lages: TCP 21115-21119 e UDP 21116 → servidor.

## Segurança

- Senha permanente **obrigatória** (mínimo 8 caracteres). Senha temporária e "aceitar com clique" ficam desligadas: só entra quem tem o código **e** a senha.
- Clientes falam apenas com o servidor da SSA (nunca com os servidores públicos do RustDesk) e exigem a chave do servidor.
- A senha não é gravada no log nem em arquivo (passa por arquivo temporário apagado na hora).

## Mac (Itajaí)

O `.exe` é só para Windows. O Mac usa o RustDesk oficial para macOS com o mesmo servidor/chave (Fase 3).

## Gerar o instalador

`powershell -ExecutionPolicy Bypass -File installer\build.ps1` → `dist\SSADesk-Setup.exe`. Baixa os binários oficiais (rustdesk-server 1.1.16, RustDesk 1.5.1), confere o SHA-256 e compila com Inno Setup 6.
