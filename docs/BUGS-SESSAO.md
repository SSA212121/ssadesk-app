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
| 23 | Usabilidade | Instalador abriu atrás da janela do Explorador (não vem para a frente) | Pendente |
| 24 | Visual | Tela inicial do instalador mostra "Versão 4.1.0" (desatualizada) | Pendente |
| 25 | Usabilidade | Barra de ferramentas da tela remota cobre o conteúdo (tapou a barra de endereço do Explorador remoto) | Pendente |
| 26 | Funcional | Texto colado pela área de transferência não chegou no computador remoto | Pendente: investigar |
| 27 | Usabilidade | Computadores já acessados abriam em "Escala original" | Corrigido no app (ajuste único na primeira abertura) |
