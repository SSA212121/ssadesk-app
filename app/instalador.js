// SSAdesk — motor de instalação e desinstalação (Windows), usado pelas telas glass de instalação.
// Instalação SEMPRE limpa: remove a versão anterior (inclusive a antiga feita pelo Inno Setup)
// antes de instalar, preservando só a identidade do computador (pasta dados\: chave de internet).
const fs = require('fs')
const os = require('os')
const path = require('path')
const { spawn, execFileSync } = require('child_process')

const ARP = 'HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\SSAdesk'
const RUN = 'HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run'
const INNO_ARP = 'HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\{6B1F4C2E-8D3A-4E7B-9A51-5A1D35C0A001}_is1'
const PS = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe')
const PUBLIC_DESKTOP = path.join(process.env.PUBLIC || 'C:\\Users\\Public', 'Desktop')
const START_MENU = path.join(process.env.ProgramData || 'C:\\ProgramData', 'Microsoft', 'Windows', 'Start Menu', 'Programs')

function regGet (key, name) {
  try {
    const out = execFileSync('reg.exe', ['query', key, '/v', name], { encoding: 'utf8', windowsHide: true })
    const m = out.match(new RegExp(name + '\\s+REG_\\w+\\s+(.*)'))
    return m ? m[1].trim() : ''
  } catch { return '' }
}

// Onde está a instalação atual (se houver)
function instalacaoAnterior () {
  const candidatos = [
    regGet(ARP, 'InstallLocation'),
    regGet(INNO_ARP, 'InstallLocation').replace(/\\$/, ''),
    'C:\\SSAdesk'
  ].filter(Boolean)
  return candidatos.find(d => fs.existsSync(path.join(d, 'tools')) || fs.existsSync(path.join(d, 'app'))) || ''
}

function run (exe, args, onLine) {
  return new Promise((resolve, reject) => {
    const p = spawn(exe, args, { windowsHide: true })
    let out = ''
    const feed = d => { const s = d.toString(); out += s; if (onLine) s.split(/\r?\n/).forEach(l => l && onLine(l)) }
    p.stdout.on('data', feed); p.stderr.on('data', feed)
    p.on('error', reject)
    p.on('close', code => code === 0 ? resolve(out) : reject(new Error(out.split(/\r?\n/).filter(Boolean).slice(-3).join(' ') || ('código ' + code))))
  })
}
const ps = (cmd, onLine) => run(PS, ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', cmd], onLine)
const psFile = (file, args, onLine) => run(PS, ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', file, ...args], onLine)

// Segurança: só limpa pastas que são do SSAdesk (nome SSAdesk e com marcas da instalação)
function ehPastaSSAdesk (dir) {
  if (path.basename(dir).toLowerCase() !== 'ssadesk') return false
  const itens = fs.readdirSync(dir).map(n => n.toLowerCase())
  return itens.length === 0 || itens.some(n => ['tools', 'app', 'p2p', 'dados', 'unins000.exe', 'ssadesk.exe'].includes(n))
}

function apagarPasta (dir, manter) {
  if (!fs.existsSync(dir) || !ehPastaSSAdesk(dir)) return
  for (const nome of fs.readdirSync(dir)) {
    if (manter && nome.toLowerCase() === manter) continue
    fs.rmSync(path.join(dir, nome), { recursive: true, force: true, maxRetries: 5, retryDelay: 400 })
  }
}

// Arquivos ainda presos por um programa que acabou de ser fechado: tenta de novo por alguns segundos
async function apagarComPaciencia (dir, manter) {
  for (let i = 0; ; i++) {
    try { apagarPasta(dir, manter); return } catch (e) {
      if (i >= 6) throw new Error('Não foi possível limpar ' + dir + '. Feche o SSAdesk e tente de novo.')
      await pararTudo(dir)
      await new Promise(r => setTimeout(r, 1500))
    }
  }
}

// Para tudo que é do SSAdesk (exceto este próprio processo, que roda da pasta temporária do instalador)
async function pararTudo (dir) {
  await ps(`
    foreach ($t in 'SSAdesk-p2p','SSAdesk-local','SSAdesk-rede','SSAdesk-hbbs','SSAdesk-hbbr') { schtasks /End /TN $t 2>$null | Out-Null }
    Get-CimInstance Win32_Process | Where-Object { $_.ExecutablePath -and $_.ExecutablePath -like '${dir.replace(/'/g, "''")}\\*' -and $_.ProcessId -ne ${process.pid} } |
      ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
    exit 0`).catch(() => {})
}

async function removerAnterior (dir) {
  if (!dir) return
  await pararTudo(dir)
  const inno = path.join(dir, 'unins000.exe')
  if (fs.existsSync(inno)) {
    await run(inno, ['/VERYSILENT', '/SUPPRESSMSGBOXES', '/NORESTART']).catch(() => {})
    await new Promise(r => setTimeout(r, 3000)) // o desinstalador do Inno termina em segundo plano
  } else if (fs.existsSync(path.join(dir, 'tools', 'configure.ps1'))) {
    await psFile(path.join(dir, 'tools', 'configure.ps1'), ['-Mode', 'uninstall', '-InstallDir', dir]).catch(() => {})
  }
  for (const lnk of ['SSAdesk.lnk', 'SSAdesk - Conectar pela internet.lnk']) {
    fs.rmSync(path.join(PUBLIC_DESKTOP, lnk), { force: true })
    fs.rmSync(path.join(START_MENU, lnk), { force: true })
  }
  await apagarComPaciencia(dir, 'dados') // mantém a identidade do computador
}

function copiar (payload, destino) {
  fs.mkdirSync(destino, { recursive: true })
  for (const nome of ['app', 'bin', 'tools', 'ssadesk.ico', 'ssadesk.png', 'LICENSE-RUSTDESK-AGPL.txt', 'LICENSE-SERVER-AGPL.txt']) {
    const src = path.join(payload, nome)
    if (fs.existsSync(src)) fs.cpSync(src, path.join(destino, nome), { recursive: true, force: true })
  }
  // Motor SSAdesk (SSAdesk.exe e bibliotecas) vai para a raiz da instalação
  const motor = path.join(payload, 'motor')
  if (fs.existsSync(motor)) for (const n of fs.readdirSync(motor)) fs.cpSync(path.join(motor, n), path.join(destino, n), { recursive: true, force: true })
}

async function registrar (dir, versao) {
  const exe = path.join(dir, 'app', 'SSAdeskApp.exe')
  const ico = path.join(dir, 'ssadesk.ico')
  // Atalhos (área de trabalho pública e menu Iniciar)
  await ps(`
    $w = New-Object -ComObject WScript.Shell
    foreach ($p in '${path.join(PUBLIC_DESKTOP, 'SSAdesk.lnk')}', '${path.join(START_MENU, 'SSAdesk.lnk')}') {
      $s = $w.CreateShortcut($p); $s.TargetPath = '${exe}'; $s.IconLocation = '${ico}'; $s.Description = 'Acesso remoto SSAdesk'; $s.Save()
    }`)
  // Programas e Recursos (desinstalar pelo Windows abre a tela glass de desinstalação)
  const unin = `"${PS}" -NoProfile -WindowStyle Hidden -Command "Start-Process '${exe}' -ArgumentList '--desinstalar' -Verb RunAs"`
  const vals = [
    ['DisplayName', 'REG_SZ', 'SSAdesk'], ['DisplayVersion', 'REG_SZ', versao], ['Publisher', 'REG_SZ', 'SSA Comércio'],
    ['DisplayIcon', 'REG_SZ', ico], ['InstallLocation', 'REG_SZ', dir], ['UninstallString', 'REG_SZ', unin],
    ['NoModify', 'REG_DWORD', '1'], ['NoRepair', 'REG_DWORD', '1']
  ]
  for (const [n, t, v] of vals) execFileSync('reg.exe', ['add', ARP, '/v', n, '/t', t, '/d', v, '/f'], { windowsHide: true })
  // O início com o Windows é ligado pelo próprio app (Ajustes → Iniciar com o Windows); remove o registro antigo
  try { execFileSync('reg.exe', ['delete', RUN, '/v', 'SSAdesk', '/f'], { windowsHide: true }) } catch {}
}

// Passos mostrados na tela (o índice é o que a interface recebe)
const PASSOS = ['Removendo versão anterior', 'Copiando arquivos', 'Configurando acesso remoto', 'Abrindo túnel seguro', 'Analisando a rede', 'Finalizando']

// Pasta final sempre termina em \SSAdesk (ex.: D:\ vira D:\SSAdesk), nunca a raiz de um disco
function pastaFinal (escolhida) {
  const p = path.resolve(escolhida || 'C:\\SSAdesk')
  return path.basename(p).toLowerCase() === 'ssadesk' ? p : path.join(p, 'SSAdesk')
}

async function instalar ({ payload, destino: escolhido, senha, versao, manterSenha }, avisar) {
  const destino = pastaFinal(escolhido)
  if (manterSenha) senha = '' // atualização: mantém a senha atual (o configure.ps1 confere que ela existe)
  else if (!senha || senha.length < 8) throw new Error('A senha precisa ter ao menos 8 caracteres.')
  const passo = i => avisar({ passo: i })
  passo(0)
  const anterior = instalacaoAnterior()
  await removerAnterior(anterior)
  if (anterior && path.resolve(anterior).toLowerCase() !== path.resolve(destino).toLowerCase()) {
    // Mudou de pasta: leva a identidade junto e apaga a pasta antiga
    const dadosAnt = path.join(anterior, 'dados')
    if (fs.existsSync(dadosAnt) && !fs.existsSync(path.join(destino, 'dados'))) {
      fs.mkdirSync(destino, { recursive: true }); fs.cpSync(dadosAnt, path.join(destino, 'dados'), { recursive: true })
    }
    if (ehPastaSSAdesk(anterior)) fs.rmSync(anterior, { recursive: true, force: true, maxRetries: 5, retryDelay: 400 })
  }
  // Restos na pasta escolhida (ex.: instalação anterior que parou no meio): desliga e remove também
  if (fs.existsSync(destino) && path.resolve(destino).toLowerCase() !== path.resolve(anterior || '.').toLowerCase()) await removerAnterior(destino)
  await pararTudo(destino)
  await apagarComPaciencia(destino, 'dados')

  passo(1)
  copiar(payload, destino)

  passo(2)
  const pw = path.join(os.tmpdir(), 'ssadesk-' + process.pid + '.tmp')
  fs.writeFileSync(pw, senha, { mode: 0o600 })
  try {
    await psFile(path.join(destino, 'tools', 'configure.ps1'),
      ['-Mode', 'install', '-InstallDir', destino, '-PasswordFile', pw],
      linha => {
        if (/ETAPA tunel/.test(linha)) passo(3)
        if (/ETAPA rede/.test(linha)) passo(4)
      })
  } finally { fs.rmSync(pw, { force: true }) }
  // Cópia protegida pelo Windows: o SSAdesk entrega a senha só quando alguém clica Permitir
  if (senha) try { await require('./senha-local').guardar(senha) } catch {}

  passo(5)
  await registrar(destino, versao)
  const ler = n => { try { return fs.readFileSync(path.join(destino, n), 'utf8').replace(/^\uFEFF/, '').trim() } catch { return '' } }
  let rede = null; try { rede = JSON.parse(ler('rede.json')) } catch {}
  return { codigo: ler('codigo.txt'), chave: ler('chave-internet.txt'), exe: path.join(destino, 'app', 'SSAdeskApp.exe'), cgnat: rede && rede.cgnat }
}

async function desinstalar (dir) {
  await pararTudo(dir)
  if (fs.existsSync(path.join(dir, 'tools', 'configure.ps1'))) {
    await psFile(path.join(dir, 'tools', 'configure.ps1'), ['-Mode', 'uninstall', '-InstallDir', dir]).catch(() => {})
  }
  fs.rmSync(path.join(PUBLIC_DESKTOP, 'SSAdesk.lnk'), { force: true })
  fs.rmSync(path.join(START_MENU, 'SSAdesk.lnk'), { force: true })
  try { execFileSync('reg.exe', ['delete', ARP, '/f'], { windowsHide: true }) } catch {}
  try { execFileSync('reg.exe', ['delete', RUN, '/v', 'SSAdesk', '/f'], { windowsHide: true }) } catch {}
  try { execFileSync('reg.exe', ['delete', 'HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run', '/v', 'electron.app.SSAdesk', '/f'], { windowsHide: true }) } catch {}
  try { execFileSync('reg.exe', ['delete', 'HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run', '/v', 'SSAdesk', '/f'], { windowsHide: true }) } catch {}
  // "Enviar para → SSAdesk" (criado pelo app no perfil do usuário)
  if (process.env.APPDATA) fs.rmSync(path.join(process.env.APPDATA, 'Microsoft', 'Windows', 'SendTo', 'SSAdesk.lnk'), { force: true })
  // A pasta (inclusive este programa) é apagada logo depois que esta janela fechar
  if (!ehPastaSSAdesk(dir)) return
  spawn('cmd.exe', ['/c', `ping -n 4 127.0.0.1 >nul & rmdir /s /q "${dir}"`], { detached: true, stdio: 'ignore', windowsHide: true }).unref()
}

module.exports = { instalar, desinstalar, instalacaoAnterior, pastaFinal, PASSOS }
