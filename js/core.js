'use strict';
// POWDER PANIC — core: canvas, utils, input (Xbox pads + keyboard), original chiptune audio, particles.

const cv = document.getElementById("c"); let ctx = cv.getContext("2d");
const W = 960, H = 540;
let K = 1, QUALITY = 1;   // QUALITY < 1 renders at lower resolution when the machine is too slow
function resize() {
  const s = Math.min(innerWidth / W, innerHeight / H), d = (devicePixelRatio || 1) * QUALITY;
  cv.width = Math.round(W * s * d); cv.height = Math.round(H * s * d);
  cv.style.width = W * s + 'px'; cv.style.height = H * s + 'px';
  K = s * d;
}
addEventListener('resize', resize); resize();

/* ---------- utils ---------- */
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a, b) => a + Math.random() * (b - a);
const hash = n => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
function mulberry(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const PC = ['#e8553f', '#3f8fe0'], PCD = ['#9c2f22', '#24548f'], PN = ['P1', 'P2'];
const fmtT = t => t === Infinity ? 'DNF' : t.toFixed(2) + 's';

/* ---------- input ---------- */
const keys = {};
addEventListener('keydown', e => {
  keys[e.code] = true; audio.unlock();
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter', 'ShiftLeft', 'ShiftRight'].includes(e.code)) e.preventDefault();
});
addEventListener('keyup', e => { keys[e.code] = false; });
addEventListener('mousedown', () => audio.unlock());
const KB = [
  { up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD', a: 'Space', b: 'ShiftLeft', x: 'KeyE', start: 'Escape' },
  { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight', a: 'Enter', b: 'ShiftRight', x: 'ControlRight', start: 'KeyP' },
];
let pads = [];
const mkIn = () => ({ lx: 0, ly: 0, rx: 0, ry: 0, a: false, b: false, x: false, start: false, up: false, down: false, left: false, right: false, src: 'keyboard' });
const inp = [mkIn(), mkIn()];
const dz = v => Math.abs(v) < 0.22 ? 0 : (v - Math.sign(v) * 0.22) / 0.78;
// Controllers are claimed by pressing A (same approach as the train game). Virtual pads that mirror an
// already-claimed controller in the same frame (e.g. xboxdrv "userspace driver") are marked as aliases and ignored.
const padOwner = [null, null], padAlias = new Set(), padLastA = {};
function assignPads(list) {
  const down = list.filter(g => g.buttons[0] && g.buttons[0].pressed && !padLastA[g.index]);
  for (const g of list) padLastA[g.index] = !!(g.buttons[0] && g.buttons[0].pressed);
  const mirrors = (a, b) => a.buttons.every((x, i) => !b.buttons[i] || x.pressed === b.buttons[i].pressed)
    && a.axes.every((v, i) => Math.abs(v - (b.axes[i] || 0)) < 0.15);
  for (const g of down) {
    if (padOwner.includes(g.index) || padAlias.has(g.index)) continue;
    if (padOwner.some(o => o !== null && o !== g.index && list.find(x => x.index === o) && mirrors(g, list.find(x => x.index === o)))) padAlias.add(g.index);
  }
  const fresh = down.filter(g => !padOwner.includes(g.index) && !padAlias.has(g.index));
  if (!fresh.length) return;
  if (down.some(g => padOwner.includes(g.index))) { fresh.forEach(g => padAlias.add(g.index)); return; }
  fresh.sort((a, b) => /userspace/i.test(a.id) - /userspace/i.test(b.id));
  const slot = padOwner.indexOf(null);
  if (slot < 0) return;
  padOwner[slot] = fresh[0].index;
  fresh.slice(1).forEach(g => padAlias.add(g.index));
  toast = { t: 3, s: `🎮 ${PN[slot]} controller connected` };
  rumble(slot, 0.4, 0.4, 200);
}
function pollInput() {
  const list = [...(navigator.getGamepads ? navigator.getGamepads() : [])].filter(p => p && p.connected);
  for (let i = 0; i < 2; i++) if (padOwner[i] !== null && !list.some(g => g.index === padOwner[i])) padOwner[i] = null;
  assignPads(list);
  if (list.some(g => (g.buttons[0] && g.buttons[0].pressed) || (g.buttons[9] && g.buttons[9].pressed))) audio.unlock();
  pads = [0, 1].map(i => list.find(x => x.index === padOwner[i]) || null);
  for (let i = 0; i < 2; i++) {
    const I = inp[i], k = KB[i], g = pads[i];
    const prev = { a: I.a, b: I.b, x: I.x, start: I.start, up: I.up, down: I.down, left: I.left, right: I.right };
    let lx = 0, ly = 0, rx = 0, ry = 0, a = !!keys[k.a] || (i === 1 && !!keys.NumpadEnter), b = !!keys[k.b], x = !!keys[k.x], st = !!keys[k.start];
    if (keys[k.left]) lx -= 1; if (keys[k.right]) lx += 1; if (keys[k.up]) ly -= 1; if (keys[k.down]) ly += 1;
    if (g) {
      const ax = g.axes, bt = g.buttons, pr = n => !!(bt[n] && bt[n].pressed);
      const gx = dz(ax[0] || 0), gy = dz(ax[1] || 0);
      if (Math.abs(gx) > Math.abs(lx)) lx = gx; if (Math.abs(gy) > Math.abs(ly)) ly = gy;
      rx = dz(ax[2] || 0); ry = dz(ax[3] || 0);
      if (pr(14)) lx = -1; if (pr(15)) lx = 1; if (pr(12)) ly = -1; if (pr(13)) ly = 1;
      a = a || pr(0); b = b || pr(1); x = x || pr(2) || pr(3); st = st || pr(9);
      if (pr(0) || pr(9)) audio.unlock();
      I.src = 'gamepad';
    } else I.src = 'keyboard';
    Object.assign(I, { lx, ly, rx, ry, a, b, x, start: st, up: ly < -0.5, down: ly > 0.5, left: lx < -0.5, right: lx > 0.5 });
    for (const n in prev) I[n + 'P'] = I[n] && !prev[n];
  }
}
function rumble(i, strong, weak, ms) {
  const g = pads[i];
  try { g && g.vibrationActuator && g.vibrationActuator.playEffect('dual-rumble', { duration: ms, strongMagnitude: strong, weakMagnitude: weak }).catch(() => {}); } catch (e) {}
}
let toast = { t: 0, s: '' };
addEventListener('gamepadconnected', () => { toast = { t: 3, s: '🎮 Controller detected — press Ⓐ on it to join' }; });
addEventListener('gamepaddisconnected', () => { toast = { t: 3, s: 'Controller disconnected' }; });

/* ---------- audio: original chiptune engine ---------- */
function nf(n) { const m = /^([A-G])(#|b)?(\d)$/.exec(n); return 12 * (+m[3] + 1) + { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0); }
const mf = m => 440 * Math.pow(2, (m - 69) / 12);
function chordNotes(c) { const m = /^([A-G])(#|b)?(m?)$/.exec(c); const root = nf(m[1] + (m[2] || '') + '2'); return { root, third: root + (m[3] ? 3 : 4), fifth: root + 7 }; }
function compileSong(d) {
  const bars = d.chords.length, len = bars * 16, ev = [];
  for (let i = 0; i < len; i++) ev.push([]);
  const toks = []; d.lead.forEach(b => b.trim().split(/\s+/).forEach(t => toks.push(t)));
  const n = toks.length;
  for (let i = 0; i < n; i++) {
    const t = toks[i]; if (t === '.' || t === '-') continue;
    let l = 1; while (l < n && toks[(i + l) % n] === '.') l++;
    ev[i * 2].push({ k: 'lead', m: nf(t) + (d.shift || 0), len: l * 2 });
  }
  for (let b = 0; b < bars; b++) {
    const c = chordNotes(d.chords[b]), bp = d.bass;
    for (let s = 0; s < 16; s++) {
      const ch = bp[s]; if (ch === '.') continue;
      let l = 1; while (s + l < 16 && bp[s + l] === '.') l++;
      const m = ch === 'O' ? c.root + 12 : ch === 'F' ? c.fifth : c.root;
      ev[b * 16 + s].push({ k: 'bass', m: m + 12, len: l });
    }
    if (d.arp) { const arr = [c.root + 24, c.third + 24, c.fifth + 24, c.third + 36]; for (let s = 0; s < 16; s++) ev[b * 16 + s].push({ k: 'arp', m: arr[s % 4] }); }
    const dp = d.drums[b % d.drums.length];
    for (let s = 0; s < 16; s++) if (dp[s] !== '.') ev[b * 16 + s].push({ k: dp[s] });
  }
  return { bpm: d.bpm, len, ev, leadVol: d.leadVol || 0.11 };
}
const SONGS = {
  // "Summit Sunrise" — title/menu theme
  title: compileSong({ bpm: 138, shift: -12, chords: ['C', 'Am', 'F', 'G', 'C', 'Am', 'Dm', 'G'],
    lead: ['E5 G5 C6 G5 A5 G5 E5 D5', 'C5 E5 A5 . G5 E5 C5 E5', 'F5 . A5 . C6 . A5 F5', 'G5 . B5 . D6 . B5 G5',
           'E5 G5 C6 . E6 . D6 C6', 'A5 . C6 . E6 . C6 A5', 'D6 . C6 . A5 . F5 .', 'G5 . . . B4 C5 D5 -'],
    bass: 'R.O.R.O.R.O.R.OF', drums: ['k.h.s.h.k.h.s.hh'], arp: true }),
  // "Black Diamond Rush" — downhill race
  race: compileSong({ bpm: 168, chords: ['Am', 'F', 'C', 'G', 'Am', 'F', 'G', 'E'],
    lead: ['A4 . C5 E5 A5 . G5 E5', 'F5 . E5 C5 A4 . C5 .', 'G4 . C5 E5 G5 . E5 C5', 'D5 . B4 G4 B4 . D5 .',
           'A5 . A5 G5 A5 . C6 .', 'A5 . F5 . C5 . F5 .', 'G5 . B5 . D6 . B5 G5', 'G#5 . E5 . B4 . G#4 .'],
    bass: 'R.RRO.RRR.RRO.RO', drums: ['k.hhs.hkk.hhs.hs', 'k.hhs.hkk.hks.ss'], arp: false, leadVol: 0.1 }),
  // "Frostbite Fracas" — snowball fight
  brawl: compileSong({ bpm: 132, shift: -12, chords: ['Em', 'C', 'G', 'D', 'Em', 'C', 'G', 'B'],
    lead: ['E5 - E5 G5 - B5 A5 G5', 'E5 . . . C5 . E5 .', 'D5 - D5 G5 - B5 D6 B5', 'A5 . . . F#5 . A5 .',
           'B5 . G5 . E5 . G5 B5', 'C6 . B5 . A5 . G5 .', 'B5 . A5 . G5 . D5 .', 'D#5 . F#5 . B5 . . .'],
    bass: 'R..OR..OR..OR.O.', drums: ['k..hs.h.k.khs.hh'], arp: true }),
  // "Vert Ramp Vibes" — halfpipe
  // "Snežinke in številke" — calm thinking music for the math break
  math: compileSong({ bpm: 100, chords: ['F', 'Dm', 'Bb', 'C', 'F', 'Dm', 'Bb', 'C'],
    lead: ['A4 . C5 . F5 . E5 .', 'D5 . . . A4 . . .', 'Bb4 . D5 . F5 . G5 F5', 'E5 . . . C5 . . .',
           'F5 . A5 . G5 . F5 .', 'D5 . F5 . A5 . . .', 'G5 . F5 . D5 . Bb4 .', 'C5 . E5 . G5 . . .'],
    bass: 'R...O...R...O...', drums: ['k...h...s...h..h'], arp: true, leadVol: 0.08 }),
  pipe: compileSong({ bpm: 116, chords: ['G', 'Em', 'C', 'D', 'G', 'Em', 'C', 'D'],
    lead: ['B4 . D5 . G5 . . F#5', 'E5 . . . B4 . . .', 'C5 . E5 . G5 . A5 G5', 'F#5 . . . D5 . . .',
           'D5 G5 B5 . A5 G5 D5 .', 'E5 . G5 . B5 . . .', 'A5 . G5 . E5 . C5 .', 'D5 . E5 . F#5 . A5 .'],
    bass: 'R...O...R..RO...', drums: ['k.h.s.h.k.hks.h.'], arp: true, leadVol: 0.1 }),
};
const audio = {
  ctx: null, song: null, songName: null, pending: null, step: 0, nextTime: 0, muted: false,
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
      const c = this.ctx = new AC();
      this.master = c.createGain(); this.master.gain.value = 0.8; this.master.connect(c.destination);
      this.music = c.createGain(); this.music.gain.value = 0.38;
      const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 4200;
      this.music.connect(lp); lp.connect(this.master);
      this.fx = c.createGain(); this.fx.gain.value = 0.55; this.fx.connect(this.master);
      const len = c.sampleRate; this.noise = c.createBuffer(1, len, c.sampleRate);
      const d = this.noise.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      setInterval(() => this.tick(), 25);
      if (this.pending) { const p = this.pending; this.pending = null; this.play(p); }
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  },
  get ok() { return this.ctx && this.ctx.state === 'running'; },
  play(name) {
    if (!this.ctx) { this.pending = name; return; }
    if (this.songName === name) return;
    this.songName = name; this.song = SONGS[name]; this.step = 0; this.nextTime = this.ctx.currentTime + 0.08;
  },
  toggleMute() { this.muted = !this.muted; if (this.master) this.master.gain.value = this.muted ? 0 : 0.8; },
  tick() {
    if (!this.song || !this.ctx) return;
    const sd = 60 / this.song.bpm / 4;
    if (this.nextTime < this.ctx.currentTime - 0.2) this.nextTime = this.ctx.currentTime + 0.02;
    while (this.nextTime < this.ctx.currentTime + 0.12) {
      this.playStep(this.song.ev[this.step], this.nextTime, sd);
      this.nextTime += sd; this.step = (this.step + 1) % this.song.len;
    }
  },
  playStep(evs, t, sd) {
    const M = this.music;
    for (const e of evs) {
      switch (e.k) {
        case 'lead':
          this.tone('square', mf(e.m), t, e.len * sd * 0.92, this.song.leadVol, M, null, true);
          this.tone('square', mf(e.m), t + sd * 3, e.len * sd * 0.8, this.song.leadVol * 0.3, M); // echo
          break;
        case 'bass': this.tone('triangle', mf(e.m), t, e.len * sd * 0.85, 0.42, M); break;
        case 'arp': this.tone('square', mf(e.m), t, sd * 0.55, 0.028, M); break;
        case 'k': this.kick(t, M); break;
        case 's': this.nz(t, 0.14, 0.32, 'highpass', 1400, M); this.tone('triangle', 190, t, 0.07, 0.25, M, 120); break;
        case 'h': this.nz(t, 0.035, 0.12, 'highpass', 7500, M); break;
        case 'o': this.nz(t, 0.16, 0.1, 'highpass', 7000, M); break;
      }
    }
  },
  tone(type, f, t, dur, vol, dest, slide, vib) {
    const c = this.ctx; if (!c) return; t = t || c.currentTime; dest = dest || this.fx;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, slide), t + dur);
    if (vib && dur > 0.25) { const l = c.createOscillator(), lg = c.createGain(); l.frequency.value = 6; lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(f * 0.012, t + dur); l.connect(lg); lg.connect(o.frequency); l.start(t); l.stop(t + dur + 0.05); }
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.006);
    g.gain.setValueAtTime(vol, t + Math.max(0.01, dur - 0.04)); g.gain.linearRampToValueAtTime(0, t + dur);
    o.connect(g); g.connect(dest); o.start(t); o.stop(t + dur + 0.03);
  },
  nz(t, dur, vol, ft, freq, dest) {
    const c = this.ctx; if (!c) return; t = t || c.currentTime; dest = dest || this.fx;
    const s = c.createBufferSource(); s.buffer = this.noise;
    const f = c.createBiquadFilter(); f.type = ft; f.frequency.value = freq;
    const g = c.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f); f.connect(g); g.connect(dest); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
  },
  kick(t, dest) {
    const c = this.ctx, o = c.createOscillator(), g = c.createGain();
    o.frequency.setValueAtTime(160, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.14);
    g.gain.setValueAtTime(0.85, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    o.connect(g); g.connect(dest); o.start(t); o.stop(t + 0.2);
  },
};
const A = audio, now = () => A.ctx ? A.ctx.currentTime : 0;
const sfx = {
  beep() { A.tone('square', 660, 0, 0.16, 0.25); },
  go() { A.tone('square', 1320, 0, 0.45, 0.25); A.tone('square', 660, 0, 0.45, 0.15); },
  select() { const t = now(); A.tone('square', 880, t, 0.06, 0.18); A.tone('square', 1320, t + 0.06, 0.08, 0.18); },
  move() { A.tone('square', 520, 0, 0.04, 0.12); },
  back() { const t = now(); A.tone('square', 660, t, 0.06, 0.16); A.tone('square', 440, t + 0.06, 0.08, 0.16); },
  jump() { A.tone('square', 260, 0, 0.2, 0.16, null, 760); },
  bigair() { A.tone('square', 220, 0, 0.5, 0.16, null, 1200); A.nz(0, 0.6, 0.25, 'bandpass', 1400); },
  fall() { A.tone('sine', 1500, now() + 0.45, 1.0, 0.2, null, 180); },
  poof() { A.nz(0, 0.45, 0.6, 'lowpass', 380); A.tone('triangle', 110, 0, 0.3, 0.3, null, 50); },
  land() { A.nz(0, 0.14, 0.4, 'lowpass', 900); },
  crash() { A.nz(0, 0.55, 0.9, 'lowpass', 1300); A.tone('sawtooth', 220, 0, 0.45, 0.2, null, 45); },
  gate() { const t = now(); A.tone('square', 1046, t, 0.07, 0.15); A.tone('square', 1568, t + 0.07, 0.1, 0.15); },
  miss() { A.tone('sawtooth', 220, 0, 0.32, 0.2, null, 110); },
  throw() { A.nz(0, 0.12, 0.35, 'bandpass', 1800); },
  hit() { A.nz(0, 0.22, 0.9, 'lowpass', 1000); A.tone('square', 520, 0, 0.16, 0.16, null, 200); },
  splat() { A.nz(0, 0.1, 0.3, 'lowpass', 700); },
  crumble() { A.nz(0, 0.5, 0.7, 'lowpass', 500); },
  scoop() { A.tone('triangle', 420, 0, 0.08, 0.3, null, 840); },
  empty() { A.tone('square', 140, 0, 0.09, 0.15); },
  dash() { A.nz(0, 0.18, 0.4, 'bandpass', 900); },
  trick() { const t = now(); [784, 988, 1175, 1568].forEach((f, i) => A.tone('square', f, t + i * 0.06, 0.09, 0.16)); },
  finish() { const t = now(); [523, 659, 784, 1046, 784, 1046].forEach((f, i) => A.tone('square', f, t + i * 0.1, i === 5 ? 0.5 : 0.1, 0.18)); },
  fanfare() { const t = now(); [[523, 0], [523, .12], [523, .24], [659, .36], [784, .6], [659, .84], [784, .96], [1046, 1.2]].forEach(([f, d], i) => { A.tone('square', f, t + d, i === 7 ? 0.8 : 0.11, 0.18); A.tone('triangle', f / 2, t + d, i === 7 ? 0.8 : 0.11, 0.3); }); },
};

/* ---------- particles & popups ---------- */
class Parts {
  constructor() { this.a = []; }
  add(x, y, n, col, spd = 120, life = 0.6, size = 3, g = 0) {
    for (let i = 0; i < n; i++) { const an = Math.random() * 6.283, sp = Math.random() * spd; this.a.push({ x, y, vx: Math.cos(an) * sp, vy: Math.sin(an) * sp, life: life * (0.6 + Math.random() * 0.4), max: life, col, size: size * (0.5 + Math.random()), g }); }
  }
  update(dt) { const f = Math.pow(0.08, dt); for (const p of this.a) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += p.g * dt; p.vx *= f; p.vy *= f; p.life -= dt; } this.a = this.a.filter(p => p.life > 0); }
  draw(ox = 0, oy = 0) { for (const p of this.a) { ctx.globalAlpha = Math.max(0, p.life / p.max); ctx.fillStyle = p.col; ctx.beginPath(); ctx.arc(p.x - ox, p.y - oy, p.size, 0, 6.283); ctx.fill(); } ctx.globalAlpha = 1; }
}
function updPops(arr, dt) { for (let i = arr.length - 1; i >= 0; i--) { arr[i].life -= dt; arr[i].y -= 40 * dt; if (arr[i].life <= 0) arr.splice(i, 1); } }
function drawPops(arr, ox = 0, oy = 0) { for (const p of arr) { ctx.globalAlpha = clamp(p.life * 2, 0, 1); txt(p.t, p.x - ox, p.y - oy, p.size || 20, p.c); } ctx.globalAlpha = 1; }

