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
