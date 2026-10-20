// Volume Turbo — aumenta (ou diminui) o volume dos vídeos e áudios da página, de 0% a 600%.
//
// Usa o processamento de áudio do próprio navegador (Web Audio): cada <video>/<audio>
// passa por um "ganho". Isso funciona igual no Firefox e no Chrome (o Volume Master usa
// um recurso que só existe no Chrome). Enquanto o volume da aba for 100%, nada é tocado.
//
// Limites do navegador (não dá para contornar sem capturar a aba inteira):
//  - áudio protegido (DRM: Netflix, Spotify, Prime Video...) não pode ser processado;
//  - mídia de outro domínio sem permissão (CORS) ficaria muda se processada, então é ignorada.
(() => {
  if (globalThis.__volumeTurboStarted) return;
  globalThis.__volumeTurboStarted = true;

  // Firefox expõe `browser` (com Promises); Chrome expõe `chrome`.
  const api = globalThis.browser ?? globalThis.chrome;

  let volume = 1; // 1 = 100%
  let ctx = null;
  const gains = new Map(); // elemento de mídia → GainNode
  let waitingGesture = false;

  // Só processamos o que o navegador deixa processar sem deixar a mídia muda.
  function canBoost(media) {
    if (media.mediaKeys) return false; // conteúdo protegido (DRM)
    if (media.srcObject) return true; // chamadas de vídeo, câmera etc.
    const src = media.currentSrc || media.src;
    if (!src || /^(blob|data):/i.test(src)) return true; // YouTube, Twitch, Kick usam blob:
    try {
      return new URL(src, location.href).origin === location.origin || media.crossOrigin != null;
    } catch {
      return false;
    }
  }

  // Vídeos e áudios da página, incluindo os que ficam dentro de "shadow DOM" aberto.
  function allMedia(root = document, found = []) {
    for (const el of root.querySelectorAll('video, audio')) found.push(el);
    for (const el of root.querySelectorAll('*')) if (el.shadowRoot) allMedia(el.shadowRoot, found);
    return found;
  }

  function connect(media) {
    if (gains.has(media) || !canBoost(media)) return;
    try {
      const source = ctx.createMediaElementSource(media);
      const gain = ctx.createGain();
      gain.gain.value = volume;
      source.connect(gain).connect(ctx.destination);
      gains.set(media, gain);
    } catch {
      // Outro script da página já processa essa mídia: deixamos como está.
    }
  }

  // O navegador só libera o áudio depois de um clique/tecla na página. Conectar a mídia
  // antes disso a deixaria muda, então esperamos o primeiro gesto.
  function waitForGesture() {
    if (waitingGesture) return;
    waitingGesture = true;
    const onGesture = () => {
      waitingGesture = false;
      window.removeEventListener('pointerdown', onGesture, true);
      window.removeEventListener('keydown', onGesture, true);
      apply();
    };
    window.addEventListener('pointerdown', onGesture, true);
    window.addEventListener('keydown', onGesture, true);
  }

  // No Chrome, criar ou retomar o áudio antes de um clique/tecla na página gera o aviso
  // "The AudioContext was not allowed to start" na lista de erros da extensão. Lá, se a
  // página ainda não recebeu nenhum gesto, nem tentamos: esperamos o primeiro.
  // (O Firefox libera o áudio em mais casos e não reclama, então segue tentando direto.)
  const needsGesture = () => !globalThis.browser && navigator.userActivation?.hasBeenActive === false;

  async function apply() {
    if (volume === 1 && gains.size === 0) return; // 100% e nada conectado: não mexe na página
    if (needsGesture()) {
      waitForGesture();
      return;
    }
    if (!ctx) ctx = new AudioContext();
    if (ctx.state !== 'running') {
      // resume() fica pendente para sempre se o navegador não liberar o áudio.
      await Promise.race([ctx.resume().catch(() => {}), new Promise((r) => setTimeout(r, 300))]);
    }
    if (ctx.state !== 'running') {
      waitForGesture();
      return;
    }
    for (const media of allMedia()) connect(media);
    for (const gain of gains.values()) gain.gain.setTargetAtTime(volume, ctx.currentTime, 0.015);
  }

  // Mídia que começa a tocar depois (próximo vídeo, anúncio, player que carrega tarde).
  document.addEventListener(
    'play',
    () => {
      if (volume !== 1) apply();
    },
    true
  );

  api.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === 'volume:set') {
      volume = Math.max(0, Math.min(600, Number(message.value) || 0)) / 100;
      apply();
    } else if (message?.type === 'volume:ping') {
      sendResponse({ ok: true });
    }
  });

  // Volume desta aba (definido antes, ou ao navegar para outra página na mesma aba).
  Promise.resolve(api.runtime.sendMessage({ type: 'volume:get' }))
    .then((reply) => {
      if (reply && typeof reply.value === 'number') {
        volume = reply.value / 100;
        apply();
      }
    })
    .catch(() => {});
})();
