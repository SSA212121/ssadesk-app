# installer/: SSADesk-Setup.exe

Um único instalador, **igual para todos os computadores Windows**. Toda instalação:

- acessa outros computadores **e** pode ser acessada;
- conecta por **IP direto, IPv4 e IPv6** (porta TCP 21118), sem servidor central, VPS ou terceiros;
- recebe um **código único**;
- só aceita acesso com a **senha permanente** definida na instalação (mínimo 8 caracteres; sem senha temporária, sem "aceitar com clique").

## Instalar

Dois cliques → escolher disco/pasta → senha permanente (2x) → Instalar. Não reinicia o Windows nem fecha programas.
A tela final mostra o código e os endereços; tudo fica salvo em `<pasta>\SSADESK-ESTE-COMPUTADOR.txt`.

## Conectar a outro computador

Abra o SSADesk (RustDesk) e, no campo de ID, digite o endereço do outro computador:

| Situação | O que digitar | Precisa configurar roteador? |
|---|---|---|
| Mesma rede | IPv4 local, ex. `192.168.3.17` | Não |
| Internet, rede com IPv6 | IPv6 entre colchetes, ex. `[2804:...]` | Normalmente não (alguns roteadores bloqueiam IPv6 de entrada) |
| Internet, só IPv4 | IP público do lado acessado | Sim: redirecionar TCP 21118 → computador acessado |

Depois, digite a senha permanente do computador acessado.

## Diagnóstico automático de rede

Na instalação, e depois a cada inicialização e a cada hora (tarefa `SSADesk-rede`), o `network.ps1`:
- descobre IPv4 local e IPv6 público;
- tenta abrir a porta 21118 no roteador sozinho via **UPnP** (ninguém precisa entrar no roteador);
- detecta **CGNAT** (IP compartilhado pelo provedor, onde nada local resolve);
- explica o resultado em linguagem simples em `SSADESK-ESTE-COMPUTADOR.txt` (e `rede.json`).

O IP público é consultado em `api.ipify.org` só para o diagnóstico.

## Detalhes técnicos

- `configure.ps1` instala o MSI oficial do RustDesk 1.5.1 e ativa `direct-server` na porta 21118 (o RustDesk escuta em `::`, que atende IPv4 e IPv6).
- Um `hbbs` local (rustdesk-server 1.1.16, portas 21125-21128, bloqueado no firewall para acesso de fora) existe só para o RustDesk ficar "pronto" sem tentar os servidores públicos.
- Firewall: libera só TCP 21118 para o `rustdesk.exe`.
- Desinstalar: Painel de Controle → SSADesk. Remove o RustDesk, a tarefa e as regras de firewall.

## Gerar o instalador

`powershell -ExecutionPolicy Bypass -File installer\build.ps1` → `dist\SSADesk-Setup.exe`. Requer Inno Setup 6.
