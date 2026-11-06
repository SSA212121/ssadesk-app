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
// Instalação: avisa o envelope (Setup.exe) que a tela está aberta, para ele manter a pasta temporária
if (MODO !== 'app' && PAYLOAD) {
  const marca = n => { try { fs.writeFileSync(path.join(PAYLOAD, n), String(Date.now())) } catch {} }
  marca('vivo.flag'); setInterval(() => marca('vivo.flag'), 2000)
  process.on('exit', () => marca('fim.flag'))
}
// O resto do pacote é extraído enquanto o usuário passa pelas telas: espera o sinal 'pronto'
async function esperarPacote () {
  if (!PAYLOAD) return
  for (let i = 0; i < 600 && !fs.existsSync(path.join(PAYLOAD, 'pronto.flag')); i++) await new Promise(r => setTimeout(r, 200))
}
// --segundo-plano: inicia com o Windows, sem janela, só com o ícone perto do relógio (para receber chamadas)
const SEGUNDO_PLANO = !!arg('segundo-plano')

// Perfil separado (só para testes automáticos com duas cópias do app na mesma máquina)
if (process.env.SSADESK_PERFIL) app.setPath('userData', process.env.SSADESK_PERFIL)
// Uma única instância do app: abrir de novo só mostra o painel
if (MODO === 'app' && !process.env.SSADESK_SNAPSHOT && !app.requestSingleInstanceLock()) app.exit(0)

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
  callWin.loadFile(path.join(__dirname, 'src', 'chamada.html'), { query: { platform: process.platform, nome: dados.nome || '', demo: process.env.SSADESK_DEMO ? '1' : '', autoteste: process.env.SSADESK_AUTOTESTE ? '1' : '' } })
  callWin.once('ready-to-show', () => {
    if (process.env.SSADESK_SNAPSHOT && process.env.SSADESK_CALL) return snapshot(callWin)
    callWin.showInactive() // aparece sem roubar o foco de quem está trabalhando
    enviarEstadoChamada()
  })
  if (process.env.SSADESK_LOG) callWin.webContents.on('console-message', (_e, _l, msg) => fs.appendFileSync(process.env.SSADESK_LOG, msg + '\n'))
  callWin.setAlwaysOnTop(true, 'floating')
  callWin.on('closed', () => {
    callWin = null
    if (canal) canal.encerrar()
    // Fim da chamada: fecha o chat e apaga a conversa
    if (chatWin && !chatWin.isDestroyed()) { chatWin.destroy() }
    chatWin = null; mensagens.length = 0
  })
  // Quem acessa: liga para o outro computador pela chave de internet dele
  if (dados.chave && canal) { estadoChamada = { fase: 'procurando', nome: dados.nome || '' }; canal.chamar(dados.chave) }
}
ipcMain.on('abrir-chamada', (_e, dados) => {
  dados = dados || {}
  // Sem chave informada: usa a do último computador acessado pela internet
  if (!dados.chave) dados.chave = loadPrefs().ultimaChave || ''
  abrirChamada(dados)
})

// ---------- Canal P2P da chamada (vídeo, áudio, chat) ----------
let canal = null
let estadoChamada = { fase: 'aguardando', nome: '' }
function enviarEstadoChamada () { if (callWin && !callWin.isDestroyed()) callWin.webContents.send('chamada-estado', estadoChamada) }

function iniciarCanal () {
  if (canal || MODO !== 'app') return
  try {
    const Hyperswarm = require('hyperswarm')
    const { Canal } = require('./canal')
    canal = new Canal(Hyperswarm)
  } catch (e) { console.error('canal P2P indisponível:', e.message); return }

  canal.on('estado', fase => { estadoChamada = { ...estadoChamada, fase }; enviarEstadoChamada() })
  canal.on('conectado', ({ recebida }) => {
    estadoChamada = { ...estadoChamada, fase: 'conectado' }
    if (process.env.SSADESK_FOTO_CHAMADA) setTimeout(async () => { if (callWin) fs.writeFileSync(process.env.SSADESK_FOTO_CHAMADA, (await callWin.webContents.capturePage()).toPNG()) }, 15000)
    if (recebida) abrirChamada({ nome: 'Chamada' }) // o outro lado chamou: a janelinha aparece sozinha
    enviarEstadoChamada()
  })
  canal.on('desconectado', () => { estadoChamada = { ...estadoChamada, fase: 'encerrada' }; enviarEstadoChamada() })
  canal.on('controle', msg => {
    if (msg.t === 'ola') { estadoChamada = { ...estadoChamada, nome: String(msg.nome || '').slice(0, 60) }; enviarEstadoChamada() }
    if (msg.t === 'chat') receberMensagem(msg.texto)
    if (msg.t === 'estado' && callWin && !callWin.isDestroyed()) callWin.webContents.send('chamada-remoto', { mic: !!msg.mic, cam: !!msg.cam })
    if (msg.t === 'quadro-chave' && callWin && !callWin.isDestroyed()) callWin.webContents.send('chamada-quadro-chave')
    if (msg.t === 'tchau') { estadoChamada = { ...estadoChamada, fase: 'encerrada' }; enviarEstadoChamada() }
  })
  canal.on('midia', (tipo, dados) => {
    if (callWin && !callWin.isDestroyed()) callWin.webContents.send('chamada-midia', tipo, dados)
  })
  canal._swarm() // liga o nó P2P já na abertura: as próximas conexões saem rápidas
  // Fica disponível para receber chamadas pela própria chave de internet
  const minha = readText(path.join(DIR, 'chave-internet.txt'))
  if (minha) canal.escutar(minha).catch(() => {})
}
ipcMain.handle('chamada-estado-atual', () => estadoChamada)

// ---------- Túnel de acesso remoto dentro do app ----------
// Usa o nó da rede P2P que o app mantém ligado em segundo plano: não precisa 'entrar' na rede a cada conexão.
// Compatível com o hypertele-server do outro computador (bytes repassados sem alteração).
const tuneis = new Map() // chave -> { porta, servidor }
async function tunelInterno (chave) {
  if (!canal) return 0
  try {
    if (tuneis.has(chave)) return tuneis.get(chave).porta
    const dht = canal._swarm().dht
    await dht.ready()
    const remoto = Buffer.from(chave, 'hex')
    const servidor = net.createServer({ allowHalfOpen: true }, local => {
      const s = dht.connect(remoto, { reusableSocket: true })
      local.pipe(s).pipe(local)
      const fim = () => { local.destroy(); s.destroy() }
      local.on('error', fim).on('close', fim); s.on('error', fim).on('close', fim)
    })
    const porta = await new Promise((resolve, reject) => { servidor.once('error', reject); servidor.listen(0, '127.0.0.1', () => resolve(servidor.address().port)) })
    tuneis.set(chave, { porta, servidor })
    // Já 'fura' o caminho até o outro computador enquanto o SSADesk abre a janela
    const aquece = dht.connect(remoto, { reusableSocket: true }); aquece.on('error', () => {}); aquece.on('open', () => setTimeout(() => aquece.destroy(), 1500))
    return porta
  } catch { return 0 }
}
ipcMain.on('chamada-midia', (_e, tipo, dados) => { if (canal) canal.midia(tipo, Buffer.from(dados)) })
ipcMain.on('chamada-controle', (_e, obj) => { if (canal && obj && typeof obj === 'object') canal.controle(obj) })

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
  // Envia ao outro computador pelo canal P2P. Modo demonstração: responde sozinho para testar.
  if (process.env.SSADESK_DEMO) setTimeout(() => receberMensagem('Recebi: ' + texto), 1400)
  else if (canal) canal.controle({ t: 'chat', texto: String(texto).slice(0, 2000) })
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
      // Qualquer rede: túnel P2P. Preferência: dentro do próprio app, com a rede P2P já aquecida (bem mais rápido).
      const rapido = await tunelInterno(destino.toLowerCase())
      if (rapido) {
        abrirRustDesk('127.0.0.1:' + rapido)
        savePrefs({ ...loadPrefs(), ultimaChave: destino.toLowerCase() })
        return { ok: true, msg: 'Conectando.' }
      }
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
      savePrefs({ ...loadPrefs(), ultimaChave: destino.toLowerCase() }) // a chamada de vídeo usa esta chave
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
    await esperarPacote()
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
if (process.env.SSADESK_SNAPSHOT || process.env.SSADESK_FAKE) app.commandLine.appendSwitch('use-fake-device-for-media-stream')
// A voz do outro lado toca sem precisar de clique
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required')
app.whenReady().then(() => {
  const { session } = require('electron')
  const proprio = url => String(url || '').startsWith('file://')
  session.defaultSession.setPermissionRequestHandler((wc, perm, cb) => cb(['media', 'clipboard-sanitized-write'].includes(perm) && proprio(wc.getURL())))
  session.defaultSession.setPermissionCheckHandler((wc, perm) => perm === 'media' && proprio(wc && wc.getURL()))
  if (process.env.SSADESK_CALL) { abrirChamada({ nome: 'Lages' }); return }
  if (process.env.SSADESK_CHAMAR) { iniciarCanal(); abrirChamada({ chave: process.env.SSADESK_CHAMAR, nome: 'Teste' }); return }
  if (MODO !== 'app') { createWindow(); return }
  iniciarCanal()
  criarBandeja()
  if (!SEGUNDO_PLANO) createWindow()
})

// ---------- Ícone perto do relógio (o SSADesk continua disponível para chamadas) ----------
let bandeja = null
function mostrarPainel () {
  if (win && !win.isDestroyed()) { win.show(); win.focus() } else createWindow()
}
function criarBandeja () {
  if (bandeja || process.env.SSADESK_SNAPSHOT) return
  const { Tray, Menu, nativeImage } = require('electron')
  bandeja = new Tray(nativeImage.createFromPath(path.join(__dirname, 'assets', isWin ? 'icon.ico' : 'icon.png')).resize({ width: 16, height: 16 }))
  bandeja.setToolTip('SSADesk — disponível')
  bandeja.setContextMenu(Menu.buildFromTemplate([
    { label: 'Abrir SSADesk', click: mostrarPainel },
    { label: 'Chamada de vídeo', click: () => abrirChamada({ chave: loadPrefs().ultimaChave || '' }) },
    { type: 'separator' },
    { label: 'Sair do SSADesk', click: () => { app.exit(0) } }
  ]))
  bandeja.on('click', mostrarPainel)
}
app.on('second-instance', () => { if (MODO === 'app') mostrarPainel() })
// Fechar o painel não encerra o app: ele segue no ícone perto do relógio para receber chamadas
app.on('window-all-closed', () => { if (MODO !== 'app' || !bandeja) app.quit() })
app.on('before-quit', () => { if (canal) canal.destruir() })
