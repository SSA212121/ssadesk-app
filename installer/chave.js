const [mod, seed, out] = process.argv.slice(2)
// Chave de internet = chave pública derivada da semente (igual à anunciada pelo hypertele-server)
require('fs').writeFileSync(out, require(mod).keyPair(Buffer.from(seed, 'hex')).publicKey.toString('hex'))
