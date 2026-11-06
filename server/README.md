# server/ — Servidor RustDesk próprio (SSA)

Servidor de rendezvous (`hbbs`) e relay (`hbbr`) do RustDesk, hospedado na infraestrutura da SSA (Lages), via Docker Compose. Os clientes do SSADesk apontam **só** para este servidor, nunca para os servidores públicos do RustDesk.

Base: [`rustdesk/rustdesk-server`](https://github.com/rustdesk/rustdesk-server) (AGPL-3.0), usado sem modificação, pela imagem oficial `rustdesk/rustdesk-server`.

## Conteúdo

- Instalação em Windows: feita pelo instalador universal [`../installer/`](../installer/README.md) (tipo *Servidor de Lages*). Ele libera o firewall e cria tarefas que sobem com o Windows como SYSTEM e se reiniciam sozinhas.
- `docker-compose.yml`: alternativa para um host Linux/VPS (`network_mode: host` não funciona no Docker Desktop do Windows).
- `.env.example`: modelo do `.env` para o compose.
- `data/`: chaves e banco gerados pelo servidor (**ignorado pelo git**: contém a chave privada).

## Instalação em Lages (passo a passo)

Veja [`../installer/README.md`](../installer/README.md). Depois de instalar, guarde `<pasta>\Servidor\CHAVE-PUBLICA.txt` no cofre de senhas e redirecione no **roteador** TCP 21115-21119 e UDP 21116 para o servidor.

Desinstalar: Painel de Controle → Programas → SSADesk. A pasta `Servidor\data\` (chaves) é mantida, então reinstalar preserva a mesma chave.

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
