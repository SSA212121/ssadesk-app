# SSADesk — Progresso

**Regra:** atualizar a % total após concluir cada subtarefa (marcar `[x]`, recalcular soma). Ao atingir **90%**, o SSADesk é considerado **funcional e pronto para uso no dia a dia**; os **10% finais (Fase 7)** são refinamentos, não bloqueiam o uso.

**Progresso total: 12,5%**

---

## Fase 0 — Setup do projeto (peso: 5%)
- [x] Estrutura de pastas criada (`server/`, `videocall-app/`, docs)
- [x] `.gitignore`, `README` de cada subpasta
- [x] Repositório git inicializado localmente

## Fase 1 — Servidor RustDesk self-hosted (peso: 15%)
- [x] `docker-compose.yml` com `hbbs` + `hbbr` (rustdesk-server)
- [ ] Portas documentadas e liberadas (21115-21119 tcp, 21116 udp) — documentadas e automatizadas no instalador `SSADesk-Setup.exe`; falta instalar em Lages + redirecionar no roteador
- [x] Servidor testado subindo localmente
- [ ] Chave pública do servidor gerada e documentada em local seguro

## Fase 2 — Cliente Windows (servidor de Lages) (peso: 15%)
- [ ] RustDesk instalado como serviço no Windows
- [ ] Apontado para o servidor próprio (não o público)
- [ ] Acesso não assistido configurado com senha permanente fixa
- [ ] Testado: ligar, ver tela, controlar mouse/teclado remotamente

## Fase 3 — Cliente Mac (colaborador em Itajaí) (peso: 15%)
- [ ] RustDesk instalado no Mac
- [ ] Apontado para o servidor próprio
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
