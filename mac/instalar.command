#!/bin/bash
# SSADesk para macOS - instalação limpa (remove a versão anterior antes de instalar).
# Instala: RustDesk oficial (Intel ou Apple Silicon), túnel P2P (Node.js + Hyperswarm)
# e o app "SSADesk - Conectar pela internet". Nada é baixado da internet: tudo vem do pendrive.
set -e
DIR="$(cd "$(dirname "$0")" && pwd)"
P="$DIR/payload"
APP="$HOME/Library/Application Support/SSADesk"
CONECTAR="/Applications/SSADesk - Conectar pela internet.app"

case "$(uname -m)" in
  arm64)  RD="rustdesk-arm64.dmg";  NODE="node-arm64.tar.gz" ;;
  x86_64) RD="rustdesk-x86_64.dmg"; NODE="node-x64.tar.gz" ;;
  *) echo "Processador não suportado: $(uname -m)"; exit 1 ;;
esac

echo "SSADesk - instalação ($(uname -m))"
echo

echo "1/5 Fechando e removendo versão anterior..."
osascript -e 'quit app "RustDesk"' >/dev/null 2>&1 || true
pkill -f "SSADesk/node" >/dev/null 2>&1 || true
sleep 2
rm -rf "/Applications/RustDesk.app" "$CONECTAR" "$APP"

echo "2/5 Instalando RustDesk oficial..."
MNT="$(mktemp -d /tmp/ssadesk-dmg.XXXX)"
hdiutil attach -nobrowse -readonly -quiet -mountpoint "$MNT" "$P/$RD"
cp -R "$MNT/RustDesk.app" /Applications/
hdiutil detach -quiet "$MNT" || true
xattr -dr com.apple.quarantine "/Applications/RustDesk.app" 2>/dev/null || true

echo "3/5 Instalando túnel P2P..."
mkdir -p "$APP"
TMP="$(mktemp -d)"
tar -xzf "$P/$NODE" -C "$TMP"
cp "$TMP"/node-*/bin/node "$APP/node"
chmod +x "$APP/node"
rm -rf "$TMP"
cp -R "$P/p2p" "$APP/p2p"
cp "$P/conectar.sh" "$APP/conectar.sh"
chmod +x "$APP/conectar.sh"
xattr -dr com.apple.quarantine "$APP" 2>/dev/null || true

echo "4/5 Configurando (sem servidores públicos do RustDesk)..."
CFG="$HOME/Library/Preferences/com.carriez.RustDesk"
mkdir -p "$CFG"
"$APP/node" -e '
const fs = require("fs"); const f = process.argv[1];
const want = { "custom-rendezvous-server": "127.0.0.1", "relay-server": "127.0.0.1",
               "api-server": "http://127.0.0.1", "enable-lan-discovery": "Y" };
let lines = fs.existsSync(f) ? fs.readFileSync(f, "utf8").split("\n") : [];
let i = lines.findIndex(l => l.trim() === "[options]");
if (i < 0) { lines.push("", "[options]"); i = lines.length - 1; }
let end = lines.findIndex((l, j) => j > i && /^\s*\[/.test(l)); if (end < 0) end = lines.length;
for (const [k, v] of Object.entries(want)) {
  const line = k + " = \x27" + v + "\x27";
  const at = lines.findIndex((l, j) => j > i && j < end && l.trim().startsWith(k + " "));
  if (at >= 0) lines[at] = line; else { lines.splice(end, 0, line); end++; }
}
fs.writeFileSync(f, lines.join("\n"));
' "$CFG/RustDesk2.toml"

echo "5/5 Criando o app 'SSADesk - Conectar pela internet'..."
osacompile -o "$CONECTAR" -e '
set f to (POSIX path of (path to home folder)) & "Library/Application Support/SSADesk/ultima-chave.txt"
set prev to ""
try
  set prev to do shell script "cat " & quoted form of f
end try
set r to display dialog "Cole a chave de internet do computador que você quer acessar." default answer prev with title "SSADesk - Conectar pela internet" buttons {"Cancelar", "Conectar"} default button "Conectar"
set k to text returned of r
do shell script "nohup " & quoted form of ((POSIX path of (path to home folder)) & "Library/Application Support/SSADesk/conectar.sh") & " " & quoted form of k & " >/dev/null 2>&1 &"
'
xattr -dr com.apple.quarantine "$CONECTAR" 2>/dev/null || true

echo
echo "Pronto! Para acessar um computador pela internet, abra em Aplicativos:"
echo "   SSADesk - Conectar pela internet"
echo "Na mesma rede, abra o RustDesk e digite o IP do outro computador."
echo
read -n 1 -s -r -p "Pressione qualquer tecla para fechar."
