// SSADesk — processo principal (Electron).
// Janela com material de vidro nativo (Acrylic no Windows 11, vibrancy no macOS),
// tema Automático/Claro/Escuro e ações: copiar, conectar por IP ou por chave de internet (túnel P2P).
const { app, BrowserWindow, ipcMain, nativeTheme, clipboard, shell, dialog } = require('electron')
const path = require('path')
const fs = require('fs')
const net = require('net')
const { spawn } = require('child_process')

const isMac = process.platform === 'darwin'
const isWin = process.platform === 'win32'

// Modos: app normal | --instalar --payload=<pasta> (tela de instalação) | --desinstalar
const arg = n => { const a = process.argv.find(x => x.startsWith('--' + n)); return a ? (a.split('=')[1] || true) : null }
const MODO = arg('instalar') ? 'instalar' : arg('desinstalar') ? 'desinstalar' : 'app'
const PAYLOAD = typeof arg('payload') === 'string' ? arg('payload').replace(/^"|"$/g, '') : null
const motor = isWin ? require('./instalador') : null

// Pasta de instalação do SSADesk (onde ficam código, chave, RustDesk e túnel)
function installDir () {
  if (process.env.SSADESK_DIR) return process.env.SSADESK_DIR
  if (app.isPackaged && isWin) return path.resolve(path.dirname(process.execPath), '..')
  if (isMac) return path.join(app.getPath('home'), 'Library', 'Application Support', 'SSADesk')
  return 'C:\\SSADesk'
}
const DIR = installDir()
const prefsFile = () => path.join(app.getPath('userData'), 'preferencias.json')

function readText (p) { try { return fs.readFileSync(p, 'utf8').replace(/^\uFEFF/, '').trim() } catch { return '' } }
function readJson (p) { try { return JSON.parse(readText(p)) } catch { return null } }
function loadPrefs () { return readJson(prefsFile()) || { tema: 'system' } }
function savePrefs (p) { fs.mkdirSync(path.dirname(prefsFile()), { recursive: true }); fs.writeFileSync(prefsFile(), JSON.stringify(p)) }

let win
function createWindow () {
  const prefs = loadPrefs()
  nativeTheme.themeSource = prefs.tema || 'system'

  win = new BrowserWindow({
    width: 400,
    height: 612,
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    show: false,
    title: 'SSADesk',
    icon: path.join(__dirname, 'assets', 'icon.png'),
    backgroundColor: '#00000000',
    // Vidro nativo
    ...(isWin ? { titleBarStyle: 'hidden', backgroundMaterial: 'acrylic' } : {}),
    ...(isMac ? { titleBarStyle: 'hiddenInset', vibrancy: 'under-window', visualEffectState: 'active', trafficLightPosition: { x: 18, y: 20 } } : {}),
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, sandbox: true }
  })
  const pagina = MODO === 'app' ? 'index.html' : 'setup.html'
  const query = { platform: process.platform }
  if (process.env.SSADESK_PAGE) query.pagina = process.env.SSADESK_PAGE
  win.loadFile(path.join(__dirname, 'src', pagina), { query })
  win.once('ready-to-show', () => {
    if (process.env.SSADESK_SNAPSHOT && !process.env.SSADESK_CALL) return snapshot(win)
    win.show()
  })
}

// ---------- Janela de chamada de vídeo (estilo FaceTime) ----------
// Independente da sessão de controle de tela: abrir/fechar a chamada não afeta o RustDesk.
let callWin = null
function abrirChamada (dados = {}) {
  if (callWin && !callWin.isDestroyed()) { callWin.show(); callWin.focus(); return }
  // Janela pequena, flutuante e sempre no topo (canto inferior direito), redimensionável à vontade
  const area = require('electron').screen.getPrimaryDisplay().workArea
  const W = 360; const H = 270
  callWin = new BrowserWindow({
    width: W, height: H, minWidth: 200, minHeight: 150,
    x: area.x + area.width - W - 24, y: area.y + area.height - H - 24,
    alwaysOnTop: true, skipTaskbar: false,
    show: false, title: 'SSADesk — Chamada', backgroundColor: '#000000',
    icon: path.join(__dirname, 'assets', 'icon.png'),
    ...(isWin ? { titleBarStyle: 'hidden', roundedCorners: true } : {}),
    ...(isMac ? { titleBarStyle: 'hiddenInset', trafficLightPosition: { x: 16, y: 16 } } : {}),
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, sandbox: true }
  })
  callWin.loadFile(path.join(__dirname, 'src', 'chamada.html'), { query: { platform: process.platform, nome: dados.nome || '', demo: process.env.SSADESK_DEMO ? '1' : '' } })
  callWin.once('ready-to-show', () => {
    if (process.env.SSADESK_SNAPSHOT && process.env.SSADESK_CALL) return snapshot(callWin)
    callWin.show()
  })
  callWin.setAlwaysOnTop(true, 'floating')
  callWin.on('closed', () => {
    callWin = null
    // Fim da chamada: fecha o chat e apaga a conversa
    if (chatWin && !chatWin.isDestroyed()) { chatWin.destroy() }
    chatWin = null; mensagens.length = 0
  })
}
ipcMain.on('abrir-chamada', (_e, dados) => abrirChamada(dados))

// ---------- Chat de texto (janela própria, flutuante e redimensionável) ----------
// A conversa fica aqui no processo principal: guardar a janela não apaga nada.
const mensagens = []
let chatWin = null
const chatVisivel = () => !!(chatWin && !chatWin.isDestroyed() && chatWin.isVisible() && !chatWin.isMinimized())
function avisarVisibilidade () { if (callWin && !callWin.isDestroyed()) callWin.webContents.send('chat-visivel', chatVisivel()) }

function abrirChatJanela () {
  if (chatWin && !chatWin.isDestroyed()) { chatWin.show(); chatWin.focus(); avisarVisibilidade(); return }
  const W = 300; const H = 420
  const ref = callWin && !callWin.isDestroyed() ? callWin.getBounds() : null
  const area = require('electron').screen.getPrimaryDisplay().workArea
  const x = ref ? Math.max(area.x, ref.x - W - 12) : area.x + area.width - W - 24
  const y = ref ? Math.max(area.y, ref.y + ref.height - H) : area.y + area.height - H - 24
  chatWin = new BrowserWindow({
    width: W, height: H, minWidth: 240, minHeight: 260, x, y,
    alwaysOnTop: true, show: false, title: 'SSADesk — Mensagens', backgroundColor: '#00000000',
    icon: path.join(__dirname, 'assets', 'icon.png'),
    ...(isWin ? { titleBarStyle: 'hidden', backgroundMaterial: 'acrylic' } : {}),
    ...(isMac ? { titleBarStyle: 'hiddenInset', vibrancy: 'hud', visualEffectState: 'active' } : {}),
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, sandbox: true }
  })
  chatWin.setAlwaysOnTop(true, 'floating')
  chatWin.loadFile(path.join(__dirname, 'src', 'chat.html'))
  chatWin.once('ready-to-show', () => { chatWin.show(); avisarVisibilidade() })
  // Fechar = guardar (esconde, mantém a conversa)
  chatWin.on('close', e => { if (callWin && !callWin.isDestroyed()) { e.preventDefault(); chatWin.hide(); avisarVisibilidade() } })
  for (const ev of ['show', 'hide', 'minimize', 'restore']) chatWin.on(ev, avisarVisibilidade)
}

function registrar (texto, quem) {
  const m = { texto: String(texto).slice(0, 2000), quem, hora: Date.now() }
  mensagens.push(m)
  if (chatWin && !chatWin.isDestroyed()) chatWin.webContents.send('chat-msg', m)
  return m
}
// Recebida do outro lado (a Fase 6 chama esta função quando chega pelo túnel P2P)
function receberMensagem (texto) {
  if (!String(texto || '').trim()) return
  registrar(texto, 'outro')
  if (callWin && !callWin.isDestroyed()) callWin.webContents.send('chat-recebida', { visivel: chatVisivel() })
}
ipcMain.on('chat-abrir', () => abrirChatJanela())
ipcMain.handle('chat-historico', () => mensagens)
ipcMain.on('chat-enviar', (_e, texto) => {
  if (!String(texto || '').trim()) return
  registrar(texto, 'eu')
  // Fase 6: enviar ao outro computador. Modo demonstração: responde sozinho para testar.
  if (process.env.SSADESK_DEMO) setTimeout(() => receberMensagem('Recebi: ' + texto), 1400)
})
ipcMain.on('chat-janela', (_e, acao) => {
  if (!chatWin || chatWin.isDestroyed()) return
  if (acao === 'guardar') chatWin.hide()
  if (acao === 'minimizar') chatWin.minimize()
})
ipcMain.on('janela-chamada', (_e, acao) => {
  if (!callWin) return
  if (acao === 'fechar') callWin.close()
  if (acao === 'minimizar') callWin.minimize()
  if (acao === 'tela-cheia') callWin.setFullScreen(!callWin.isFullScreen())
})

// Pré-visualização (usada no build para validar o visual): salva PNG e fecha
async function snapshot (w) {
  if (process.env.SSADESK_THEME) nativeTheme.themeSource = process.env.SSADESK_THEME
  w.setOpacity(0); w.show()
  await new Promise(r => setTimeout(r, 2500))
  const img = await w.webContents.capturePage()
  fs.writeFileSync(process.env.SSADESK_SNAPSHOT, img.toPNG())
  app.quit()
}

// ---------- Informações deste computador ----------
ipcMain.handle('info', () => {
  const rede = readJson(path.join(DIR, 'rede.json'))
  const chave = readText(path.join(DIR, 'chave-internet.txt'))
  let status = { tipo: 'desconhecido', texto: 'Verificando rede' }
  if (rede) {
    if (rede.internet_ipv6 || rede.internet_ipv4) status = { tipo: 'ok', texto: 'Disponível pela internet' }
    else if (chave) status = { tipo: 'ok', texto: 'Disponível pela internet' }
    else status = { tipo: 'local', texto: 'Disponível na rede local' }
  }
  return {
    codigo: readText(path.join(DIR, 'codigo.txt')),
    chave,
    ipLocal: rede && rede.ipv4_local,
    status,
    tema: loadPrefs().tema || 'system',
    plataforma: process.platform
  }
})

ipcMain.handle('copiar', (_e, texto) => { clipboard.writeText(String(texto || '')); return true })

ipcMain.handle('tema', (_e, tema) => {
  if (!['system', 'light', 'dark'].includes(tema)) return
  nativeTheme.themeSource = tema
  savePrefs({ ...loadPrefs(), tema })
})

ipcMain.on('janela', (_e, acao) => {
  if (acao === 'fechar') win.close()
  if (acao === 'minimizar') win.minimize()
})

// ---------- Conectar ----------
function rustdeskPath () {
  if (isMac) return '/Applications/RustDesk.app/Contents/MacOS/RustDesk'
  const base = path.join(DIR, 'RustDesk')
  for (const n of ['rustdesk.exe', 'RustDesk.exe']) { const p = path.join(base, n); if (fs.existsSync(p)) return p }
  return null
}
function freePort () {
  return new Promise(resolve => { const s = net.createServer().listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => resolve(port)) }) })
}
function waitPort (port, ms) {
  const end = Date.now() + ms
  return new Promise(resolve => {
    const tryOnce = () => {
      const c = net.connect(port, '127.0.0.1')
      c.once('connect', () => { c.destroy(); resolve(true) })
      c.once('error', () => { c.destroy(); Date.now() > end ? resolve(false) : setTimeout(tryOnce, 300) })
    }
    tryOnce()
  })
}
function abrirRustDesk (destino) {
  const exe = rustdeskPath()
  if (!exe || !fs.existsSync(exe)) throw new Error('SSADesk não está instalado corretamente.')
  spawn(exe, ['--connect', destino], { detached: true, stdio: 'ignore' }).unref()
}

ipcMain.handle('conectar', async (_e, destinoBruto) => {
  const destino = String(destinoBruto || '').replace(/\s/g, '')
  if (!destino) return { ok: false, msg: 'Digite um IP ou uma chave.' }
  try {
    if (/^[0-9a-fA-F]{64}$/.test(destino)) {
      // Qualquer rede: túnel P2P (continua aberto mesmo se esta janela fechar)
      const port = await freePort()
      if (isWin) {
        spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-WindowStyle', 'Hidden', '-File',
          path.join(DIR, 'tools', 'tunel.ps1'), '-Key', destino.toLowerCase(), '-Port', String(port)],
        { detached: true, stdio: 'ignore', windowsHide: true }).unref()
      } else {
        spawn('/bin/bash', [path.join(DIR, 'conectar.sh'), destino.toLowerCase(), String(port)], { detached: true, stdio: 'ignore' }).unref()
      }
      if (!(await waitPort(port, 20000))) return { ok: false, msg: 'Não foi possível abrir o túnel.' }
      abrirRustDesk('127.0.0.1:' + port)
      return { ok: true, msg: 'Conectando. A primeira vez leva alguns segundos.' }
    }
    if (/^[0-9a-zA-Z.:\-[\]%]+$/.test(destino)) {
      abrirRustDesk(destino)
      return { ok: true, msg: 'Conectando.' }
    }
    return { ok: false, msg: 'IP ou chave inválidos.' }
  } catch (e) {
    return { ok: false, msg: e.message }
  }
})

ipcMain.on('abrir-pasta', () => shell.openPath(DIR))

// ---------- Instalação / desinstalação (telas glass) ----------
ipcMain.handle('setup-info', () => ({
  modo: MODO,
  versao: app.getVersion(),
  destino: (motor && motor.instalacaoAnterior()) || 'C:\\SSADesk',
  passos: motor ? motor.PASSOS : []
}))

ipcMain.handle('setup-pasta', async (_e, atual) => {
  const r = await dialog.showOpenDialog(win, {
    title: 'Onde instalar o SSADesk', defaultPath: path.dirname(atual || 'C:\\SSADesk'),
    properties: ['openDirectory', 'createDirectory'], buttonLabel: 'Escolher'
  })
  return r.canceled ? null : motor.pastaFinal(r.filePaths[0])
})

let instalado = null
ipcMain.handle('setup-instalar', async (_e, { destino, senha }) => {
  if (!motor || !PAYLOAD) return { ok: false, msg: 'Pacote de instalação não encontrado.' }
  try {
    instalado = await motor.instalar({ payload: PAYLOAD, destino, senha, versao: app.getVersion() },
      ev => win.webContents.send('setup-passo', ev.passo))
    return { ok: true, codigo: instalado.codigo }
  } catch (e) {
    return { ok: false, msg: String(e.message || e).slice(0, 220) }
  }
})

ipcMain.handle('setup-abrir', () => {
  if (instalado && fs.existsSync(instalado.exe)) {
    // Abre como usuário normal (o instalador roda como administrador)
    spawn('explorer.exe', [instalado.exe], { detached: true, stdio: 'ignore' }).unref()
  }
  setTimeout(() => app.quit(), 300)
})

ipcMain.handle('setup-desinstalar', async () => {
  if (motor) await motor.desinstalar(DIR)
  return true
})

// Câmera e microfone: liberados só para as páginas do próprio app
if (process.env.SSADESK_SNAPSHOT) app.commandLine.appendSwitch('use-fake-device-for-media-stream')
app.whenReady().then(() => {
  const { session } = require('electron')
  const proprio = url => String(url || '').startsWith('file://')
  session.defaultSession.setPermissionRequestHandler((wc, perm, cb) => cb(['media', 'clipboard-sanitized-write'].includes(perm) && proprio(wc.getURL())))
  session.defaultSession.setPermissionCheckHandler((wc, perm) => perm === 'media' && proprio(wc && wc.getURL()))
  if (process.env.SSADESK_CALL) { abrirChamada({ nome: 'Lages' }); return }
  createWindow()
})
app.on('window-all-closed', () => app.quit())
