# server/ — Servidor RustDesk próprio (SSA)

Servidor de rendezvous (`hbbs`) e relay (`hbbr`) do RustDesk, hospedado na infraestrutura da SSA (Lages), via Docker Compose. Os clientes do SSADesk apontam **só** para este servidor, nunca para os servidores públicos do RustDesk.

Base: [`rustdesk/rustdesk-server`](https://github.com/rustdesk/rustdesk-server) (AGPL-3.0), usado sem modificação, pela imagem oficial `rustdesk/rustdesk-server`.

## Conteúdo (preenchido na Fase 1)

- `docker-compose.yml`: serviços `hbbs` + `hbbr`
- `data/`: chaves e banco gerados pelo servidor (**ignorado pelo git**: contém a chave privada)

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
