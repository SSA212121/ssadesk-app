# SSADesk — Progresso

**Regra:** atualizar a % total após concluir cada subtarefa (marcar `[x]`, recalcular soma). Ao atingir **90%**, o SSADesk é considerado **funcional e pronto para uso no dia a dia**; os **10% finais (Fase 7)** são refinamentos, não bloqueiam o uso.

**Progresso total: 60%**

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
- [x] Acesso pela internet: túnel P2P (Hyperswarm) atravessando CGNAT, sem servidor e sem roteador. Testado de um notebook no 4G até o SSA-Atendimento (CGNAT). Lento na 1ª conexão (refino pendente: abrir o túnel antes do SSADesk)
- [x] Acesso não assistido configurado com senha permanente fixa
- [x] Testado: ver tela, controlar mouse/teclado por conexão direta via IP (192.168.3.17), com senha

## Fase 3 — Cliente Mac (colaborador em Itajaí) (peso: 15%)
> Pacote pronto em `dist/Mac-SSADesk`. **Teste no Mac fica como último passo** (o Mac está em Itajaí), por decisão do usuário em 2026-11-06; seguimos para a Fase 4.
- [ ] RustDesk oficial instalado no Mac
- [ ] Configurado sem servidores públicos (só conexão direta)
- [ ] Conexão de controle completo testada ponta a ponta
- [ ] Testado: reconexão automática sem precisar reconfigurar nada

## Fase 4 — Identidade visual SSADesk (peso: 10%)
- [x] Guia de estilo (`DESIGN_GUIDELINES.md`) revisado e aplicado (app Electron com vidro Acrylic/vibrancy, tipografia estilo Apple, animações)
- [x] Branding (nome/ícone SSADesk) aplicado: ícone próprio, app, instalador e desinstalador glass próprios (janela da sessão RustDesk mantém o nome original; recompilar fica opcional na Fase 7)
- [x] Tema claro/escuro/automático validado (controle segmentado; Automático segue o sistema)

## Fase 5 — App de chamada de vídeo: estrutura (peso: 15%)
- [x] Projeto Electron + WebRTC criado (dentro do app SSADesk, em `app/`, por decisão do usuário)
- [x] Captura de câmera/microfone local funcionando (liga/desliga sob demanda, libera o dispositivo; mesmo app nos dois lados; testado no notebook)
- [x] Janela de vídeo estilo FaceTime: flutuante, sempre no topo, redimensionável e tela cheia; sua imagem arrastável e redimensionável; controles flutuantes que somem

## Fase 6 — Sinalização e conexão da chamada (peso: 15%)
- [ ] Servidor de sinalização WebRTC próprio (reaproveitando a infra de Lages)
- [ ] Handshake de chamada entre Windows e Mac funcionando
- [ ] Janela flutuante, redimensionável e fechável por qualquer lado, sem afetar a sessão de controle de tela

**→ Ao fim da Fase 6: 90% — considerar funcional, liberar para uso real do financeiro.**

## Funcionalidades pedidas pelo usuário (2026-11-06) — a encaixar nas fases
> Anotadas a pedido do usuário. Fase sugerida entre parênteses; peso definido quando forem agendadas.
- [x] **Biblioteca de conexões**: computadores já acessados ficam salvos no painel (nome e código); um clique conecta; **bolinha verde = online, vermelha = offline** (verificado na rede P2P a cada minuto). Senha lembrada: fica a cargo do motor (opção "lembrar senha" na sessão). Obs.: um computador desligado pode aparecer online por alguns minutos até o anúncio expirar na rede
- [ ] **Botão de filmar a tela** da sessão remota (sugestão: Fase 6, barra da sessão)
- [ ] **Botão de print** (captura da tela remota) (sugestão: Fase 6)
- [ ] **Modo My**: a tela do PC acessado ocupa toda a área da janela/monitor de quem acessa, ajustada de forma responsiva (resolução, escala, botões legíveis), sem a "janelinha pequena" do AnyDesk/TeamViewer; **atalho na tela para sair do Modo My** (sugestão: Fase 6)

- [ ] **Chat de texto na chamada**: janela própria flutuante e redimensionável, aberta pela aba da chamada; som a cada mensagem recebida e contador de não lidas. Interface pronta e validada (modo demonstração); falta o envio real entre os computadores (Fase 6)

- [ ] **Assinatura digital do SSADesk** (bloqueador para distribuir a clientes): sem ela, o "Controle Inteligente de Aplicativos" do Windows 11 bloqueia o app (Electron, hbbs e módulos nativos não são assinados). Decisão do usuário (2026-11-06): o SSADesk será 100% gratuito e, por enquanto, **sem assinatura**. Plano do usuário: publicar na **Microsoft Store** no futuro (pacote MSIX assinado pela própria Microsoft, aceito pelo Controle Inteligente). Atenção técnica: no MSIX, serviço do RustDesk, tarefas como SYSTEM e regras de firewall precisam de adaptação/aprovação da Store; envio de .exe/.msi tradicional à Store exige o instalador já assinado. Outra opção gratuita: SignPath Foundation (exige publicar o código aberto, o que a licença AGPL do RustDesk já pede para distribuir). Enquanto isso, o Setup detecta a proteção e orienta o usuário (nunca desliga sozinho)

- [ ] **Vários caminhos ao mesmo tempo** (rede local, IPv6, túnel P2P), usa o que responder primeiro; investigar falha via 5G
- [x] **Enviar arquivos arrastando** para a barrinha flutuante da sessão (ou botão direito → Enviar para → SSADesk) → Área de Trabalho do computador conectado; respeita a permissão "Enviar arquivos"; não sobrescreve; testado entre duas cópias (30 MB + pasta, íntegros)
- [ ] **Lousa digital no Modo My**: circular, escrever, desenhar; botão "Limpar tudo"; os dois usuários veem as anotações (pedido 2026-11-06). **Lousa pronta e testada** (caneta, marca-texto, borracha, 5 cores, modo mouse, Limpar tudo, sincronizada pela sessão P2P); falta ligá-la ao Modo My quando o motor estiver compilado
- [x] **Transmitir a tela de quem conecta** (como Meet/Discord): botão na barrinha e na chamada; do outro lado abre na janela da chamada, redimensionável e em tela cheia; testado entre duas cópias

- [ ] **Motor próprio (decisão 2026-11-06):** o SSADesk não instala nem usa o RustDesk separado. Agora: compilar o motor a partir do código-fonte do RustDesk com marca SSADesk, embutido no programa (licença AGPL: código-fonte do SSADesk público). Futuro: controle de tela 100% próprio (sem AGPL), pensando em comercializar.
- [x] Conectar pelo código: sessão P2P pelo código de 9 dígitos, pedido Permitir/Negar com permissões, nome opcional, vários caminhos ao mesmo tempo (testado entre duas cópias do app: 8,7 s)

## Fase 7 — Refinamentos finais (peso: 10%)
- [ ] Wake-on-LAN (ligar a máquina de Lages totalmente desligada). **Implementado sem servidor**: botão "Ligar" nos computadores offline da lista; o sinal sai daqui (mesma rede) ou de outro computador da lista ligado na mesma rede; pacote validado. Falta: ativar Wake-on-LAN na BIOS/placa de rede de Lages e testar ligando de verdade
- [ ] Teste de estresse de conexão (24h+ sem queda)
- [ ] Polimento visual fino (animações, micro-interações estilo Apple)
- [ ] Ajustes de UX a partir do uso real do financeiro
- [x] Instalação sempre limpa: o instalador remove a versão anterior antes de instalar (feito na v3.0, mantém código e chave)
- [ ] Revisar o atalho "Conectar pela internet" da v2.3 (abre o túnel antes do SSADesk): no teste pelo 4G não conectou; a v2.2 conectava, mas lenta

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
- 2026-11-06 — 31,25% — Instalador 2.1: diagnóstico automático de rede (IPv4/IPv6, UPnP automático, detecção de CGNAT) na instalação e a cada hora, com resultado em linguagem simples; validado no notebook (detectou CGNAT)
- 2026-11-06 — 31,25% — Instalador 2.2: túnel P2P (Hyperswarm/hypertele) embutido, liga com o Windows e gera "chave de internet"; atalho "Conectar pela internet". Testado em loop no notebook; aguardando teste real com segundo notebook no 4G
- 2026-11-06 — 35% — Conexão pela internet funcionando: notebook no 4G → SSA-Atendimento (CGNAT) pelo túnel P2P, sem servidor; Fase 2 concluída (conexão inicial lenta, com várias tentativas)
- 2026-11-06 — 35% — v2.3: cliente P2P próprio que abre o túnel antes do SSADesk (30 ms no teste local); no 4G não conectou e a atualização por cima pediu "ignorar arquivo". Ambos ficaram pendentes na Fase 7 a pedido do usuário
- 2026-11-06 — 35% — Fase 3 iniciada: pacote macOS `dist/Mac-SSADesk` (RustDesk 1.5.1 Intel/Apple Silicon, túnel P2P, app "Conectar pela internet", instalação sempre limpa, sem servidores públicos). Gerado, ainda não testado num Mac
- 2026-11-06 — 38,3% — Fase 4: app SSADesk em Electron com visual Apple (vidro, Inter/SF, animações) e botões de janela próprios
- 2026-11-06 — 41,7% — Fase 4: ícone e marca SSADesk; instalador/desinstalador próprios no mesmo visual, com instalação sempre limpa preservando código e chave (resolve pendência da Fase 7)
- 2026-11-06 — 45% — Fase 4: temas Automático/Claro/Escuro validados pelo usuário; Fase 4 concluída
- 2026-11-06 — 50% — Fase 5: chamada de vídeo dentro do app SSADesk (Electron + WebRTC)
- 2026-11-06 — 55% — Fase 5: microfone e câmera ligam sob demanda, cada lado o seu, testados no notebook
- 2026-11-06 — 60% — Fase 5: janela flutuante estilo FaceTime, redimensionável, com sua imagem arrastável/redimensionável; Fase 5 concluída
- 2026-11-06 — 60% — Chat de texto da chamada (janela flutuante, som de aviso, não lidas) validado em modo demonstração
- 2026-11-06 — 60% — Fase 6 (em teste): chamada e chat reais pelo canal P2P próprio; app em segundo plano para receber chamadas (v3.1)
- 2026-11-06 — 60% — v3.2: instalação mais rápida (chave calculada na hora, diagnóstico em segundo plano, pacote 258→193 MB) e conexão mais rápida (túnel dentro do app com rede P2P aquecida: ~8 s → ~1 s)
- 2026-11-06 — 60% — v3.2.1/3.2.2: limpeza de instalação interrompida; Setup detecta o Controle Inteligente de Aplicativos e orienta o usuário (o 2º notebook bloqueou o app por falta de assinatura digital)
- 2026-11-06 — 60% — v3.3: instalador abre em ~2 s (telas na janela leve WebView2 do Windows; pacote pesado extraído em segundo plano), túnel usa o motor do app (sem Node separado), Setup 193→162 MB; pendrive com atalho de um clique para a tela do Controle Inteligente de Aplicativos
