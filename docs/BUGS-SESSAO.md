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
| 11 | **Segurança** | Escudo vermelho na aba: conexão direta pela rede local (IP) não é criptografada pelo motor | Pendente: passar também a rede local pelo túnel criptografado |
| 12 | Funcional | Fechar a janela da tela remota não encerra a sessão do SSAdesk (barrinha/chamada continuam) | Pendente: decidir se encerra junto ou pergunta |
| 13 | Teste | As janelas do SSAdesk (barrinha, lousa, chamada, chat, ⓘ) ficam fora da captura de tela de propósito, então prints automáticos não as mostram | Testar com prints feitos pela pessoa no outro computador |
| 14 | Funcional | Reconexão pediu permissão? A reconexão abriu em ~6 s sem passar visivelmente pelo pedido | Verificar no outro computador |
