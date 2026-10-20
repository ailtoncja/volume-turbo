# Volume Turbo

Extensão para Firefox e Chrome que aumenta (ou diminui) o volume de qualquer aba, de **0% a 600%**,
mostra as abas que estão tocando som e troca entre elas com um clique.

## Como funciona

- Cada `<video>`/`<audio>` da página passa por um amplificador do próprio navegador (Web Audio, `GainNode`).
  Isso funciona igual no Firefox e no Chrome (o Volume Master usa `tabCapture`, que só existe no Chrome).
- Enquanto a aba está em 100%, a extensão não mexe na página.
- O volume vale para a aba (continua ao navegar dentro dela) e é esquecido quando a aba é fechada.
- O número aparece no ícone da extensão quando a aba não está em 100%.

### Limites do navegador

- **Áudio protegido (DRM)** — Netflix, Spotify, Prime Video etc. — não pode ser processado; a extensão não mexe nele.
- **Mídia de outro domínio sem permissão (CORS)** ficaria muda se processada; a extensão deixa como está.
- Páginas do navegador e lojas de extensões não deixam extensões entrarem.
- Antes do primeiro clique na página o navegador pode bloquear o áudio; nesse caso a extensão aplica o volume no primeiro clique/tecla.

## Instalar

**Chrome:** `chrome://extensions` → Modo do desenvolvedor → **Carregar sem compactação** → escolha a pasta `Volume Turbo`.

**Firefox:** `about:debugging#/runtime/this-firefox` → **Carregar extensão temporária…** → `firefox/manifest.json`
(ou `dist/volume-turbo-firefox-<versão>.xpi`). Para instalar de vez, assine o `.xpi` em
addons.mozilla.org → "Por conta própria", como na Auto Qualidade HD.

## Estrutura

```
manifest.json          Manifesto do Chrome (service worker)
background.js          Guarda o volume de cada aba e mostra o número no ícone
content.js             Aplica o volume nos vídeos/áudios da página (Web Audio)
popup/                 Menu: volume da aba, botões rápidos e abas tocando som
icons/                 Ícones
firefox/               Versão do Firefox (manifest próprio + cópia do código)
sincronizar-firefox.ps1  Copia o código atualizado para firefox/
dist/                  Pacotes prontos (.zip do Chrome e .xpi do Firefox)
```

## Baixar e licença

O `.xpi` (Firefox) e o `.zip` (Chrome) de cada versão ficam em
[Releases](https://github.com/ailtoncja/volume-turbo/releases). Código sob a licença MIT (veja `LICENSE`).
