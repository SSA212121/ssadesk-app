// Usado pelo build.ps1: confirma que os mÃ³dulos de rede do app carregam dentro do pacote final
const path = require('path')
const pasta = process.argv[2]
try {
  for (const m of ['node_modules/hyperswarm', 'canal', 'descoberta-lan', 'arquivos', 'info-sistema', 'janela-remota', 'senha-local']) require(path.join(pasta, m))
  require('fs').writeFileSync(process.argv[3], 'modulos-ok')
} catch (e) { require('fs').writeFileSync(process.argv[3], 'ERRO: ' + e.message) }
