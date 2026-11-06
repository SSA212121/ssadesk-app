# SSADesk — Progresso

**Regra:** atualizar a % total após concluir cada subtarefa (marcar `[x]`, recalcular soma). Ao atingir **90%**, o SSADesk é considerado **funcional e pronto para uso no dia a dia**; os **10% finais (Fase 7)** são refinamentos, não bloqueiam o uso.

**Progresso total: 31,25%**

> **Mudança de arquitetura (2026-11-06, decisão do usuário):** sem servidor central/VPS. Instalador único e igual em todos os computadores; cada um acessa e pode ser acessado por **conexão direta IPv4/IPv6** (porta TCP 21118), com código único e senha permanente. A Fase 1 foi reescrita para refletir isso.

---

## Fase 0 — Setup do projeto (peso: 5%)
- [x] Estrutura de pastas criada (`server/`, `videocall-app/`, docs)
- [x] `.gitignore`, `README` de cada subpasta
- [x] Repositório git inicializado localmente

## Fase 1 — Base de conexão direta, sem servidor (peso: 15%)
- [x] Instalador único `SSADesk-Setup.exe` (RustDesk oficial 1.5.1, SHA-256 conferido), escolha de disco
- [x] Porta TCP 21118 documentada e liberada no firewall, escutando em IPv4 e IPv6 (dual-stack)
- [x] Testado localmente: instalação, código único, conexão TCP IPv4/IPv6, desinstalação limpa
- [x] Nenhum servidor de terceiros: componente local próprio, zero conexões aos servidores públicos do RustDesk (validado)

## Fase 2 — Windows acessado (peso: 15%)
> Validado no notebook SSA-Atendimento, por decisão do usuário (se funciona aqui, funciona no servidor de Lages e em clientes).
- [x] SSADesk instalado como serviço no Windows (inicia com o sistema)
- [ ] Endereço de acesso pela internet definido (IPv6 público, ou IPv4 público + porta 21118 redirecionada no roteador). Esta rede: IPv4 45.229.105.152, sem IPv6
- [x] Acesso não assistido configurado com senha permanente fixa
- [x] Testado: ver tela, controlar mouse/teclado por conexão direta via IP (192.168.3.17), com senha

## Fase 3 — Cliente Mac (colaborador em Itajaí) (peso: 15%)
- [ ] RustDesk oficial instalado no Mac
- [ ] Configurado sem servidores públicos (só conexão direta)
- [ ] Conexão de controle completo testada ponta a ponta
- [ ] Testado: reconexão automática sem precisar reconfigurar nada

## Fase 4 — Identidade visual SSADesk (peso: 10%)
- [ ] Guia de estilo (`DESIGN_GUIDELINES.md`) revisado e aplicado
- [ ] Branding (nome/ícone SSADesk) aplicado onde o RustDesk permite customização
- [ ] Tema claro/escuro/automático validado

## Fase 5 — App de chamada de vídeo: estrutura (peso: 15%)
- [ ] Projeto Electron + WebRTC criado em `videocall-app/`
- [ ] Captura de câmera/microfone local funcionando nos dois lados
- [ ] Janela de vídeo com layout FaceTime (PiP arrastável, controles flutuantes)

## Fase 6 — Sinalização e conexão da chamada (peso: 15%)
- [ ] Servidor de sinalização WebRTC próprio (reaproveitando a infra de Lages)
- [ ] Handshake de chamada entre Windows e Mac funcionando
- [ ] Janela flutuante, redimensionável e fechável por qualquer lado, sem afetar a sessão de controle de tela

**→ Ao fim da Fase 6: 90% — considerar funcional, liberar para uso real do financeiro.**

## Fase 7 — Refinamentos finais (peso: 10%)
- [ ] Wake-on-LAN (ligar a máquina de Lages totalmente desligada) — decidir caminho (roteador vs. dispositivo sempre ligado) e implementar
- [ ] Teste de estresse de conexão (24h+ sem queda)
- [ ] Polimento visual fino (animações, micro-interações estilo Apple)
- [ ] Ajustes de UX a partir do uso real do financeiro

---

### Histórico de atualizações
<!-- Claude Code: acrescentar uma linha aqui a cada atualização de %, formato: `DATA — XX% — o que foi concluído` -->
- 2026-11-06 — 1,7% — Estrutura de pastas criada (`server/`, `videocall-app/`, `docs/`)
- 2026-11-06 — 3,3% — `.gitignore` (protege chaves do servidor) e README de cada subpasta
- 2026-11-06 — 5% — Git instalado (winget) e repositório inicializado (branch `main`); Fase 0 concluída
- 2026-11-06 — 8,75% — `docker-compose.yml` (hbbs+hbbr, chave obrigatória) + `install-windows.ps1` nativo para Lages
- 2026-11-06 — 12,5% — Servidor 1.1.16 testado localmente no notebook SSA-Atendimento: 5 portas ativas, chave gerada e exigida
- 2026-11-06 — 12,5% — Script manual trocado por instalador de dois cliques (Inno Setup): `dist/SSADesk-Servidor-Setup.exe`, com escolha de disco e pedido do IP/DNS
- 2026-11-06 — 12,5% — Instalador virou universal (`dist/SSADesk-Setup.exe`): tipo Servidor de Lages ou Computador; cliente RustDesk 1.5.1 com código único por máquina e senha permanente obrigatória (prepara Fases 2/3, ainda não testado em máquina real)
- 2026-11-06 — 12,5% — Teste no notebook: corrigidos bug do alias `RD` e tela de tipo confusa; código 120 358 953 gerado; desinstalação limpa
- 2026-11-06 — 20% — Arquitetura trocada para conexão direta IPv4/IPv6 sem servidor (decisão do usuário); instalador único v2.0.0 testado: porta 21118 dual-stack, nenhuma conexão externa; Fase 1 concluída
- 2026-11-06 — 23,75% — Fase 2: SSADesk rodando como serviço no notebook (teste definido pelo usuário como equivalente ao servidor)
- 2026-11-06 — 27,5% — Fase 2: acesso desassistido só com senha permanente confirmado
- 2026-11-06 — 31,25% — Fase 2: conexão direta por IP (192.168.3.17) com controle de tela, mouse e teclado funcionando
