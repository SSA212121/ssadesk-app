# server/ — Servidor RustDesk próprio (SSA)

Servidor de rendezvous (`hbbs`) e relay (`hbbr`) do RustDesk, hospedado na infraestrutura da SSA (Lages), via Docker Compose. Os clientes do SSADesk apontam **só** para este servidor, nunca para os servidores públicos do RustDesk.

Base: [`rustdesk/rustdesk-server`](https://github.com/rustdesk/rustdesk-server) (AGPL-3.0), usado sem modificação, pela imagem oficial `rustdesk/rustdesk-server`.

## Conteúdo

- `installer/`: **instalador de dois cliques para Lages** (`dist/SSADesk-Servidor-Setup.exe`, gerado por `installer/build.ps1`). Embute o rustdesk-server oficial 1.1.16 (SHA-256 conferido no build), deixa escolher o disco/pasta, pede o IP/DNS público, libera o firewall e cria tarefas que sobem com o Windows como SYSTEM e se reiniciam sozinhas. Não reinicia o computador nem mexe no InfoArte.
- `docker-compose.yml`: alternativa para um host Linux/VPS (`network_mode: host` não funciona no Docker Desktop do Windows).
- `.env.example`: modelo do `.env` para o compose.
- `data/`: chaves e banco gerados pelo servidor (**ignorado pelo git**: contém a chave privada).

## Instalação em Lages (passo a passo)

1. Leve `SSADesk-Servidor-Setup.exe` para o servidor de Lages e dê dois cliques (pede permissão de administrador).
2. Escolha o disco/pasta (padrão `C:\SSADesk\Servidor`), informe o IP/DNS público de Lages e avance. Leva menos de 1 minuto.
3. No fim abre o `CHAVE-PUBLICA.txt`: guarde no cofre de senhas. Ele vai nos clientes nas Fases 2 e 3.
4. No **roteador** de Lages, redirecione TCP 21115-21119 e UDP 21116 para o IP interno do servidor.

Desinstalar: Painel de Controle → Programas. A pasta `data\` (chaves) é mantida, então reinstalar preserva a mesma chave.
Rebuild do instalador: `powershell -ExecutionPolicy Bypass -File server\installer\build.ps1`.

Teste rápido de fora da rede: `Test-NetConnection <host> -Port 21116`.

## Portas

| Porta | Protocolo | Uso |
|---|---|---|
| 21115 | TCP | hbbs: teste de tipo de NAT |
| 21116 | TCP + UDP | hbbs: registro de IDs, hole punching |
| 21117 | TCP | hbbr: relay |
| 21118 | TCP | hbbs: web client (opcional) |
| 21119 | TCP | hbbr: web client (opcional) |

## Segurança

- O servidor roda com chave obrigatória: clientes sem a chave pública correta são recusados.
- A chave **privada** (`data/id_ed25519`) nunca sai do servidor nem entra no git.
