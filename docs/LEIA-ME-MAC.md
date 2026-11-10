# SSAdesk no Mac — como instalar e usar

Este guia é para quem vai usar o SSAdesk num Mac para acessar um computador Windows da SSA Comércio.

## 1. Qual arquivo baixar

No Google Drive há dois arquivos. Use o do seu Mac:

| Seu Mac | Arquivo |
|---|---|
| Processador Apple (M1, M2, M3, M4…) | `SSAdesk-…-mac-arm64.dmg` |
| Processador Intel | `SSAdesk-…-mac-x64.dmg` |

Para saber qual é o seu: menu  (maçã) > **Sobre Este Mac**. Se aparecer "Chip Apple M…", é o **arm64**. Se aparecer "Processador Intel", é o **x64**.

## 2. Instalar

1. Dê dois cliques no `.dmg` baixado.
2. Arraste o **SSAdesk** para a pasta **Aplicativos**.
3. Feche a janela do `.dmg` e ejete o disco "SSAdesk" (botão de ejetar na barra lateral do Finder).

## 3. Primeira abertura (aviso de "desenvolvedor não identificado")

O SSAdesk ainda não tem a assinatura paga da Apple. Por isso, na primeira vez, o Mac avisa que não pode verificar o desenvolvedor. Para abrir:

1. Abra a pasta **Aplicativos**.
2. Clique no **SSAdesk** com o **botão direito** (ou Control + clique) e escolha **Abrir**.
3. Na mensagem que aparece, clique em **Abrir** de novo.

Nos Macs com macOS 15 (Sequoia) ou mais novo, se não aparecer o botão Abrir:

1. Tente abrir o SSAdesk normalmente uma vez (vai aparecer o aviso; clique em OK).
2. Abra **Ajustes do Sistema** > **Privacidade e Segurança**.
3. Role até o fim: aparece "O SSAdesk foi bloqueado…". Clique em **Abrir Mesmo Assim** e confirme com sua senha do Mac.

Isso só é preciso na primeira vez.

## 4. Permissões do Mac

Para **acessar** outro computador, o Mac não precisa de nenhuma permissão especial.

Se usar a **chamada de vídeo**, o Mac pergunta se o SSAdesk pode usar a **câmera** e o **microfone**: clique em **Permitir**.

## 5. Acessar o computador Windows

1. Abra o SSAdesk.
2. Digite o código de 9 dígitos do computador Windows (aparece no SSAdesk dele, em "Este computador").
3. Clique em **Acesso remoto**.
4. Do outro lado, a pessoa clica em **Permitir** (ou o computador já tem "Permitir sempre" para você).

Durante a conexão, a barrinha do SSAdesk fica no topo da tela remota: chat, lousa, chamada, ⓘ, ⋯ (mais opções) e o **X** para encerrar.

## Limitações desta primeira versão para Mac

- O Mac **acessa** computadores Windows. Ser acessado (outro computador controlar o Mac) ainda não está pronto.
- Sem a assinatura paga da Apple (US$ 99/ano), o aviso da primeira abertura continua aparecendo para cada pessoa nova.
