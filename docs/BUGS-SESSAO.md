# Bugs encontrados no teste da sessão (09/11/2026)

Teste feito no notebook SSA-Atendimento ("Augusto", 120 358 953) acessando o notebook "Samuel" (214 941 159) pela rede local, com a versão instalada antes das correções de hoje.

| # | Tipo | Bug | Situação |
|---|------|-----|----------|
| 1 | Visual | Acentos quebrados no painel: "DisponÃvel", "rÃ¡pidoâ€¦" (arquivo gravado com codificação errada) | Corrigido |
| 2 | Visual | Título da janela remota em inglês: "192.168.3.22 - Remote Desktop" | Corrigido: "Tela remota - nome" |
| 3 | Visual | Aba da tela remota mostrava "192.168.3.22@samuel" | Corrigido (apelido com o nome do computador); confirmado "Samuel" na reconexão |
| 4 | Funcional | Painel continua com "Conectado a Samuel. Digite a senha dele." depois de fechar a tela remota | Corrigido: mostra "Conexão com Samuel encerrada." |
| 5 | Funcional | "Digite a senha dele" aparece mesmo quando a senha foi entregue automaticamente | Corrigido |
| 6 | Funcional | Tela de senha do motor sempre aparece | Corrigido: some após Permitir / Permitir sempre (precisa reinstalar) |
| 7 | Funcional | Dois mouses: o cursor do outro computador não aparece | Corrigido: "Mostrar cursor remoto" ligado por padrão |
| 8 | Visual | Tela remota abre em "Escala original" (pode cortar a tela) | Corrigido: "Escala adaptada" por padrão |
| 9 | Visual | Barra do motor tem Chat próprio, duplicando o chat do SSAdesk | Corrigido: removido da barra do motor |
| 15 | Visual | Tela remota com aba no estilo do motor (aba, "+", X da aba) | Corrigido: barra de título "SSAdesk · nome", conferida na tela |
| 10 | Visual | Barra do motor recolhe sozinha quando o mouse sai, dificultando os menus | Pendente (avaliar fixar por padrão) |
| 11 | **Segurança** | Escudo vermelho na aba: conexão direta pela rede local (IP) não é criptografada pelo motor | Corrigido: a tela vai sempre pelo túnel criptografado (testado com o Samuel: conectou em 7 s via túnel); escudo verde no túnel; IP direto só como reserva |
| 12 | Funcional | Fechar a janela da tela remota não encerra a sessão do SSAdesk (barrinha/chamada continuam) | Pendente: decidir se encerra junto ou pergunta |
| 13 | Teste | As janelas do SSAdesk (barrinha, lousa, chamada, chat, ⓘ) ficam fora da captura de tela de propósito, então prints automáticos não as mostram | Testar com prints feitos pela pessoa no outro computador |
| 14 | Funcional | Reconexão pediu permissão? A reconexão abriu em ~6 s sem passar visivelmente pelo pedido | Verificar no outro computador |
| 16 | Funcional | Computador já em sessão derrubava a segunda conexão sem explicar ("O outro computador encerrou a conexão") | Corrigido: avisa "Esse computador já está em outra conexão agora" |
| 17 | Visual | Janela de arquivos (e câmera) com aba e "+" no estilo do motor | Corrigido: barra de título simples, conferida na tela |
| 18 | Usabilidade | Menu de ações com itens técnicos/duplicados: Terminal (beta), Tunelamento TCP, Visualizar câmera, Anotações | Corrigido: removidos, conferido na tela |
| 19 | Usabilidade | Menus de exibição e teclado com opções técnicas: Codec, Tela virtual, Modo legado/mapa/traduzido, Fonte de entrada | Corrigido: Codec, Tela virtual, modos de teclado e fonte de entrada ocultos |
| 20 | Usabilidade | REC grava sem avisar onde salvou; nome técnico (outgoing_192.168.3.22_…_vp9.webm em Vídeos\SSAdesk) | Pendente: nome amigável e aviso ao terminar (exige mudar o motor em Rust) |
| 21 | Visual | Ainda aparecem no menu de exibição: Cor verdadeira (4:4:4) e Modo privado | Pendente: avaliar se ficam (Modo privado esconde a tela do acessado, pode ser útil) |
| 22 | Usabilidade | Escala adaptada só vale para computadores novos; quem já tinha sido acessado continua em "Escala original" | Pendente |
| 23 | Usabilidade | Instalador abriu atrás da janela do Explorador (não vem para a frente) | Corrigido e conferido (4.5.0 abre na frente) |
| 24 | Visual | Tela inicial do instalador mostra "Versão 4.1.0" (desatualizada) | Corrigido e conferido (4.5.0) |
| 25 | Usabilidade | Barra de ferramentas da tela remota cobre o conteúdo (tapou a barra de endereço do Explorador remoto) | Pendente |
| 26 | Funcional | Texto colado pela área de transferência não chegou no computador remoto | Pendente: investigar |
| 27 | Usabilidade | Computadores já acessados abriam em "Escala original" | Corrigido no app (ajuste único na primeira abertura) |
| 28 | Funcional | Atualizar exigia digitar a senha de novo | Corrigido: botão "Manter a senha atual" (só aparece em atualização e confere que a senha existe); conferido na tela |
| 29 | Visual | Diálogos do motor com ícones nos botões (Substituir, erro, senha) | Corrigido: botões só com texto |
| 30 | Visual | Erros técnicos/inglês: "os error 10054", "Failed to connect to 192.168.3.22:21118" | Corrigido: frases simples em português |
| 31 | Visual | Erro de conexão oferecia "Conectar via relay" (recurso do RustDesk) | Corrigido: botão removido |
| 32 | Usabilidade | Janela de arquivos não lembra as pastas usadas da última vez | Pendente |
| 33 | Funcional | Depois de atualizar pelo acesso remoto, o Samuel não voltou a aceitar conexão (porta 21118 fechada, túnel não responde) | Pendente: verificar no local se a instalação terminou |

| 34 | Funcional | Instalação 'Manter a senha atual' dava erro (arquivo de senha vazio quebrava o script) | Corrigido e testado no Samuel: reinstalou e aceitou a mesma senha |
| 35 | Funcional | Faltava ver/alterar senha e revogar acessos | Feito: Ajustes > Senha de acesso; Mostrar e Revogar testados no Samuel (Alterar não testado: exige digitar senha nova) |
| 36 | Visual | Erro de conexão ainda oferecia 'Conectar via relay' (segundo lugar no motor) | Corrigido |
| 37 | Visual | Moldura quadrada de seleção em botões | Corrigido em todas as telas do app e no motor |

| 38 | **Segurança** | Porta 21118 do motor aberta na rede (e no roteador via UPnP/NAT-PMP): quem estivesse na rede com a senha entrava direto, sem o pedido Permitir/Negar | Corrigido: porta bloqueada no firewall e não é mais aberta no roteador; só o túnel do SSAdesk entra |
| 39 | Funcional | Preferências (nome, lista) podiam ser apagadas se lidas no meio de uma gravação | Corrigido: gravação segura com cópia de reserva |
| 40 | Visual | Painel abre em branco por alguns segundos logo após a instalação | Pendente |
| 41 | Funcional | Instalador aberto pela tela remota pula as telas e já instala | Pendente: investigar |

## Auditoria por simulação de dois usuários (10/11/2026, só neste notebook)

| # | Tipo | Bug | Situação |
|---|------|-----|----------|
| 42 | Funcional | Lousa abria só para quem clicou; fechar também só fechava de um lado | Corrigido: abre e fecha nos dois lados (testado) |
| 43 | Visual | Barra da lousa ficava por cima da barrinha da sessão de quem é acessado (as duas embaixo) | Corrigido: para quem é acessado a barra da lousa vai para o topo |
| 44 | **Funcional** | Quem é acessado apertava X, mas quem acessa reconectava sozinho ("Reconectado ✓") | Corrigido: o X de qualquer lado encerra de vez, fecha a tela remota e avisa "Fulano encerrou a conexão." (testado) |
| 45 | Visual | Anel azul de foco ficava preso no botão da câmera depois que a chamada fechava | Corrigido |
| 46 | Visual | Painel com espaço vazio embaixo quando a lista de computadores está vazia (altura mínima 480) | Melhorado (mínimo 360); ainda sobra um vão pequeno |
| — | OK | Chat nos dois sentidos, selo de não lida, HTML não é interpretado, mensagem vazia não envia | Testado |
| — | OK | Chamada abre nos dois lados, encerrar de um lado fecha os dois | Testado |
| — | OK | ⓘ e ⋯ Mais opções (clique duplo não trava o menu; clicar fora fecha) | Testado. ⋯ é só de quem acessa, por ser comando da tela remota |
| 47 | Usabilidade | Barrinha de quem acessa no topo e de quem é acessado embaixo; cada um via a barrinha do outro na tela | Corrigido: cada um vê só a própria, as duas no topo e no mesmo lugar (não há clique "invisível") |
| 48 | Funcional | Chat não aparecia em tempo real (só selo; era preciso abrir) | Corrigido: mensagem nova abre a conversa na hora, sem roubar o foco |

## Teste real nos dois notebooks (10/11/2026)

| # | Tipo | Bug | Situação |
|---|------|-----|----------|
| 49 | **Funcional** | Versão nova derrubava a sessão do SSAdesk após 30 s quando o outro lado é de versão anterior (sem "sinal de vida"); a imagem continuava, mas chat/arquivos/barrinha morriam ("Conexão encerrada" no outro lado) | Corrigido: o limite de 30 s só vale se o outro lado também manda sinal de vida |
| 50 | **Funcional** | Comandos da barrinha para a tela remota (⋯ Mais opções, X fecha a tela) não chegam ao motor na versão instalada: "fechar", "tela-cheia" e "arquivos" ignorados | Pendente: investigar no motor (observador de comando-tela.json) |
| 51 | Funcional | "Enviar para > SSAdesk" falha sem o arquivo chegar quando a sessão do SSAdesk já caiu (só a imagem continuava) | Consequência do 49 |
| 52 | Usabilidade | Conectar fica girando mais de 2 min sem mensagem nem limite de tempo; o texto antigo ("Conexão encerrada") continua embaixo | Pendente |
| 53 | **Segurança** | A senha aparece na linha de comando do motor (--password), visível para outros programas do mesmo usuário | Pendente: passar por arquivo temporário/canal |
| 54 | Teste | Cópias de teste gravavam comando-tela.json na pasta real do SSAdesk | Anotado |
| 55 | **Funcional** | "Enviar para" pela versão de teste mandou a pasta do app inteira (o Electron reordena os argumentos e o "." entrou na lista) | Corrigido: só caminhos de arquivo; a pasta do próprio app nunca é enviada. Itens enviados por engano foram para a Lixeira do Samuel |
| 56 | — | (Engano) O processo "administrador" que não fechava era o túnel do SSAdesk, que roda como serviço do Windows | Não é bug |
| 57 | — | (Engano) mesma causa do 56 | Não é bug |
| 58 | Funcional | O nome do computador ("Augusto") sumiu das preferências | Pendente: investigar quem gravou sem o nome |
| 59 | Usabilidade | "Aguardando permissão…" sem limite: mais de 1 min girando sem dizer que o outro lado precisa clicar Permitir | Pendente |
| 60 | OK | Instalador aberto pela tela remota mostrou todas as telas (bug 41 não se repetiu) e "Manter a senha atual" funcionou | Testado |
| 61 | **Funcional** | Em tela cheia, a tela remota ficava por cima da barrinha: quem acessa não via a própria barra (nem chat, ⓘ, ⋯) | Corrigido: barrinha e janelas dela no nível mais alto, acima da tela remota e da lousa; testado no Samuel |
| 62 | **Funcional** | X da barrinha fechava a sessão, mas a tela remota ficava aberta (o motor perguntava "Tem certeza?" escondido) | Corrigido no motor: fecha direto |
| 63 | Visual | Ao sair da tela cheia, a janela remota fica parcialmente fora da tela | Pendente |
| 64 | Visual | ⓘ mostra "Internet - P2P direto" com os dois na mesma rede | Pendente |
| 65 | Visual | Barrinha cobre o meio da barra de título da janela de arquivos | Pendente |
| 66 | Funcional | Pedido antigo preso em "Aguardando permissão…" depois de reinstalar o outro lado; só reabrindo o app | Pendente |
| — | OK | Comandos do ⋯ (Tela cheia, Transferir arquivos) funcionam; a falha anterior era da cópia rodando como administrador | Testado |
| — | OK | Chat, lousa, ⓘ e ⋯ abrem por cima da tela remota | Testado |
| 67 | Usabilidade | Barrinha de quem acessa ficava solta no topo da tela, fora da janela da tela remota | Corrigido: presa ao topo da janela remota (segue e some ao minimizar); testado |
| 68 | Usabilidade | Barrinha não podia ser recolhida | Feito: botão ^ recolhe para cima; fica uma abinha no centro do topo que traz de volta; testado |
| 69 | Funcional | Ao encerrar, o chat continuava aberto no outro computador | Corrigido: chat, ⋯ e ⓘ fecham junto ao encerrar (dos dois lados); testado do lado de quem acessa |
| 70 | Usabilidade | Chat aberto pela barrinha vinha sem o cursor no campo (o texto ia para a tela remota) | Corrigido |
| — | OK | X fecha tela remota, barrinha e chat de uma vez (motor novo) | Testado |
| 71 | Visual | Painel de quem é acessado mantinha "Fulano encerrou a conexão" durante a sessão nova | Corrigido |
| 72 | Funcional | Chat abria sem foco também na 2ª tentativa (a tela remota tomava o foco de volta) | Corrigido: o chat insiste no foco; testado digitando sem clicar |
| — | OK (Samuel, confirmado no local) | Barrinha no topo, recolher/abinha, chat em tempo real (mensagem e resposta) e fechamento de tudo pelo X | Testado nos dois notebooks |
| 73 | Funcional | "Aguardando permissão…" infinito: o limite de tempo de uma tentativa anterior apagava o pedido da tentativa nova sem avisar | Corrigido: cada tentativa tem o próprio limite; depois de achar o computador, 60 s para alguém permitir, com aviso claro ("Peça para clicarem em Permitir") |
| 74 | Visual | ⓘ mostrava "Internet" com os dois na mesma rede (o túnel é sempre 127.0.0.1) | Corrigido: mostra "Rede local · P2P direto" quando o túnel passa pela rede local |
