// SSAdesk — guarda a senha fixa deste computador protegida pelo Windows (DPAPI, só esta conta de usuário abre).
// Serve para o SSAdesk entregar a senha ao outro lado SÓ quando uma pessoa clica "Permitir" (ou marcou
// "Permitir sempre"): assim quem acessa entra direto, sem a tela de senha do motor.
// Nos modos sem ninguém na frente (liberar sozinho / permitir direto) a senha nunca é enviada.
const fs = require('fs')
const path = require('path')
const { execFile } = require('child_process')

const arquivo = () => path.join(process.env.APPDATA || '', 'SSAdesk', 'acesso.dat')

function ps (script, entrada) {
  return new Promise((resolve, reject) => {
    const p = execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { windowsHide: true, timeout: 15000 }, (e, out) => e ? reject(e) : resolve(String(out).trim()))
    p.stdin.end(entrada || '')
  })
}

const PROTEGER = "Add-Type -AssemblyName System.Security; $t=[Console]::In.ReadToEnd(); $b=[Text.Encoding]::UTF8.GetBytes($t); " +
  "[Convert]::ToBase64String([Security.Cryptography.ProtectedData]::Protect($b,$null,'CurrentUser'))"
const ABRIR = "Add-Type -AssemblyName System.Security; $t=[Console]::In.ReadToEnd().Trim(); " +
  "[Text.Encoding]::UTF8.GetString([Security.Cryptography.ProtectedData]::Unprotect([Convert]::FromBase64String($t),$null,'CurrentUser'))"

async function guardar (senha) {
  if (process.platform !== 'win32' || !senha) return
  const cifrada = await ps(PROTEGER, senha)
  fs.mkdirSync(path.dirname(arquivo()), { recursive: true })
  fs.writeFileSync(arquivo(), cifrada)
}

async function ler () {
  try {
    if (process.platform !== 'win32') return ''
    const cifrada = fs.readFileSync(arquivo(), 'utf8')
    return await ps(ABRIR, cifrada)
  } catch { return '' }
}

module.exports = { guardar, ler }
