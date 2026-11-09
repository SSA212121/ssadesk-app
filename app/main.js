// SSAdesk — processo principal (Electron).
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

// Pasta de instalação do SSAdesk (onde ficam código, chave, RustDesk e túnel)
function installDir () {
  if (process.env.SSADESK_DIR) return process.env.SSADESK_DIR
  if (app.isPackaged && isWin) return path.resolve(path.dirname(process.execPath), '..')
  if (isMac) return path.join(app.getPath('home'), 'Library', 'Application Support', 'SSAdesk')
  return 'C:\\SSAdesk'
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
    height: 720,
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    show: false,
    title: 'SSAdesk',
    icon: path.join(__dirname, 'assets', 'icon.png'),
    backgroundColor: '#00000000',
    // Vidro nativo
    ...(isWin ? { titleBarStyle: 'hidden', backgroundMaterial: 'acrylic' } : {}),
    ...(isMac ? { titleBarStyle: 'hiddenInset', vibrancy: 'under-window', visualEffectState: 'active', trafficLightPosition: { x: 18, y: 20 } } : {}),
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, sandbox: true, spellcheck: false }
  })
  const pagina = MODO === 'app' ? 'index.html' : 'setup.html'
  const query = { platform: process.platform }
  if (process.env.SSADESK_PAGE) query.pagina = process.env.SSADESK_PAGE
  win.loadFile(path.join(__dirname, 'src', pagina), { query })
  win.on('close', e => {
    if (MODO !== 'app' || !bandeja || app.saindo) return
    e.preventDefault(); win.hide()
    clearTimeout(win._liberar); win._liberar = setTimeout(() => { if (win && !win.isDestroyed() && !win.isVisible()) win.destroy() }, 5 * 60 * 1000)
  })
  win.once('ready-to-show', () => {
    if (process.env.SSADESK_TEMPO) fs.writeFileSync(process.env.SSADESK_TEMPO, String(Math.round(process.uptime() * 1000)))
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
    show: false, title: 'SSAdesk — Chamada', backgroundColor: '#000000',
    icon: path.join(__dirname, 'assets', 'icon.png'),
    ...(isWin ? { titleBarStyle: 'hidden', roundedCorners: true } : {}),
    ...(isMac ? { titleBarStyle: 'hiddenInset', trafficLightPosition: { x: 16, y: 16 } } : {}),
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, sandbox: true, spellcheck: false }
  })
  callWin.loadFile(path.join(__dirname, 'src', 'chamada.html'), { query: { platform: process.platform, nome: dados.nome || '', demo: process.env.SSADESK_DEMO ? '1' : '', autoteste: process.env.SSADESK_AUTOTESTE ? '1' : '', tela: dados.tela ? '1' : '' } })
  callWin.once('ready-to-show', () => {
    if (process.env.SSADESK_SNAPSHOT && process.env.SSADESK_CALL) return snapshot(callWin)
    callWin.showInactive() // aparece sem roubar o foco de quem está trabalhando
    enviarEstadoChamada()
  })
  if (process.env.SSADESK_LOG) callWin.webContents.on('console-message', (_e, _l, msg) => fs.appendFileSync(process.env.SSADESK_LOG, msg + '\n'))
  callWin.setAlwaysOnTop(true, 'floating')
  callWin.on('closed', () => {
    callWin = null
    if (canal && canal.conectado()) canal.controle({ t: 'chamada-fim' })
    if (chatWin && !chatWin.isDestroyed()) chatWin.destroy()
    chatWin = null
  })
}
ipcMain.on('abrir-chamada', (_e, extra) => {
  // A chamada usa a sessão já aberta com o outro computador (conectado pelo código)
  const ativa = !!(canal && canal.conectado() && sessao.ativa)
  estadoChamada = ativa ? { fase: 'conectado', nome: sessao.nome } : { fase: 'sem-sessao', nome: '' }
  abrirChamada({ nome: sessao.nome || 'Chamada de vídeo', tela: !!(extra && extra.tela) })
  if (ativa) canal.controle({ t: 'chamada' })
  enviarEstadoChamada()
})

// ---------- Sessão P2P com o outro computador (pedido, chamada, chat, arquivos) ----------
const PERMISSOES_PADRAO = { controlar: true, arquivos: true, chamada: true, chat: true }
// ---------- Ajustes ----------
// receber: 'auto' (pergunta e libera sozinho em 15 s) | 'perguntar' (só com resposta) | 'direto' (sem janela; servidor sem ninguém)
function ajustes () {
  const a = loadPrefs().ajustes || {}
  return { receber: ['auto', 'perguntar', 'direto'].includes(a.receber) ? a.receber : 'auto', permissoes: { ...PERMISSOES_PADRAO, ...(a.permissoes || {}) }, iniciar: a.iniciar !== false, retransmitir: a.retransmitir !== false }
}
function aplicarInicioAutomatico () {
  if (!app.isPackaged || MODO !== 'app') return
  // Inicia com o Windows (perfil do usuário), em segundo plano: necessário para receber conexões e chamadas
  app.setLoginItemSettings({ openAtLogin: ajustes().iniciar, path: process.execPath, args: ['--segundo-plano'] })
}
ipcMain.handle('ajustes', () => ajustes())

// ---------- Diagnóstico de conexão (relatório na Área de Trabalho, para enviar ao suporte) ----------
async function diagnosticoConexao () {
  const { execFile } = require('child_process')
  const cmd = (exe, args) => new Promise(r => execFile(exe, args, { windowsHide: true, timeout: 8000 }, (e, so, se) => r(String(so || se || (e && e.message) || '').trim())))
  const ok = v => (v ? 'OK' : 'FALHA')
  const linhas = []
  const L = s => linhas.push(s)
  L('SSAdesk — diagnóstico de conexão — ' + new Date().toLocaleString('pt-BR'))
  L('Versão: ' + app.getVersion() + ' | Computador: ' + require('os').hostname() + ' | Código: ' + (meuCodigo() || '(sem código)'))
  L('')
  L('== Motor de acesso remoto ==')
  L('SSAdesk.exe instalado: ' + ok(fs.existsSync(path.join(DIR, 'SSAdesk.exe'))))
  const sc = await cmd('sc.exe', ['query', 'SSAdesk'])
  L('Serviço SSAdesk: ' + (/RUNNING/.test(sc) ? 'rodando' : /STOPPED/.test(sc) ? 'PARADO' : 'NÃO EXISTE'))
  const porta = await new Promise(r => { const s = net.connect(21118, '127.0.0.1'); s.once('connect', () => { s.destroy(); r(true) }); s.once('error', () => r(false)); setTimeout(() => { s.destroy(); r(false) }, 2000) })
  L('Porta 21118 (acesso direto) aberta: ' + ok(porta))
  L('')
  L('== Rede P2P (encontrar pelo código) ==')
  const tr = canal && canal.tipoDeRede()
  if (!tr) L('Rede P2P: NÃO INICIOU')
  else {
    L('Rede P2P conectada: ' + ok(!!tr.host) + (tr.host ? ' (visto como ' + tr.host + ':' + tr.port + ')' : ''))
    L('Tipo de NAT: ' + (!tr.firewalled ? 'aberto (ótimo)' : tr.randomized ? 'aleatório/restrito (precisa de retransmissão)' : 'consistente (bom para furo direto)'))
    L('Retransmissores conhecidos: ' + tr.retransmissores + ' | Este computador retransmite: ' + (tr.souRetransmissor ? 'sim' : 'não'))
  }
  L('Anunciando o código na rede P2P: ' + ok(canal && canal.escutas && canal.escutas.size > 0))
  L('Descoberta na rede local ativa: ' + ok(!!(lan && lan.sock)))
  if (canal && meuCodigo()) L('Este código é encontrado na rede P2P: ' + ok(await canal.online(meuCodigo(), 10000)))
  L('')
  L('== Rede deste computador ==')
  const rede = readJson(path.join(DIR, 'rede.json')) || {}
  L('IPv4 local: ' + (rede.ipv4_local || '?') + ' | IP público: ' + (rede.ip_publico || '?') + ' | IPv6 público: ' + ((rede.ipv6 || []).length ? 'sim' : 'não'))
  L('Roteador abre porta sozinho (UPnP/NAT-PMP): ' + (rede.upnp === 'ok' ? 'sim' : 'não') + ' | IP compartilhado (CGNAT): ' + (rede.cgnat ? 'SIM' : 'não'))
  if (rede.reparo) L('Autorreparo: ' + rede.reparo)
  L('')
  L('== Windows ==')
  const fw = await cmd('powershell.exe', ['-NoProfile', '-Command', "(Get-NetFirewallRule -DisplayName 'SSAdesk*' -ErrorAction SilentlyContinue | Where-Object Enabled -eq True).DisplayName -join ', '"])
  L('Regras de firewall do SSAdesk: ' + (fw || 'NENHUMA'))
  const sac = await cmd('reg.exe', ['query', 'HKLM\\SYSTEM\\CurrentControlSet\\Control\\CI\\Policy', '/v', 'VerifiedAndReputablePolicyState'])
  L('Controle Inteligente de Aplicativos: ' + (/0x1\b/.test(sac) ? 'LIGADO (bloqueia programas sem assinatura)' : /0x2\b/.test(sac) ? 'em avaliação' : 'desligado'))
  const arq = process.env.SSADESK_DIAG_TESTE || path.join(app.getPath('desktop'), 'SSAdesk-diagnostico.txt')
  fs.writeFileSync(arq, '\ufeff' + linhas.join('\r\n'), 'utf8')
  if (!process.env.SSADESK_DIAG_TESTE) shell.openPath(arq)
  return { ok: true, arquivo: arq }
}
ipcMain.handle('diagnostico', () => diagnosticoConexao())
ipcMain.handle('ajustes-salvar', (_e, novo) => {
  const atual = ajustes()
  const a = {
    receber: ['auto', 'perguntar', 'direto'].includes(novo && novo.receber) ? novo.receber : atual.receber,
    permissoes: { ...atual.permissoes, ...((novo && novo.permissoes) || {}) },
    iniciar: novo && typeof novo.iniciar === 'boolean' ? novo.iniciar : atual.iniciar,
    retransmitir: novo && typeof novo.retransmitir === 'boolean' ? novo.retransmitir : atual.retransmitir
  }
  savePrefs({ ...loadPrefs(), ajustes: a }); aplicarInicioAutomatico(); return a
})
let canal = null
let sessao = { ativa: false, papel: null, nome: '', permissoes: { ...PERMISSOES_PADRAO } }
let estadoChamada = { fase: 'aguardando', nome: '' }
let pendente = null // conexão pelo código esperando a resposta do outro lado
let arquivos = null
let lan = null
let ultimoDestino = ''
let modoAcordar = null
let encerradoPeloUsuario = false
// A sessão caiu (rede oscilou): tenta reconectar sozinho algumas vezes, sem reabrir a tela remota
async function reconectar (codigo, nome) {
  avisarBarraEstado('Reconectando…')
  for (let i = 0; i < 6 && !encerradoPeloUsuario; i++) {
    try {
      await new Promise((resolve, reject) => {
        const t = setTimeout(() => { pendente = null; canal.pararProcura(); reject(new Error('tempo')) }, 20000)
        pendente = { resolve: v => { clearTimeout(t); resolve(v) }, reject: e => { clearTimeout(t); reject(e) } }
        canal.procurar({ codigo })
      })
      sessao.codigo = codigo; avisarBarraEstado('Reconectado ✓'); abrirBarra(); return
    } catch { await new Promise(r => setTimeout(r, 3000)) }
  }
  avisarBarraEstado('Conexão perdida')
}
function avisarBarraEstado (texto) { if (barraWin && !barraWin.isDestroyed()) barraWin.webContents.send('barra-estado', texto) }
let ultimoDespertar = 0
function enviarEstadoChamada () { if (callWin && !callWin.isDestroyed()) callWin.webContents.send('chamada-estado', estadoChamada) }
function avisarPainel (canalNome, dados) { if (win && !win.isDestroyed()) win.webContents.send(canalNome, dados) }

const meuCodigo = () => readText(path.join(DIR, 'codigo.txt'))
const minhaChave = () => readText(path.join(DIR, 'chave-internet.txt'))
const meuNome = () => (loadPrefs().nome || '').trim() || require('os').hostname()
// Endereços diretos que o outro lado pode tentar: rede local (só se estiver na mesma rede) e IPv6 público
function meusEnderecos (ipPublicoDoOutro) {
  const rede = readJson(path.join(DIR, 'rede.json')) || {}
  const ips = []
  if (rede.ipv4_local && rede.ip_publico && ipPublicoDoOutro && rede.ip_publico === ipPublicoDoOutro) ips.push(rede.ipv4_local)
  for (const v6 of [].concat(rede.ipv6 || [])) if (v6) ips.push(v6)
  return ips
}

function iniciarCanal () {
  if (canal || MODO !== 'app') return
  try {
    const Hyperswarm = require('hyperswarm')
    const { Canal } = require('./canal')
    // Chave fixa do retransmissor deste computador (gerada uma vez)
    let pr = loadPrefs()
    if (!pr.chaveRetransmissor) { pr = { ...pr, chaveRetransmissor: require('crypto').randomBytes(32).toString('hex') }; savePrefs(pr) }
    canal = new Canal(Hyperswarm, {
      chaveRetransmissor: pr.chaveRetransmissor,
      retransmitir: ajustes().retransmitir,
      forcarRetransmissao: !!process.env.SSADESK_FORCAR_RETRANSMISSAO,
      retransmissoresExtra: (process.env.SSADESK_RETRANSMISSORES || '').split(',').filter(Boolean),
      porta: process.env.SSADESK_PORTA !== undefined ? Number(process.env.SSADESK_PORTA) : undefined
    })
    canal.on('retransmissor', k => { if (process.env.SSADESK_LOG) fs.appendFileSync(process.env.SSADESK_LOG, 'retransmissor: ' + k + '\n') })
  } catch (e) { console.error('canal P2P indisponível:', e.message); return }

  canal.on('conectado', ({ recebida }) => {
    sessao = { ativa: true, papel: recebida ? 'acessado' : 'acessando', nome: '', permissoes: { ...PERMISSOES_PADRAO } }
    if (process.env.SSADESK_FOTO_CHAMADA) setTimeout(async () => { if (callWin) fs.writeFileSync(process.env.SSADESK_FOTO_CHAMADA, (await callWin.webContents.capturePage()).toPNG()) }, 15000)
    if (!recebida && modoAcordar) { canal.controle({ t: 'acordar', mac: modoAcordar.mac }); return }
    if (!recebida) {
      const rede = readJson(path.join(DIR, 'rede.json')) || {}
      canal.controle({ t: 'ola', nome: meuNome(), codigo: meuCodigo(), quer: 'acesso', ipPublico: rede.ip_publico || '' })
    }
  })
  canal.on('desconectado', () => {
    const caiu = sessao.ativa && sessao.papel === 'acessando' && !encerradoPeloUsuario && sessao.codigo
    sessao.ativa = false
    if (caiu) setTimeout(() => reconectar(sessao.codigo, sessao.nome), 1000)
    if (arquivos) arquivos.sessaoEncerrada()
    if (!caiu) fecharBarra()
    if (lousaWin && !lousaWin.isDestroyed()) lousaWin.destroy()
    estadoChamada = { ...estadoChamada, fase: 'encerrada' }; enviarEstadoChamada()
    if (pendente) { pendente.reject(new Error('O outro computador encerrou a conexão.')); pendente = null }
    avisarPainel('sessao', { ativa: false })
  })
  canal.on('controle', async msg => {
    switch (msg.t) {
      case 'acordar': // um computador da lista pede para eu ligar um vizinho desta mesma rede (só envia o sinal)
        if (sessao.papel === 'acessado') {
          const agora = Date.now()
          if (agora - ultimoDespertar > 10000) { ultimoDespertar = agora; enviarPacoteDespertar(msg.mac) }
          canal.controle({ t: 'acordado' }); setTimeout(() => canal.encerrar(), 300)
        }
        break
      case 'acordado': if (modoAcordar) { modoAcordar.ok(); modoAcordar = null; canal.encerrar() } break
      case 'ola': { // alguém quer acessar este computador
        sessao.nome = String(msg.nome || msg.codigo || 'Alguém').slice(0, 40)
        const r = await mostrarPedido({ nome: sessao.nome, codigo: msg.codigo || '' })
        if (!canal.conectado()) return
        if (!r.permitir) { canal.controle({ t: 'negado' }); setTimeout(() => canal.encerrar(), 300); return }
        sessao.permissoes = { ...ajustes().permissoes, ...r.permissoes }
        const minhaRede = readJson(path.join(DIR, 'rede.json')) || {}
        canal.controle({
          t: 'aceito', nome: meuNome(), permissoes: sessao.permissoes, mac: minhaRede.mac || '', ipPublico: minhaRede.ip_publico || '',
          // Sem permissão de controle, não entrega os caminhos de acesso
          chave: sessao.permissoes.controlar ? minhaChave() : '',
          ips: sessao.permissoes.controlar ? meusEnderecos(msg.ipPublico) : []
        })
        break
      }
      case 'aceito': sessao.nome = String(msg.nome || '').slice(0, 40); sessao.remoto = { mac: String(msg.mac || '').slice(0, 17), ipPublico: String(msg.ipPublico || '').slice(0, 45) }; sessao.permissoes = { ...PERMISSOES_PADRAO, ...msg.permissoes }; if (pendente) { pendente.resolve(msg); pendente = null } break
      case 'negado': if (pendente) { pendente.reject(new Error('O outro computador negou o acesso.')); pendente = null } break
      case 'chamada':
        if (!sessao.permissoes.chamada) { canal.controle({ t: 'aviso', texto: 'Chamada de vídeo não permitida.' }); break }
        estadoChamada = { fase: 'conectado', nome: sessao.nome }; abrirChamada({ nome: sessao.nome }); enviarEstadoChamada(); break
      case 'chamada-fim': if (callWin && !callWin.isDestroyed()) { estadoChamada = { ...estadoChamada, fase: 'encerrada' }; enviarEstadoChamada() } break
      case 'chat': if (sessao.permissoes.chat) receberMensagem(msg.texto); break
      case 'estado': if (callWin && !callWin.isDestroyed()) callWin.webContents.send('chamada-remoto', { mic: !!msg.mic, cam: !!msg.cam, tela: !!msg.tela }); break
      case 'quadro-chave': if (callWin && !callWin.isDestroyed()) callWin.webContents.send('chamada-quadro-chave'); break
      case 'tchau': estadoChamada = { ...estadoChamada, fase: 'encerrada' }; enviarEstadoChamada(); break
      case 'lousa': // anotações do outro lado (a lousa abre sozinha aqui para mostrar)
        if (process.env.SSADESK_LOG) fs.appendFileSync(process.env.SSADESK_LOG, 'lousa recebida: ' + (msg.d && msg.d.acao) + '\n')
        if (sessao.permissoes.controlar === false) { if (process.env.SSADESK_LOG) fs.appendFileSync(process.env.SSADESK_LOG, 'lousa bloqueada pela permissão\n'); break }
        abrirLousa(); if (lousaWin && !lousaWin.isDestroyed()) { if (lousaPronta) lousaWin.webContents.send('lousa-remoto', msg.d); else lousaFila.push(msg.d) }
        break
      // Painel ⓘ: latência (ida e volta pelo canal) e informações do outro computador
      case 'ping': canal.controle({ t: 'pong', em: msg.em }); break
      case 'pong': if (typeof msg.em === 'number') infoSessao.latencia = Math.max(0, Date.now() - msg.em); break
      case 'info-pedir': canal.controle({ t: 'info', d: require('./info-sistema').coletar() }); break
      case 'info': if (msg.d && typeof msg.d === 'object') infoSessao.remoto = msg.d; break
    }
    if (arquivos && /^arq-/.test(msg.t)) arquivos.controle(msg)
  })
  canal.on('midia', (tipo, dados) => {
    if (callWin && !callWin.isDestroyed()) callWin.webContents.send('chamada-midia', tipo, dados)
  })
  canal.on('arquivo', dados => { if (arquivos) arquivos.pedaco(dados) })
  // Arquivos: quem acessa envia; chegam na Área de Trabalho de quem foi acessado (se a permissão estiver ligada)
  const { criarArquivos } = require('./arquivos')
  arquivos = criarArquivos({
    canal,
    pastaDestino: () => process.env.SSADESK_DESTINO || app.getPath('desktop'),
    podeReceber: () => sessao.ativa && sessao.papel === 'acessado' && sessao.permissoes.arquivos !== false,
    aoProgresso: p => { if (barraWin && !barraWin.isDestroyed()) barraWin.webContents.send('arquivos-progresso', p) },
    aoRecebido: r => avisarRecebido(r)
  })
  canal._swarm() // liga o nó P2P já na abertura: as próximas conexões saem rápidas
  // Descoberta na mesma rede (sem internet): responde quando alguém procura o meu código
  try {
    const { DescobertaLan } = require('./descoberta-lan')
    lan = new DescobertaLan({ meuCodigo, meuNome })
    lan.iniciar()
  } catch {}
  // Fica disponível para ser encontrado pelo código (e pela chave de internet)
  canal.escutar({ codigo: meuCodigo(), chave: minhaChave() }).catch(() => {})
}
ipcMain.handle('chamada-estado-atual', () => estadoChamada)
// Tela principal para transmitir (captura direta: funciona mesmo quando a transmissão começa pela barrinha)
ipcMain.handle('tela-fonte', async () => {
  const s = await require('electron').desktopCapturer.getSources({ types: ['screen'], thumbnailSize: { width: 0, height: 0 } })
  const principal = require('electron').screen.getPrimaryDisplay().id
  const f = s.find(x => String(x.display_id) === String(principal)) || s[0]
  return f ? f.id : null
})

// ---------- Pedido "Fulano deseja conectar" (Permitir / Negar, com permissões) ----------
// Se ninguém responder em 15 s, permite (o servidor pode estar sem ninguém na frente; a senha continua exigida)
let pedidoWin = null
let pedidoAtual = null
function mostrarPedido (dados) {
  const aj = ajustes()
  if (process.env.SSADESK_AUTOPERMITIR || aj.receber === 'direto') return Promise.resolve({ permitir: true, permissoes: aj.permissoes })
  return new Promise(resolve => {
    let respondido = false
    const responder = r => { if (respondido) return; respondido = true; clearTimeout(tempo); pedidoAtual = null; if (pedidoWin && !pedidoWin.isDestroyed()) pedidoWin.destroy(); pedidoWin = null; resolve(r) }
    const tempo = aj.receber === 'auto' ? setTimeout(() => responder({ permitir: true, permissoes: aj.permissoes }), 15000) : null
    pedidoAtual = { dados: { ...dados, segundos: aj.receber === 'auto' ? 15 : 0, permissoes: aj.permissoes }, responder, adiar: () => clearTimeout(tempo) }
    pedidoWin = new BrowserWindow({
      width: 380, height: 420, resizable: false, maximizable: false, minimizable: false, alwaysOnTop: true, show: false,
      title: 'SSAdesk', backgroundColor: '#00000000', icon: path.join(__dirname, 'assets', 'icon.png'),
      ...(isWin ? { titleBarStyle: 'hidden', backgroundMaterial: 'acrylic' } : {}),
      ...(isMac ? { titleBarStyle: 'hiddenInset', vibrancy: 'hud', visualEffectState: 'active' } : {}),
      webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, sandbox: true, spellcheck: false }
    })
    pedidoWin.setAlwaysOnTop(true, 'screen-saver')
    pedidoWin.loadFile(path.join(__dirname, 'src', 'pedido.html'), { query: { platform: process.platform } })
    pedidoWin.once('ready-to-show', () => { pedidoWin.show(); pedidoWin.flashFrame(true) })
    pedidoWin.on('closed', () => responder({ permitir: false }))
  })
}
ipcMain.handle('pedido-dados', () => pedidoAtual && pedidoAtual.dados)
ipcMain.on('pedido-adiar', () => { if (pedidoAtual) pedidoAtual.adiar() }) // mexeu nas permissões: espera a decisão da pessoa
ipcMain.on('pedido-resposta', (_e, r) => { if (pedidoAtual) pedidoAtual.responder({ permitir: !!(r && r.permitir), permissoes: (r && r.permissoes) || PERMISSOES_PADRAO }) })

// ---------- Barrinha da sessão (quem acessa): soltar arquivos, chamada, chat, encerrar ----------
let barraWin = null
function abrirBarra () {
  if (process.env.SSADESK_CODIGO_TESTE) return
  if (barraWin && !barraWin.isDestroyed()) { barraWin.showInactive(); barraWin.webContents.send('barra-sessao', { nome: sessao.nome }); return }
  const area = require('electron').screen.getPrimaryDisplay().workArea
  const W = 544; const H = 64
  barraWin = new BrowserWindow({
    width: W, height: H, x: Math.round(area.x + (area.width - W) / 2), y: area.y + 12,
    frame: false, transparent: true, resizable: false, maximizable: false, minimizable: false, skipTaskbar: true,
    alwaysOnTop: true, show: false, title: 'SSAdesk', hasShadow: false,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, sandbox: true, spellcheck: false }
  })
  barraWin.setAlwaysOnTop(true, 'floating')
  barraWin.loadFile(path.join(__dirname, 'src', 'sessao.html'), { query: { nome: sessao.nome || '' } })
  barraWin.once('ready-to-show', () => barraWin.showInactive())
  barraWin.on('closed', () => { barraWin = null })
}
function fecharBarra () { if (barraWin && !barraWin.isDestroyed()) barraWin.destroy(); barraWin = null; if (infoWin && !infoWin.isDestroyed()) infoWin.close(); infoSessao.latencia = null; infoSessao.remoto = null }

async function enviarArquivos (caminhos) {
  const { Notification } = require('electron')
  const lista = (caminhos || []).filter(c => c && fs.existsSync(c))
  if (!lista.length) return { ok: false, msg: 'Nenhum arquivo.' }
  if (!(canal && canal.conectado() && sessao.ativa && sessao.papel === 'acessando')) {
    new Notification({ title: 'SSAdesk', body: 'Conecte-se a um computador para enviar arquivos.' }).show()
    mostrarPainel(); return { ok: false, msg: 'Sem conexão.' }
  }
  if (sessao.permissoes.arquivos === false) return { ok: false, msg: (sessao.nome || 'O outro computador') + ' não permite receber arquivos.' }
  abrirBarra()
  try { const n = await arquivos.enviar(lista); return { ok: true, n } } catch (e) { return { ok: false, msg: e.message } }
}
ipcMain.handle('arquivos-enviar', (_e, caminhos) => enviarArquivos(caminhos))
ipcMain.handle('arquivos-escolher', async () => {
  const r = await dialog.showOpenDialog(barraWin || win, { title: 'Enviar para ' + (sessao.nome || 'o outro computador'), properties: ['openFile', 'multiSelections'] })
  return r.canceled ? { ok: false } : enviarArquivos(r.filePaths)
})
ipcMain.on('sessao-acao', (_e, acao) => {
  if (acao === 'chamada') ipcMain.emit('abrir-chamada')
  if (acao === 'tela') ipcMain.emit('abrir-chamada', null, { tela: true }) // transmitir minha tela
  if (acao === 'lousa') abrirLousa()
  if (acao === 'chat') abrirChatJanela()
  if (acao === 'info') abrirInfo()
  if (acao === 'encerrar') { encerradoPeloUsuario = true; if (canal) canal.encerrar(); fecharBarra() }
})
// ---------- Painel ⓘ de informações da conexão (canto superior direito) ----------
let infoWin = null
let infoTimer = null
const infoSessao = { latencia: null, remoto: null }
function caminhoDaConexao () {
  const d = String(ultimoDestino || '')
  if (!d) return { tipo: 'Sessão SSAdesk (P2P)', detalhe: '' }
  if (d.startsWith('127.0.0.1:')) {
    return precisaRetransmissao.size ? { tipo: 'Internet · retransmissão cega', detalhe: 'Criptografado de ponta a ponta' } : { tipo: 'Internet · P2P direto', detalhe: 'Criptografado de ponta a ponta' }
  }
  const ip = d.replace(/^\[|\]$/g, '')
  if (/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|fe80:)/i.test(ip)) return { tipo: 'Rede local', detalhe: ip }
  return { tipo: ip.includes(':') ? 'Internet · IPv6 direto' : 'Internet · IPv4 direto', detalhe: ip }
}
function arquivoPadraoMotor () { return path.join(app.getPath('appData'), 'SSAdesk', 'config', 'SSAdesk_default.toml') }
function fpsLigado () { try { return /show_quality_monitor\s*=\s*'Y'/.test(fs.readFileSync(arquivoPadraoMotor(), 'utf8')) } catch { return false } }
// Liga/desliga o medidor de FPS, atraso e velocidade do próprio motor (aparece na janela da tela remota)
function definirFps (ligar) {
  const f = arquivoPadraoMotor()
  let t = ''; try { t = fs.readFileSync(f, 'utf8') } catch {}
  t = t.replace(/^show_quality_monitor\s*=.*\r?\n?/m, '')
  if (ligar) t = /^\[options\]/m.test(t) ? t.replace(/^\[options\]\r?\n/m, m => m + "show_quality_monitor = 'Y'\n") : t + (t && !t.endsWith('\n') ? '\n' : '') + "[options]\nshow_quality_monitor = 'Y'\n"
  fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, t)
  // computadores já acessados guardam a escolha própria: aplica neles também
  const pasta = path.join(app.getPath('appData'), 'SSAdesk', 'config', 'peers')
  try {
    for (const n of fs.readdirSync(pasta).filter(n => n.endsWith('.toml'))) {
      const p = path.join(pasta, n); const c = fs.readFileSync(p, 'utf8')
      const novo = /^show_quality_monitor\s*=/m.test(c) ? c.replace(/^show_quality_monitor\s*=.*$/m, 'show_quality_monitor = ' + (ligar ? 'true' : 'false')) : c
      if (novo !== c) fs.writeFileSync(p, novo)
    }
  } catch {}
}
function dadosInfo () {
  const ligado = !!(canal && canal.conectado() && sessao.ativa)
  return {
    conectado: ligado, nome: sessao.nome || 'Computador conectado', caminho: caminhoDaConexao(),
    latencia: ligado ? infoSessao.latencia : null, local: require('./info-sistema').coletar(), remoto: ligado ? infoSessao.remoto : null,
    fps: fpsLigado()
  }
}
function abrirInfo () {
  if (infoWin && !infoWin.isDestroyed()) { infoWin.close(); return } // o botão alterna
  const area = require('electron').screen.getPrimaryDisplay().workArea
  const W = 320; const H = 452
  infoWin = new BrowserWindow({
    width: W, height: H, x: area.x + area.width - W - 14, y: area.y + 14,
    frame: false, transparent: true, resizable: false, maximizable: false, minimizable: false, skipTaskbar: true,
    alwaysOnTop: true, show: false, title: 'Informações da conexão', hasShadow: false,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, sandbox: true, spellcheck: false }
  })
  infoWin.setAlwaysOnTop(true, 'floating')
  infoWin.loadFile(path.join(__dirname, 'src', 'info.html'))
  infoWin.once('ready-to-show', () => infoWin.show())
  const tique = () => {
    if (canal && canal.conectado() && sessao.ativa) { canal.controle({ t: 'ping', em: Date.now() }); canal.controle({ t: 'info-pedir' }) }
    setTimeout(() => { if (infoWin && !infoWin.isDestroyed()) infoWin.webContents.send('info-dados', dadosInfo()) }, 400)
  }
  tique(); infoTimer = setInterval(tique, 2000)
  infoWin.on('closed', () => { infoWin = null; clearInterval(infoTimer); infoTimer = null })
}
ipcMain.on('info-fechar', () => { if (infoWin && !infoWin.isDestroyed()) infoWin.close() })
ipcMain.handle('info-fps', (_e, ligar) => { try { definirFps(!!ligar); return { ok: true, fps: fpsLigado() } } catch (e) { return { ok: false, msg: e.message } } })
ipcMain.handle('sessao-info', () => ({ nome: sessao.nome, ativa: sessao.ativa }))

// Quem foi acessado: aviso discreto ao receber (um por item enviado, não um por arquivo de uma pasta)
let ultimoAviso = { raiz: '', em: 0 }
function avisarRecebido ({ nome, caminho, raiz }) {
  const { Notification } = require('electron')
  const agora = Date.now()
  if (raiz === ultimoAviso.raiz && agora - ultimoAviso.em < 4000) return
  ultimoAviso = { raiz, em: agora }
  const n = new Notification({ title: (sessao.nome || 'Alguém') + ' enviou um arquivo', body: raiz + ' — salvo na Área de Trabalho' })
  n.on('click', () => shell.showItemInFolder(caminho)); n.show()
}

// "Enviar para → SSAdesk" no botão direito do Windows
function registrarEnviarPara () {
  if (!isWin || !app.isPackaged) return
  try {
    const lnk = path.join(app.getPath('appData'), 'Microsoft', 'Windows', 'SendTo', 'SSAdesk.lnk')
    shell.writeShortcutLink(lnk, { target: process.execPath, args: '--enviar', icon: path.join(DIR, 'ssadesk.ico'), iconIndex: 0, description: 'Enviar para o computador conectado no SSAdesk' })
  } catch {}
}
function arquivosDaLinha (argv) {
  const i = argv.indexOf('--enviar')
  return i < 0 ? [] : argv.slice(i + 1).filter(a => !a.startsWith('--'))
}

// ---------- Lousa digital (Modo My): camada transparente sobre a tela inteira, nos dois computadores ----------
let lousaWin = null; let lousaPronta = false; const lousaFila = []
function abrirLousa () {
  if (lousaWin && !lousaWin.isDestroyed()) { lousaWin.showInactive(); return }
  const d = require('electron').screen.getPrimaryDisplay().bounds
  lousaPronta = false
  if (process.env.SSADESK_LOG) fs.appendFileSync(process.env.SSADESK_LOG, 'abrindo lousa\n')
  lousaWin = new BrowserWindow({
    x: d.x, y: d.y, width: d.width, height: d.height, frame: false, transparent: true, resizable: false, movable: false,
    skipTaskbar: true, alwaysOnTop: true, hasShadow: false, show: false, title: 'SSAdesk — Lousa', fullscreenable: false,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, sandbox: true, spellcheck: false }
  })
  lousaWin.setAlwaysOnTop(true, 'screen-saver')
  if (process.env.SSADESK_LOG) {
    const reg = s => fs.appendFileSync(process.env.SSADESK_LOG, s + '\n')
    lousaWin.webContents.on('did-fail-load', (_e, c, d) => reg('lousa falhou ao carregar: ' + c + ' ' + d))
    lousaWin.webContents.on('console-message', (_e, _l, msg) => reg('lousa console: ' + msg))
    lousaWin.webContents.on('render-process-gone', (_e, d) => reg('lousa caiu: ' + d.reason))
    lousaWin.webContents.on('dom-ready', () => reg('lousa dom pronto'))
  }
  lousaWin.loadFile(path.join(__dirname, 'src', 'lousa.html'))
  lousaWin.webContents.once('dom-ready', () => {
    lousaPronta = true; while (lousaFila.length) lousaWin.webContents.send('lousa-remoto', lousaFila.shift())
    if (process.env.SSADESK_FOTO_LOUSA) setTimeout(async () => {
      try { const img = await lousaWin.webContents.capturePage(); fs.writeFileSync(process.env.SSADESK_FOTO_LOUSA, img.toPNG()) } catch (e) { fs.appendFileSync(process.env.SSADESK_LOG, 'foto erro: ' + e.message + '\n') }
    }, 2500)
  })
  lousaWin.once('ready-to-show', () => {
    lousaWin.show()
  })
  lousaWin.on('closed', () => { lousaWin = null; lousaFila.length = 0 })
}
ipcMain.on('lousa-enviar', (_e, d) => { if (canal && canal.conectado() && d && typeof d === 'object') canal.controle({ t: 'lousa', d }) })
ipcMain.on('lousa-atravessar', (_e, sim) => { if (lousaWin && !lousaWin.isDestroyed()) lousaWin.setIgnoreMouseEvents(!!sim, { forward: true }) })
ipcMain.on('lousa-fechar', () => { if (lousaWin && !lousaWin.isDestroyed()) lousaWin.close() })

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
    const servidor = net.createServer({ allowHalfOpen: true }, async local => {
      local.pause()
      let s
      try { s = await conectarComRetransmissao(remoto) } catch { local.destroy(); return }
      local.pipe(s).pipe(local); local.resume()
      const fim = () => { local.destroy(); s.destroy() }
      local.on('error', fim).on('close', fim); s.on('error', fim).on('close', fim)
    })
    const porta = await new Promise((resolve, reject) => { servidor.once('error', reject); servidor.listen(0, '127.0.0.1', () => resolve(servidor.address().port)) })
    tuneis.set(chave, { porta, servidor })
    return porta
  } catch { return 0 }
}
// Abre um caminho P2P até a chave: direto (furo de NAT); se falhar por NAT incompatível, pela retransmissão
const ERROS_DE_FURO = ['HOLEPUNCH_ABORTED', 'HOLEPUNCH_DOUBLE_RANDOMIZED_NATS', 'CANNOT_HOLEPUNCH', 'REMOTE_NOT_HOLEPUNCHABLE', 'HOLEPUNCH_PROBE_TIMEOUT']
const precisaRetransmissao = new Set() // chaves que já precisaram de retransmissão: vão direto por ela
function abrirSocket (remoto, relay, ms) {
  return new Promise((resolve, reject) => {
    const opts = { reusableSocket: true }
    if (relay) opts.relayThrough = relay
    if (relay && process.env.SSADESK_SO_RETRANSMISSAO) { opts.holepunch = () => false; opts.localConnection = false } // teste: proíbe direto/rede local
    const s = canal._swarm().dht.connect(remoto, opts)
    const t = setTimeout(() => { s.destroy(); reject(Object.assign(new Error('tempo'), { code: 'TEMPO' })) }, ms)
    s.on('error', e => { clearTimeout(t); reject(e) })
    s.once('open', () => {
      clearTimeout(t)
      if (process.env.SSADESK_LOG) setTimeout(() => { const rs = s.rawStream; fs.appendFileSync(process.env.SSADESK_LOG, 'caminho da tela via ' + (rs ? rs.remoteHost + ':' + rs.remotePort : '?') + (relay ? ' (pedido pela retransmissão)' : ' (direto)') + '\n') }, 1000)
      resolve(s)
    })
  })
}
async function conectarComRetransmissao (remoto, ms = 30000) {
  const id = remoto.toString('hex')
  const forcar = process.env.SSADESK_FORCAR_RETRANSMISSAO || precisaRetransmissao.has(id) || canal._swarm().dht.randomized
  const relay = canal.escolherRetransmissor()
  if (forcar && relay) return abrirSocket(remoto, relay, ms)
  try { return await abrirSocket(remoto, null, ms) } catch (e) {
    const r2 = canal.escolherRetransmissor()
    if (!r2 || !(ERROS_DE_FURO.includes(e.code) || e.code === 'TEMPO')) throw e
    precisaRetransmissao.add(id)
    return abrirSocket(remoto, r2, ms)
  }
}
// Confirma que o caminho P2P até o outro computador abriu de verdade (e já deixa o caminho "furado")
async function abrirCaminhoP2P (chave, ms) {
  const s = await conectarComRetransmissao(Buffer.from(chave, 'hex'), ms)
  setTimeout(() => s.destroy(), 1500)
}
function testarTcp (host, porta, ms) {
  return new Promise((resolve, reject) => {
    const s = net.connect({ host, port: porta })
    const t = setTimeout(() => { s.destroy(); reject(new Error('tempo')) }, ms)
    s.once('connect', () => { clearTimeout(t); s.destroy(); resolve() })
    s.once('error', e => { clearTimeout(t); reject(e) })
  })
}
// Tenta todos os caminhos ao mesmo tempo (rede local, IPv6, túnel P2P) e usa o primeiro que responder
async function melhorCaminho ({ chave, ips = [] }) {
  const tentativas = ips.map(ip => testarTcp(ip, 21118, 3500).then(() => ip.includes(':') ? '[' + ip + ']' : ip))
  if (chave) tentativas.push((async () => { const porta = await tunelInterno(chave); if (!porta) throw new Error('túnel'); await abrirCaminhoP2P(chave, 45000); return '127.0.0.1:' + porta })())
  if (!tentativas.length) throw new Error('O outro computador não liberou o controle da tela.')
  try { return await Promise.any(tentativas) } catch { throw new Error('Não foi possível alcançar o outro computador por nenhum caminho.') }
}

// ---------- Biblioteca de conexões: computadores já acessados, com online/offline ----------
function biblioteca () { return (loadPrefs().biblioteca || []).slice(0, 30) }
function salvarNaBiblioteca (codigo, nome, extra) {
  const antigo = biblioteca().find(c => c.codigo === codigo) || {}
  const lista = biblioteca().filter(c => c.codigo !== codigo)
  lista.unshift({ ...antigo, codigo, nome: nome || antigo.nome || '', ultima: Date.now(), mac: (extra && extra.mac) || antigo.mac || '', ipPublico: (extra && extra.ipPublico) || antigo.ipPublico || '' })
  savePrefs({ ...loadPrefs(), biblioteca: lista.slice(0, 30), ultimoCodigo: codigo })
  avisarPainel('biblioteca-mudou')
}
ipcMain.handle('biblioteca', () => biblioteca())
ipcMain.handle('biblioteca-remover', (_e, codigo) => { savePrefs({ ...loadPrefs(), biblioteca: biblioteca().filter(c => c.codigo !== codigo) }); return biblioteca() })
ipcMain.handle('biblioteca-online', async (_e, codigo) => (canal ? canal.online(codigo) : false))

// ---------- Ligar um computador desligado (Wake-on-LAN), sem servidor ----------
// O "pacote mágico" precisa sair de dentro da mesma rede do computador desligado: ou daqui mesmo
// (se estou na mesma rede) ou de outro computador da lista que esteja ligado nessa rede.
function enviarPacoteDespertar (mac) {
  const bytes = String(mac || '').split(/[-:]/).map(h => parseInt(h, 16))
  if (bytes.length !== 6 || bytes.some(isNaN)) return false
  const pacote = Buffer.alloc(102, 0xff)
  for (let i = 0; i < 16; i++) Buffer.from(bytes).copy(pacote, 6 + i * 6)
  const s = require('dgram').createSocket('udp4')
  s.bind(() => {
    s.setBroadcast(true)
    let n = 0; const fim = () => { if (++n === 2) s.close() }
    s.send(pacote, 9, '255.255.255.255', fim); s.send(pacote, 7, '255.255.255.255', fim)
  })
  return true
}
ipcMain.handle('biblioteca-acordar', (_e, codigo) => acordarComputador(codigo))
async function acordarComputador (codigo) {
  const alvo = biblioteca().find(c => c.codigo === codigo)
  if (!alvo || !alvo.mac) return { ok: false, msg: 'Este computador ainda não informou o endereço da placa de rede. Conecte nele uma vez com ele ligado.' }
  const minha = readJson(path.join(DIR, 'rede.json')) || {}
  if (minha.ip_publico && alvo.ipPublico && minha.ip_publico === alvo.ipPublico) {
    enviarPacoteDespertar(alvo.mac)
    return { ok: true, msg: 'Sinal enviado. Ele deve ligar em até 1 minuto.' }
  }
  if (!canal) return { ok: false, msg: 'A rede P2P não está pronta.' }
  if (canal.conectado()) return { ok: false, msg: 'Encerre a conexão atual antes de ligar outro computador.' }
  // Procura um vizinho ligado da mesma rede, entre os computadores da lista
  const vizinhos = biblioteca().filter(c => c.codigo !== codigo && c.ipPublico && c.ipPublico === alvo.ipPublico)
  for (const v of vizinhos) {
    if (!(await canal.online(v.codigo, 5000))) continue
    try {
      await new Promise((resolve, reject) => {
        const t = setTimeout(() => { modoAcordar = null; canal.pararProcura(); reject(new Error('tempo')) }, 30000)
        modoAcordar = { mac: alvo.mac, ok: () => { clearTimeout(t); resolve() } }
        canal.procurar({ codigo: v.codigo })
      })
      return { ok: true, msg: 'Sinal enviado por ' + (v.nome || v.codigo) + '. Ele deve ligar em até 1 minuto.' }
    } catch {}
  }
  return { ok: false, msg: 'Nenhum computador da mesma rede está ligado para enviar o sinal.' }
}

// Conectar pelo código (9 dígitos), como no AnyDesk
async function conectarPorCodigo (codigo) {
  const { soDigitos } = require('./canal')
  encerradoPeloUsuario = false
  if (!canal) throw new Error('A rede P2P não iniciou. Reabra o SSAdesk.')
  if (soDigitos(codigo) === soDigitos(meuCodigo())) throw new Error('Este é o código deste computador.')
  if (canal.conectado()) { canal.encerrar(); await new Promise(r => setTimeout(r, 400)) }
  avisarPainel('conectar-status', 'Procurando o computador…')
  // Em paralelo: procura na rede local (responde em milissegundos e não depende da internet)
  let naRede = null
  const buscaLocal = lan ? lan.procurar(codigo, 3000).then(r => { naRede = r; if (r) avisarPainel('conectar-status', 'Encontrado na sua rede. Conectando…'); return r }) : Promise.resolve(null)
  let resposta
  try {
    resposta = await new Promise((resolve, reject) => {
    // Achou na rede local: espera a sessão completa só mais um pouco; senão abre a tela direto pela rede local
    buscaLocal.then(r => { if (r) setTimeout(() => { if (pendente) { pendente = null; canal.pararProcura(); reject(Object.assign(new Error('só rede local'), { local: true })) } }, 8000) })
    const t = setTimeout(() => { if (pendente) { pendente = null; canal.pararProcura(); reject(new Error('Computador não encontrado. Ele está ligado, com internet e com o SSAdesk aberto?')) } }, 45000)
    pendente = { resolve: v => { clearTimeout(t); resolve(v) }, reject: e => { clearTimeout(t); reject(e) } }
    canal.procurar({ codigo })
    canal.once('conectado', () => avisarPainel('conectar-status', 'Aguardando permissão…'))
  })
  } catch (e) {
    if (!(e.local && naRede)) throw e
    // Sem sessão pela internet, mas o computador está na mesma rede: acesso à tela direto (a senha é exigida)
    ultimoDestino = naRede.ip
    if (!process.env.SSADESK_CODIGO_TESTE) abrirRustDesk(naRede.ip)
    salvarNaBiblioteca(soDigitos(codigo), naRede.nome || '', null)
    return naRede.nome || soDigitos(codigo)
  }
  avisarPainel('conectar-status', 'Escolhendo o caminho mais rápido…')
  if (naRede) resposta = { ...resposta, ips: [naRede.ip, ...(resposta.ips || [])] } // rede local primeiro
  const destino = await melhorCaminho(resposta)
  ultimoDestino = destino
  sessao.codigo = soDigitos(codigo)
  if (!process.env.SSADESK_CODIGO_TESTE) abrirRustDesk(destino)
  salvarNaBiblioteca(soDigitos(codigo), sessao.nome, sessao.remoto)
  avisarPainel('sessao', { ativa: true, nome: sessao.nome })
  abrirBarra()
  return sessao.nome
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
    alwaysOnTop: true, show: false, title: 'SSAdesk — Mensagens', backgroundColor: '#00000000',
    icon: path.join(__dirname, 'assets', 'icon.png'),
    ...(isWin ? { titleBarStyle: 'hidden', backgroundMaterial: 'acrylic' } : {}),
    ...(isMac ? { titleBarStyle: 'hiddenInset', vibrancy: 'hud', visualEffectState: 'active' } : {}),
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, sandbox: true, spellcheck: false }
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
  await new Promise(r => setTimeout(r, Number(process.env.SSADESK_SNAPSHOT_ESPERA) || 2500))
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
    nome: loadPrefs().nome || '',
    plataforma: process.platform
  }
})

ipcMain.handle('nome', (_e, nome) => { savePrefs({ ...loadPrefs(), nome: String(nome || '').trim().slice(0, 40) }); return true })
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
  // Motor próprio na raiz da instalação; versões antigas tinham o RustDesk numa subpasta
  for (const p of [path.join(DIR, 'SSAdesk.exe'), path.join(DIR, 'RustDesk', 'rustdesk.exe')]) if (fs.existsSync(p)) return p
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
  if (!exe || !fs.existsSync(exe)) throw new Error('SSAdesk não está instalado corretamente.')
  spawn(exe, ['--connect', destino], { detached: true, stdio: 'ignore' }).unref()
}

ipcMain.handle('conectar', async (_e, destinoBruto) => {
  const destino = String(destinoBruto || '').replace(/\s/g, '')
  if (!destino) return { ok: false, msg: 'Digite o código do outro computador.' }
  try {
    // Código do computador (só números), como no AnyDesk
    if (/^\d{6,12}$/.test(destino)) {
      const nome = await conectarPorCodigo(destino)
      return { ok: true, msg: 'Conectado a ' + (nome || destino) + '. Digite a senha dele.' }
    }
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
    return { ok: false, msg: 'Código inválido. Ele tem 9 números.' }
  } catch (e) {
    return { ok: false, msg: e.message }
  }
})

ipcMain.on('abrir-pasta', () => shell.openPath(DIR))

// ---------- Instalação / desinstalação (telas glass) ----------
ipcMain.handle('setup-info', () => ({
  modo: MODO,
  versao: app.getVersion(),
  destino: (motor && motor.instalacaoAnterior()) || 'C:\\SSAdesk',
  passos: motor ? motor.PASSOS : []
}))

ipcMain.handle('setup-pasta', async (_e, atual) => {
  const r = await dialog.showOpenDialog(win, {
    title: 'Onde instalar o SSAdesk', defaultPath: path.dirname(atual || 'C:\\SSAdesk'),
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
// Desempenho: sem processo reserva do Chromium e sem recursos de mídia do sistema que o app não usa
app.commandLine.appendSwitch('disable-features', 'SpareRendererForSitePerProcess,HardwareMediaKeyHandling,MediaSessionService,Translate,AutofillServerCommunication')
// A voz do outro lado toca sem precisar de clique
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required')
app.whenReady().then(() => {
  const { session } = require('electron')
  const proprio = url => String(url || '').startsWith('file://')
  session.defaultSession.setPermissionRequestHandler((wc, perm, cb) => cb(['media', 'display-capture', 'clipboard-sanitized-write'].includes(perm) && proprio(wc.getURL())))
  session.defaultSession.setPermissionCheckHandler((wc, perm) => ['media', 'display-capture'].includes(perm) && proprio(wc && wc.getURL()))
  // Transmitir a tela: usa a tela principal (sem diálogo extra), só para as páginas do próprio app
  session.defaultSession.setDisplayMediaRequestHandler((req, cb) => {
    if (!proprio(req.frame && req.frame.url)) return cb({})
    require('electron').desktopCapturer.getSources({ types: ['screen'] }).then(s => cb(s.length ? { video: s[0] } : {})).catch(() => cb({}))
  })
  if (process.env.SSADESK_CALL) { abrirChamada({ nome: 'Lages' }); return }
  if (process.env.SSADESK_DIAG_TESTE) { iniciarCanal(); setTimeout(() => diagnosticoConexao().then(() => app.exit(0)), 12000); return }
  if (process.env.SSADESK_ACORDAR_TESTE) { iniciarCanal(); acordarComputador(process.env.SSADESK_ACORDAR_TESTE).then(r => fs.writeFileSync(process.env.SSADESK_LOG, JSON.stringify(r))); return }
  if (process.env.SSADESK_CODIGO_TESTE) {
    iniciarCanal()
    conectarPorCodigo(process.env.SSADESK_CODIGO_TESTE)
      .then(async n => {
        fs.writeFileSync(process.env.SSADESK_LOG, 'conectado: ' + n + ' via ' + ultimoDestino + '\n', { flag: 'a' })
        if (process.env.SSADESK_TELA_TESTE) ipcMain.emit('abrir-chamada', null, { tela: true })
        if (process.env.SSADESK_LOUSA_TESTE) { // desenha um círculo e um traço, como se fosse a pessoa
          const pts = []; for (let a = 0; a <= 64; a++) pts.push([0.5 + 0.12 * Math.cos(a / 64 * 2 * Math.PI), 0.5 + 0.2 * Math.sin(a / 64 * 2 * Math.PI)])
          canal.controle({ t: 'lousa', d: { acao: 'inicio', id: 'c1', cor: '#ff3b30', larg: 6, alfa: 1, pts } })
          canal.controle({ t: 'lousa', d: { acao: 'inicio', id: 'm1', cor: '#ffd60a', larg: 22, alfa: 0.35, pts: [[0.3, 0.8], [0.7, 0.8]] } })
        }
        if (process.env.SSADESK_ENVIAR_TESTE) {
          const t0 = Date.now(); const r = await enviarArquivos(process.env.SSADESK_ENVIAR_TESTE.split('|'))
          fs.writeFileSync(process.env.SSADESK_LOG, 'envio: ' + JSON.stringify(r) + ' em ' + (Date.now() - t0) + ' ms\n', { flag: 'a' })
        }
      })
      .catch(e => {
        fs.writeFileSync(process.env.SSADESK_LOG, 'erro: ' + e.message + '\n', { flag: 'a' })
        // A sessão P2P pode estar ativa mesmo sem caminho até a tela (teste da lousa não depende disso)
        if (process.env.SSADESK_LOUSA_TESTE && canal.conectado()) {
          const pts = []; for (let a = 0; a <= 64; a++) pts.push([0.5 + 0.12 * Math.cos(a / 64 * 2 * Math.PI), 0.5 + 0.2 * Math.sin(a / 64 * 2 * Math.PI)])
          canal.controle({ t: 'lousa', d: { acao: 'inicio', id: 'c1', cor: '#ff3b30', larg: 6, alfa: 1, pts } })
          canal.controle({ t: 'lousa', d: { acao: 'inicio', id: 'm1', cor: '#ffd60a', larg: 22, alfa: 0.35, pts: [[0.3, 0.8], [0.7, 0.8]] } })
        }
      })
    return
  }
  if (MODO !== 'app') { createWindow(); return }
  iniciarCanal()
  criarBandeja()
  registrarEnviarPara()
  aplicarInicioAutomatico()
  const paraEnviar = arquivosDaLinha(process.argv)
  if (paraEnviar.length) { enviarArquivos(paraEnviar); return }
  if (!SEGUNDO_PLANO) createWindow()
})

// ---------- Ícone perto do relógio (o SSAdesk continua disponível para chamadas) ----------
let bandeja = null
function mostrarPainel () {
  if (win && !win.isDestroyed()) { clearTimeout(win._liberar); win.show(); win.focus(); win.webContents.send('painel-visivel') } else createWindow()
}
function criarBandeja () {
  if (bandeja || process.env.SSADESK_SNAPSHOT) return
  const { Tray, Menu, nativeImage } = require('electron')
  bandeja = new Tray(nativeImage.createFromPath(path.join(__dirname, 'assets', isWin ? 'icon.ico' : 'icon.png')).resize({ width: 16, height: 16 }))
  bandeja.setToolTip('SSAdesk — disponível')
  bandeja.setContextMenu(Menu.buildFromTemplate([
    { label: 'Abrir SSAdesk', click: mostrarPainel },
    { label: 'Chamada de vídeo', click: () => ipcMain.emit('abrir-chamada') },
    { type: 'separator' },
    { label: 'Sair do SSAdesk', click: () => { app.saindo = true; app.exit(0) } }
  ]))
  bandeja.on('click', mostrarPainel)
}
app.on('second-instance', (_e, argv) => {
  if (MODO !== 'app') return
  const lista = arquivosDaLinha(argv)
  if (lista.length) enviarArquivos(lista); else mostrarPainel()
})
// Fechar o painel não encerra o app: ele segue no ícone perto do relógio para receber chamadas
app.on('window-all-closed', () => { if (MODO !== 'app' || !bandeja) app.quit() })
app.on('before-quit', () => { if (canal) canal.destruir() })

// Teste: abre o painel ⓘ e salva uma foto dele (SSADESK_FOTO_INFO=caminho.png)
if (process.env.SSADESK_FOTO_INFO) app.whenReady().then(() => setTimeout(() => {
  abrirInfo()
  setTimeout(async () => { try { fs.writeFileSync(process.env.SSADESK_FOTO_INFO, (await infoWin.webContents.capturePage()).toPNG()) } catch {} app.exit(0) }, 6000)
}, 1500))
