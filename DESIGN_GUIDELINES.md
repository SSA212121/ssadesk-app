# SSADesk — Diretrizes visuais (inspiração Apple)

Aplicar em toda interface do SSADesk: janela de configuração do acesso remoto, janela de chamada de vídeo, instaladores (nas telas que o RustDesk permitir customizar) e no app `videocall-app`.

## Princípios

- **Minimalista e moderno**, como FaceTime, Calculadora, Ajustes do macOS/iOS. Pouco texto, ícones claros, muito espaço em branco/negativo.
- **Sem skeuomorfismo, sem gradientes pesados, sem bordas duras.** Cantos "continuous corner" (raio grande, 16–20px em janelas e cards, 10–12px em botões).
- **Vidro/translúcido (vibrancy):** fundo com leve blur e transparência (como o painel de controle do macOS) em barras de controle e janelas flutuantes.
- **Tipografia:** fonte do sistema (SF Pro no macOS, Segoe UI Variable no Windows) — nunca uma fonte "genérica de app". Pesos: títulos em `semibold`, corpo em `regular`.
- **Tema claro, escuro e "Automático" (segue o sistema)** — obrigatório nas três opções, com transição suave ao alternar.
- **Cor de destaque:** azul tipo iOS (`#0A84FF` no escuro / `#007AFF` no claro) para botões primários e estados ativos; neutro em cinzas quase-pretos/quase-brancos no resto.
- **Sombras suaves e difusas**, nunca sombras duras ou com contorno preto.
- **Separadores finos (1px, baixa opacidade)** em vez de caixas com borda grossa.

## Janela de chamada de vídeo (estilo FaceTime)

- Vídeo remoto ocupa a janela toda; o próprio vídeo local aparece como PiP (picture-in-picture) pequeno, canto arredondado, **arrastável livremente pela janela**, com sombra suave.
- Barra de controles flutuante na parte inferior, translúcida, com botões **circulares**: mudo, câmera on/off, encerrar chamada (vermelho, estilo FaceTime), que aparece/some com fade ao mover o mouse.
- Janela pode ser **redimensionada e fechada** por qualquer um dos dois lados, sem travar a sessão de controle de tela.
- Cantos da janela arredondados, sombra externa suave simulando elevação (como uma janela nativa do macOS).

## Ícones

- Preferir glifos de linha fina, estilo SF Symbols (monocromáticos, peso leve a médio), não ícones coloridos "flat design" genéricos.

## Acessibilidade

- Contraste mínimo AA em ambos os temas.
- Todos os controles com estado de foco visível (anel de foco sutil, como no macOS).
