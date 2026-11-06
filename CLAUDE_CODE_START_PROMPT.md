Estou na pasta do projeto SSADesk (C:\Users\LENOVO\Desktop\SSADesk). Leia primeiro README.md, DESIGN_GUIDELINES.md e PROGRESS.md nesta pasta antes de qualquer coisa — eles definem arquitetura, identidade visual e o plano de fases.

Contexto resumido: a SSA Comércio precisa de um substituto próprio do AnyDesk porque ele passou a cobrar e está derrubando a conexão do financeiro a cada 5 minutos. O financeiro trabalha de Itajaí (Mac) acessando o servidor com o InfoArte em Lages (Windows). Decidimos usar o RustDesk (open source, AGPL) self-hosted como base em vez de construir um protocolo de acesso remoto do zero — isso é inviável em prazo curto e com poucos tokens. Por cima disso, construímos um app próprio de chamada de vídeo bidirecional (estilo FaceTime/Google Meet), independente da sessão de controle de tela.

Trabalhe em fases, exatamente na ordem do PROGRESS.md. Regras:
1. Antes de iniciar uma fase, confirme rapidamente comigo (uma frase) o que vai fazer, só se houver uma decisão ambígua — senão, comece direto.
2. Ao concluir cada subtarefa, marque o checkbox correspondente em PROGRESS.md, recalcule e atualize a "Progresso total: XX%" no topo do arquivo, e adicione uma linha no histórico de atualizações no final do arquivo.
3. Ao chegar em 90% (fim da Fase 6), pare e me avise explicitamente: "SSADesk funcional, pronto para uso — restam refinamentos (Fase 7)". Não continue para a Fase 7 sem eu confirmar.
4. Toda interface (janela de configuração, app de chamada de vídeo) deve seguir DESIGN_GUIDELINES.md à risca: estética Apple/FaceTime, minimalista, moderna, com suporte a tema claro/escuro/automático.
5. Não reproduza nem se baseie em código do AnyDesk. A base de acesso remoto é o RustDesk (rustdesk/rustdesk e rustdesk/rustdesk-server), que você deve clonar/configurar, não reescrever do zero.
6. Segurança mínima inegociável: acesso desassistido com senha/chave permanente fixa (nunca "sem senha nenhuma"), servidor próprio (não os servidores públicos do RustDesk).
7. Sempre que terminar uma fase inteira, me dê um resumo curto do que foi feito e o que falta, sem listar cada etapa técnica.

Comece agora pela Fase 0.
