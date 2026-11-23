'use strict';
// Main loop. Ink outlines "boil" by cycling 3 drawings at ~6.7 fps, like hand-drawn animation.
// F toggles an FPS meter. If the game runs below ~45 fps for a few seconds, the render
// resolution is lowered automatically (and raised again when there is headroom).
setScene(new TitleScene());
let last = performance.now();
const perf = { show: false, n: 0, acc: 0, fps: 60, ms: 0, slow: 0, fast: 0 };
addEventListener('keydown', e => { if (e.code === 'KeyF') perf.show = !perf.show; });
function frame(t) {
  const raw = (t - last) / 1000, dt = Math.min(0.033, raw); last = t;
  BOIL = Math.floor(t / 150) % 3;
  const t0 = performance.now();
  pollInput();
  scene.update(dt);
  ctx.setTransform(K, 0, 0, K, 0, 0);
  scene.draw();
  perf.n++; perf.acc += raw; perf.ms += performance.now() - t0;
  if (perf.acc >= 1) {
    perf.fps = perf.n / perf.acc; const ms = perf.ms / perf.n; perf.n = 0; perf.acc = 0; perf.ms = 0; perf.cpu = ms;
    if (!document.hidden) {
      if (perf.fps < 45) { perf.fast = 0; if (++perf.slow >= 3 && QUALITY > 0.5) { QUALITY = Math.max(0.5, QUALITY - 0.25); perf.slow = 0; resize(); } }
      else if (perf.fps > 57 && ms < 8) { perf.slow = 0; if (++perf.fast >= 10 && QUALITY < 1) { QUALITY = Math.min(1, QUALITY + 0.25); perf.fast = 0; resize(); } }
      else { perf.slow = 0; perf.fast = 0; }
    }
  }
  if (perf.show) { ctx.setTransform(K, 0, 0, K, 0, 0); txt(`${Math.round(perf.fps)} fps  ${(perf.cpu || 0).toFixed(1)} ms  q${QUALITY}`, W - 8, H - 12, 14, PAL.white, 'right'); }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
