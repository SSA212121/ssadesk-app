# SSADesk

Solução própria de acesso remoto para a SSA Comércio, substituindo o AnyDesk (que passou a cobrar e está derrubando a conexão do financeiro a cada 5 minutos).

## Por que essa arquitetura

Construir um AnyDesk do zero (captura de tela, transporte de rede, NAT traversal, criptografia) levaria meses mesmo para equipes grandes. Em vez disso, o SSADesk usa como base o **RustDesk** (`github.com/rustdesk/rustdesk` + `github.com/rustdesk/rustdesk-server`), projeto open source (AGPL-3.0) feito para isso, com clientes prontos para Windows e macOS. Hospedamos o servidor de rendezvous/relay (`hbbs`/`hbbr`) na própria infraestrutura da SSA (servidor em Lages), então:

- Não depende de nenhum serviço de terceiro cobrando ou derrubando a conexão.
- Acesso irrestrito e desassistido, com **chave de acesso fixa** salva no cliente (em vez de "zero senha"), para que estranhos na internet não consigam se conectar só por descobrir o endereço do servidor.
- Controle completo de tela, teclado e mouse da máquina de Lages a partir do Mac em Itajaí.

Não usamos nem reproduzimos nenhum código do AnyDesk — o RustDesk é um projeto independente, com protocolo e implementação próprios.

## Componentes do projeto

1. **`server/`** — servidor RustDesk self-hosted (docker-compose), roda no servidor Windows/Lages ou numa VPS da empresa.
2. **Clientes RustDesk** — instalados no Windows (Lages, acesso desassistido) e no Mac (Itajaí, controlador). Configuração documentada, não é código novo.
3. **`videocall-app/`** — app companheiro de chamada de vídeo bidirecional (estilo FaceTime/Google Meet): ambos os lados ligam câmera e microfone quando quiserem, numa janela flutuante, independente da sessão de controle de tela.
4. **`DESIGN_GUIDELINES.md`** — identidade visual do SSADesk, inspirada nos apps da Apple (FaceTime, System Settings): minimalista, moderna, tema claro/escuro/sistema.
5. **`PROGRESS.md`** — controle de progresso por fases, em percentual. 90% = funcional e pronto para uso no dia a dia; os 10% finais são refinamentos (Wake-on-LAN, polimento visual, testes de estresse de conexão).

## Observação sobre "ligar o computador remotamente"

Isso depende de Wake-on-LAN, que só funciona se houver algo já ligado na rede local de Lages para disparar o "pacote mágico" (a placa de rede desligada não aceita conexão direta vinda da internet). Está planejado na Fase 7 (refinamento), com duas opções a decidir na hora: configurar o roteador de Lages para redirecionar o pacote, ou usar um dispositivo barato sempre ligado na mesma rede.

## Próximo passo

Abra o Claude Code nesta mesma pasta e cole o conteúdo de `CLAUDE_CODE_START_PROMPT.md` para iniciar a Fase 0.
