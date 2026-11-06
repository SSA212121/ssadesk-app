#!/bin/bash
# SSADesk (macOS) - abre o túnel P2P até o outro computador e conecta o RustDesk por ele.
APP="$HOME/Library/Application Support/SSADesk"
KEY="$(echo "$1" | tr -d '[:space:]' | tr 'A-F' 'a-f')"
RD="/Applications/RustDesk.app/Contents/MacOS/RustDesk"
LOG="$APP/conectar.log"
avisar() { osascript -e "display notification \"$1\" with title \"SSADesk\"" >/dev/null 2>&1; }

if ! [[ "$KEY" =~ ^[0-9a-f]{64}$ ]]; then
  osascript -e 'display alert "SSADesk" message "Chave inválida. Ela tem 64 letras e números (0-9, a-f)."' >/dev/null
  exit 1
fi
echo "$KEY" > "$APP/ultima-chave.txt"

# Porta local livre para a entrada do túnel
PORT="$("$APP/node" -e 'const s=require("net").createServer().listen(0,"127.0.0.1",()=>{console.log(s.address().port);s.close()})')"

avisar "Conectando pela internet..."
"$APP/node" "$APP/p2p/node_modules/hypertele/client.js" -p "$PORT" -s "$KEY" > "$LOG" 2>&1 &
TUN=$!
for i in $(seq 1 30); do
  lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1 && break
  sleep 0.5
done

"$RD" --connect "127.0.0.1:$PORT" >/dev/null 2>&1 &

# Mantém o túnel enquanto houver conexão passando por ele (ou a janela ainda estiver abrindo)
START=$(date +%s)
while kill -0 "$TUN" 2>/dev/null; do
  sleep 3
  if lsof -nP -iTCP@127.0.0.1:"$PORT" -sTCP:ESTABLISHED >/dev/null 2>&1; then continue; fi
  [ $(( $(date +%s) - START )) -lt 90 ] && continue
  break
done
kill "$TUN" 2>/dev/null
