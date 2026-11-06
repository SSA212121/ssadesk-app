# SSADesk

Solução própria de acesso remoto para a SSA Comércio, substituindo o AnyDesk (que passou a cobrar e está derrubando a conexão do financeiro a cada 5 minutos).

## Por que essa arquitetura

Construir um AnyDesk do zero (captura de tela, transporte de rede, NAT traversal, criptografia) levaria meses mesmo para equipes grandes. Em vez disso, o SSADesk usa como base o **RustDesk** (`github.com/rustdesk/rustdesk` + `github.com/rustdesk/rustdesk-server`), projeto open source (AGPL-3.0) feito para isso, com clientes prontos para Windows e macOS.

**Sem servidor central (decisão de 2026-11-06):** o mesmo instalador vai em qualquer computador, e cada instalação acessa outros e pode ser acessada, por **conexão direta IPv4/IPv6** na porta TCP 21118. Então:

- Não depende de nenhum serviço de terceiro, VPS ou servidor da empresa; os servidores públicos do RustDesk nunca são usados.
- Cada computador tem um **código único** e aceita acesso desassistido só com **senha permanente** (nunca "sem senha").
- Pela internet: com IPv6 público, conecta direto ao endereço IPv6; só com IPv4, redireciona a porta 21118 no roteador do lado acessado (Lages).
- Controle completo de tela, teclado e mouse da máquina de Lages a partir do Mac em Itajaí.

Não usamos nem reproduzimos nenhum código do AnyDesk — o RustDesk é um projeto independente, com protocolo e implementação próprios.

## Componentes do projeto

1. **`installer/`** — gera `dist/SSADesk-Setup.exe`, instalador único para Windows (ver `installer/README.md`).
2. **Mac** — RustDesk oficial para macOS, configurado para conexão direta (Fase 3).
3. **`app/`** — app SSADesk (Electron): painel, instalador/desinstalador e **chamada de vídeo** bidirecional estilo FaceTime (janela própria, independente da sessão de controle de tela). Decisão de 2026-11-06: a chamada fica dentro do app, não num app separado.
4. **`DESIGN_GUIDELINES.md`** — identidade visual do SSADesk, inspirada nos apps da Apple (FaceTime, System Settings): minimalista, moderna, tema claro/escuro/sistema.
5. **`PROGRESS.md`** — controle de progresso por fases, em percentual. 90% = funcional e pronto para uso no dia a dia; os 10% finais são refinamentos (Wake-on-LAN, polimento visual, testes de estresse de conexão).

## Observação sobre "ligar o computador remotamente"

Isso depende de Wake-on-LAN, que só funciona se houver algo já ligado na rede local de Lages para disparar o "pacote mágico" (a placa de rede desligada não aceita conexão direta vinda da internet). Está planejado na Fase 7 (refinamento), com duas opções a decidir na hora: configurar o roteador de Lages para redirecionar o pacote, ou usar um dispositivo barato sempre ligado na mesma rede.

## Próximo passo

Ver `PROGRESS.md`.
