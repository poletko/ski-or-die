'use strict';
// Scene framework, menus, shared event lifecycle (ready → countdown → play → done), results.
let scene = null;
function setScene(s) { scene = s; s.enter && s.enter(); }
const game = { mode: 'single', queue: [], idx: 0, score: [0, 0], last: null };
const EVENTS = { downhill: () => new Downhill(), brawl: () => new Brawl(), pipe: () => new Halfpipe(), math: () => new MathBreak(game.mode === 'tour' ? 3 : 5) };
const EVENT_NAMES = { downhill: 'Downhill Dash', brawl: 'Snowball Brawl', pipe: 'Halfpipe Jam', math: 'Matematični odmor' };

function drawStatus() {
  for (let i = 0; i < 2; i++) {
    const s = inp[i].src === 'gamepad' ? '🎮 Controller' : '⌨ Keyboard (or press Ⓐ on a pad)';
    txt(PN[i] + ': ' + s, i ? W - 16 : 16, H - 16, 14, PC[i], i ? 'right' : 'left');
  }
  if (!audio.ok) txt('🔇 press any key or click for sound', W / 2, H - 16, 13, PAL.yellow);
  drawToast();
}
function drawToast() { if (toast.t > 0) { ctx.globalAlpha = clamp(toast.t, 0, 1); txt(toast.s, W / 2, 22, 16, PAL.white); ctx.globalAlpha = 1; } }
function wrap(s, x, y, maxW, lh, size, col, outline = false) {
  ctx.font = `700 ${size}px ${FONT}`; const words = s.split(' '); let line = '', yy = y;
  for (const w of words) { const t = line ? line + ' ' + w : w; if (ctx.measureText(t).width > maxW && line) { txt(line, x, yy, size, col, 'center', outline); line = w; yy += lh; } else line = t; }
  if (line) txt(line, x, yy, size, col, 'center', outline);
}
function logo(x, y, size, t) {
  const word = 'POWDER PANIC';
  ctx.font = `${size}px ${FONT_T}`; const total = ctx.measureText(word).width;
  let cx = x - total / 2;
  for (let k = 0; k < word.length; k++) {
    const ch = word[k], w = ctx.measureText(ch).width, bob = Math.sin(t * 3 + k * 0.6) * 4;
    ctx.save(); ctx.translate(cx + w / 2, y + bob); ctx.rotate(Math.sin(k * 1.7) * 0.06);
    txt(ch, 0, 4, size, INK, 'center', true, FONT_T);
    txt(ch, 0, 0, size, k < 6 ? '#bfe6ff' : '#ffd84a', 'center', true, FONT_T);
    ctx.restore(); cx += w;
  }
}

class TitleScene {
  constructor() { this.t = 0; }
  enter() { audio.play('title'); }
  update(dt) { this.t += dt; updFlakes(dt); if (toast.t > 0) toast.t -= dt; if (inp[0].aP || inp[1].aP || inp[0].startP || inp[1].startP) { sfx.select(); setScene(new MenuScene()); } }
  draw() {
    drawScenery(); drawFlakes();
    logo(W / 2, 175, 92, this.t);
    card(W / 2 - 200, 232, 400, 44, PAL.paper, 31);
    txt('2-PLAYER WINTER GAMES', W / 2, 254, 24, PAL.red, 'center', false, FONT_T);
    // mascots
    drawSkier(220, 430, Math.abs(Math.sin(this.t * 2.5)) * 22, Math.sin(this.t * 1.5) * 0.7, 0, { t: this.t });
    drawKid({ x: 740, y: 440, fx: -1, fy: 0.3, charging: true, charge: (this.t * 0.8) % 1, walk: 0, inv: 0, stun: 0, scoop: 0 }, 1, this.t);
    if (Math.floor(this.t * 2) % 2 === 0) { card(W / 2 - 190, 330, 380, 54, PAL.yellow, 41); txt('PRESS  Ⓐ  /  SPACE', W / 2, 358, 26, INK, 'center', false, FONT_T); }
    drawStatus();
  }
}

class MenuScene {
  constructor() {
    this.sel = 0; this.t = 0;
    this.opts = [
      { k: 'tour', n: 'Tournament', d: 'All three events with a Matematični odmor between each. 3 points per win — most points takes the gold.' },
      { k: 'downhill', n: 'Downhill Dash', d: 'Split-screen race down a mountain. Hit the gates, dodge trees, launch off ramps.' },
      { k: 'brawl', n: 'Snowball Brawl', d: 'Arena snowball fight. Charge throws, dodge, scoop ammo and smash snow forts.' },
      { k: 'pipe', n: 'Halfpipe Jam', d: 'Ride the tube all the way down! Pump for height, flip and grab — land clean for big points.' },
      { k: 'math', n: 'Matematični odmor', d: 'Računski dvoboj: oba dobita isti račun, kdor prvi pravilno odgovori, dobi točko. 5 računov.' },
      { k: 'controls', n: 'Controls', d: 'Xbox controller and keyboard layout.' },
    ];
  }
  enter() { audio.play('title'); game.score = [0, 0]; }
  update(dt) {
    this.t += dt; updFlakes(dt); if (toast.t > 0) toast.t -= dt;
    for (const I of inp) {
      if (I.upP) { this.sel = (this.sel + this.opts.length - 1) % this.opts.length; sfx.move(); }
      if (I.downP) { this.sel = (this.sel + 1) % this.opts.length; sfx.move(); }
      if (I.bP) { sfx.back(); setScene(new TitleScene()); return; }
      if (I.aP || I.startP) {
        sfx.select(); const k = this.opts[this.sel].k;
        if (k === 'controls') setScene(new ControlsScene());
        else if (k === 'tour') { game.mode = 'tour'; game.queue = ['downhill', 'math', 'brawl', 'math', 'pipe']; game.idx = 0; game.score = [0, 0]; setScene(EVENTS.downhill()); }
        else { game.mode = 'single'; game.last = k; setScene(EVENTS[k]()); }
        return;
      }
    }
  }
  draw() {
    drawScenery(); drawFlakes();
    logo(W / 2, 52, 50, this.t);
    this.opts.forEach((o, i) => {
      const y = 128 + i * 54, s = i === this.sel, wob = s ? Math.sin(this.t * 6) * 3 : 0;
      ctx.save(); ctx.translate(285 + wob, y); if (s) ctx.rotate(Math.sin(this.t * 4) * 0.015);
      card(-160, -21, 320, 42, s ? PAL.yellow : PAL.paper, 100 + i * 7, 12);
      txt(o.n, 0, 1, 22, INK, 'center', false);
      ctx.restore();
      if (s) { const ax = 108 + Math.sin(this.t * 8) * 4; inkPoly([ax, y - 10, ax + 14, y, ax, y + 10], PAL.red, 2.4, 0.4, 150); }
    });
    card(490, 104, 380, 330, PAL.paper, 160);
    const o = this.opts[this.sel];
    txt(o.n, 680, 140, 30, PAL.red, 'center', true, FONT_T);
    wrap(o.d, 680, 186, 330, 24, 17, INK);
    drawMenuIcon(o.k, 680, 350, this.t);
    card(W / 2 - 240, 452, 480, 34, PAL.paper2, 170, 10);
    txt('Stick / D-pad: choose     Ⓐ: select     Ⓑ: back', W / 2, 469, 15, INK, 'center', false);
    drawStatus();
  }
}
function drawMenuIcon(k, x, y, t) {
  ctx.save(); ctx.translate(x, y);
  if (k === 'downhill' || k === 'tour') { drawTree(-110, 40, 0.4, 11); drawTree(110, 20, 0.2, 12); drawFlag(-50, 46, PAL.red, false, t, 13); drawFlag(50, 46, PAL.red, false, t, 14); drawSkier(Math.sin(t * 2) * 34, 30, 0, Math.cos(t * 2) * 0.7, 0, { t }); }
  if (k === 'brawl') {
    drawKid({ x: -80, y: 50, fx: 1, fy: 0.2, charging: true, charge: t % 1, walk: 0, inv: 0, stun: 0, scoop: 0 }, 0, t);
    drawKid({ x: 80, y: 50, fx: -1, fy: 0.2, charging: false, charge: 0, walk: t * 8, inv: 0, stun: 0, scoop: 0 }, 1, t);
    const u = (t * 1.2) % 1; inkEllipse(-60 + u * 120, 0 - Math.sin(u * Math.PI) * 30, 6, 6, PAL.white, 2, 17);
  }
  if (k === 'pipe') {
    blobPoly([-150, -10, -110, 50, -40, 64, 40, 64, 110, 50, 150, -10, 150, 70, -150, 70], PAL.snow, 3, 0.8, 18);
    ctx.save(); ctx.translate(Math.sin(t * 1.4) * 70, 20 - Math.abs(Math.cos(t * 1.4)) * 70); ctx.rotate(t * 3); ctx.scale(0.9, 0.9); drawBoarder(1, { t }); ctx.restore();
  }
  if (k === 'math') {
    txt('7 · 8 = ?', 0, -20, 38, PAL.yellow, 'center', true, FONT_T);
    [0, 1].forEach(i => { card(-62 + i * 66, 14, 54, 58, PAL.white, 19 + i, 8); txt(String((Math.floor(t * 2) + i * 3) % 10), -35 + i * 66, 44, 32, INK, 'center', false); });
  }
  if (k === 'controls') drawPad(0, 10, 1.3);
  ctx.restore();
}
class ControlsScene {
  update(dt) { updFlakes(dt); if (inp[0].aP || inp[0].bP || inp[1].aP || inp[1].bP) { sfx.back(); setScene(new MenuScene()); } }
  draw() {
    drawScenery(); drawFlakes(); card(50, 30, 860, 470, PAL.paper, 200);
    ttxt('CONTROLS', W / 2, 72, 40, PAL.red);
    txt('Press Ⓐ on a controller to claim it: first = P1, second = P2. Keyboard always works too.', W / 2, 112, 15, INK, 'center', false);
    const rows = [
      ['', '🎮 Controller', '⌨ P1 keys', '⌨ P2 keys'],
      ['Move / steer', 'Left stick / D-pad', 'W A S D', 'Arrow keys'],
      ['Tuck / throw / grab / pump', 'Ⓐ', 'Space', 'Enter'],
      ['Jump / dash', 'Ⓑ', 'Left Shift', 'Right Shift'],
      ['Scoop snow (Brawl)', 'Ⓧ or Ⓨ', 'E', 'Right Ctrl'],
      ['Aim (Brawl)', 'Right stick', '(move dir.)', '(move dir.)'],
      ['Numbers (Math)', 'stick ↕ ↔', 'number row', 'numpad'],
      ['Pause', 'Start ☰', 'Esc', 'P'],
    ];
    rows.forEach((r, i) => { const y = 158 + i * 38; if (i % 2 === 1) { ctx.fillStyle = 'rgba(34,28,46,.06)'; ctx.fillRect(80, y - 17, 800, 34); } [200, 430, 610, 780].forEach((x, j) => txt(r[j], x, y, i === 0 ? 18 : 16, i === 0 ? PAL.red : INK, 'center', false)); });
    txt('M: mute sound      Ⓐ / Ⓑ: back', W / 2, 470, 16, INK, 'center', false);
  }
}
addEventListener('keydown', e => { if (e.code === 'KeyM') audio.toggleMute(); });

/* ---------- shared event lifecycle ---------- */
class EventBase {
  constructor(name, song, help) { this.name = name; this.song = song; this.help = help; this.phase = 'ready'; this.ready = [false, false]; this.cd = 3; this.t = 0; this.doneT = 0; this.paused = false; this.goT = 0; this.rt = 0; }
  enter() { audio.play(this.song); }
  update(dt) {
    this.rt += dt; if (toast.t > 0) toast.t -= dt;
    if (this.phase === 'play' && (inp[0].startP || inp[1].startP)) { this.paused = !this.paused; sfx.select(); return; }
    if (this.paused) { if (inp[0].bP || inp[1].bP) { this.paused = false; sfx.back(); setScene(new MenuScene()); } return; }
    if (this.phase === 'ready') {
      for (let i = 0; i < 2; i++) if ((inp[i].aP || inp[i].startP) && !this.ready[i]) { this.ready[i] = true; sfx.select(); }
      if (inp[0].bP || inp[1].bP) { sfx.back(); setScene(new MenuScene()); return; }
      if (this.ready[0] && this.ready[1]) { this.phase = 'countdown'; this.cd = 3; sfx.beep(); }
      this.idle && this.idle(dt); return;
    }
    if (this.phase === 'countdown') {
      const p = Math.ceil(this.cd); this.cd -= dt; const n = Math.ceil(this.cd);
      if (n !== p) { if (n > 0) sfx.beep(); else sfx.go(); }
      if (this.cd <= 0) { this.phase = 'play'; this.goT = 0.8; }
      this.idle && this.idle(dt); return;
    }
    if (this.phase === 'play') { this.t += dt; if (this.goT > 0) this.goT -= dt; this.play(dt); return; }
    if (this.phase === 'done') { this.doneT += dt; this.play(dt); if (this.doneT > 2.6) finishEvent(this.result(), this); }
  }
  end() { if (this.phase !== 'done') { this.phase = 'done'; this.doneT = 0; sfx.finish(); } }
  drawOverlay() {
    if (this.phase === 'ready') {
      ctx.fillStyle = 'rgba(34,28,46,.45)'; ctx.fillRect(0, 0, W, H);
      card(100, 70, 760, 400, PAL.paper, 210);
      if (game.mode === 'tour') txt(`TOURNAMENT — ROUND ${game.idx + 1} / ${game.queue.length}`, W / 2, 100, 15, PAL.wood2, 'center', false);
      ttxt(this.name, W / 2, 138, 42, PAL.yellow);
      this.help.forEach((h, i) => wrap(h, W / 2, 198 + i * 50, 680, 22, 17, INK));
      for (let i = 0; i < 2; i++) {
        const x = i ? 660 : 300, y = 378, r = this.ready[i];
        ctx.save(); ctx.translate(x, y); if (r) ctx.rotate(Math.sin(this.rt * 8) * 0.03);
        card(-120, -26, 240, 52, r ? PC[i] : PAL.white, 220 + i * 9, 12);
        if (r) txt(PN[i] + '  READY!', 0, 1, 22, PAL.white, 'center', true);
        else if (Math.floor(this.rt * 3) % 2 === 0) txt(PN[i] + ': press Ⓐ', 0, 1, 20, PC[i], 'center', true);
        ctx.restore();
      }
      txt('Ⓑ: back to menu', W / 2, 444, 13, PAL.wood2, 'center', false);
    }
    if (this.phase === 'countdown') { const n = Math.ceil(this.cd), f = this.cd - Math.floor(this.cd); ctx.save(); ctx.translate(W / 2, H / 2); ctx.rotate((f - 0.5) * 0.3); ttxt(String(n), 0, 0, 90 + f * 70, PAL.yellow); ctx.restore(); }
    if (this.phase === 'play' && this.goT > 0) { ctx.globalAlpha = clamp(this.goT / 0.4, 0, 1); ttxt('GO!', W / 2, H / 2, 110 + (0.8 - this.goT) * 90, PAL.green); ctx.globalAlpha = 1; }
    if (this.phase === 'done') { const s = Math.min(1, this.doneT * 3); ctx.save(); ctx.translate(W / 2, H / 2); ctx.rotate(-0.05); ctx.scale(s, s); ttxt(this.doneText || 'FINISH!', 0, 0, 80, PAL.yellow); ctx.restore(); }
    if (this.paused) { ctx.fillStyle = 'rgba(34,28,46,.5)'; ctx.fillRect(0, 0, W, H); card(290, 170, 380, 190, PAL.paper, 230); ttxt('PAUSED', W / 2, 230, 48, PAL.red); txt('Start: resume     Ⓑ: quit to menu', W / 2, 305, 17, INK, 'center', false); }
    if (toast.t > 0) { ctx.globalAlpha = clamp(toast.t, 0, 1); txt(toast.s, W / 2, H - 20, 15, PAL.white); ctx.globalAlpha = 1; }
  }
}
// small paper HUD tag
function hudTag(x, y, w, h, seed) { card(x, y, w, h, PAL.paper, seed, 10); }

function finishEvent(res, ev) {
  if (game.mode === 'tour') { if (res.winner >= 0) game.score[res.winner] += 3; else { game.score[0] += 1; game.score[1] += 1; } }
  setScene(new ResultScene(res, ev.name));
}
const CONFETTI = ['#ffd84a', '#e8553f', '#3f8fe0', '#78c264', '#ffffff', '#ff9a3c'];
class ResultScene {
  constructor(res, name) { this.res = res; this.name = name; this.t = 0; this.parts = new Parts(); }
  enter() { audio.play('title'); sfx.fanfare(); if (this.res.winner >= 0) rumble(this.res.winner, 0.5, 0.5, 400); }
  update(dt) {
    this.t += dt; updFlakes(dt); this.parts.update(dt);
    if (this.res.winner >= 0 && Math.random() < 0.5) this.parts.add(rand(100, 860), -10, 1, CONFETTI[Math.floor(Math.random() * CONFETTI.length)], 40, 3, 4, 120);
    if (this.t < 0.6) return;
    const a = inp[0].aP || inp[1].aP || inp[0].startP || inp[1].startP, b = inp[0].bP || inp[1].bP;
    if (a) {
      sfx.select();
      if (game.mode === 'tour') { game.idx++; if (game.idx < game.queue.length) setScene(EVENTS[game.queue[game.idx]]()); else setScene(new FinalScene()); }
      else setScene(EVENTS[game.last]());
    } else if (b) { sfx.back(); setScene(new MenuScene()); }
  }
  draw() {
    drawScenery(); drawFlakes(); this.parts.draw();
    card(120, 40, 720, 440, PAL.paper, 240);
    txt(this.name + ' — RESULTS', W / 2, 78, 22, PAL.wood2, 'center', false);
    const w = this.res.winner;
    ctx.save(); ctx.translate(W / 2, 140); ctx.rotate(Math.sin(this.t * 3) * 0.03);
    ttxt(w >= 0 ? PN[w] + ' WINS!' : "IT'S A TIE!", 0, 0, 62, w >= 0 ? PC[w] : PAL.yellow); ctx.restore();
    for (let i = 0; i < 2; i++) {
      const x = i ? 640 : 320, happy = w < 0 || w === i;
      drawKid({ x: x + (i ? 70 : -70), y: 300 - (happy ? Math.abs(Math.sin(this.t * 6 + i)) * 14 : 0), fx: i ? -0.6 : 0.6, fy: 0.6, charging: false, charge: 0, walk: 0, inv: 0, stun: happy ? 0 : 0.5, scoop: 0 }, i, this.t);
      ttxt(PN[i], x - (i ? 30 : -30), 222, 30, PC[i]);
      txt(this.res.lines[i], x - (i ? 30 : -30), 262, 22, INK, 'center', false);
      if (this.res.sub) txt(this.res.sub[i], x - (i ? 30 : -30), 292, 14, PAL.wood2, 'center', false);
    }
    if (game.mode === 'tour') {
      txt('TOURNAMENT POINTS', W / 2, 352, 18, PAL.red, 'center', false, FONT_T);
      ttxt(`${game.score[0]}`, W / 2 - 60, 392, 38, PC[0]); txt('–', W / 2, 392, 30, INK, 'center', false); ttxt(`${game.score[1]}`, W / 2 + 60, 392, 38, PC[1]);
      txt(game.idx + 1 < game.queue.length ? `Ⓐ: next (${EVENT_NAMES[game.queue[game.idx + 1]]})    Ⓑ: menu` : 'Ⓐ: final standings    Ⓑ: menu', W / 2, 444, 16, INK, 'center', false);
    } else txt('Ⓐ: rematch     Ⓑ: menu', W / 2, 430, 18, INK, 'center', false);
  }
}
class FinalScene {
  constructor() { this.t = 0; this.parts = new Parts(); const s = game.score; this.w = s[0] > s[1] ? 0 : s[1] > s[0] ? 1 : -1; }
  enter() { audio.play('title'); sfx.fanfare(); }
  update(dt) {
    this.t += dt; updFlakes(dt); this.parts.update(dt);
    if (Math.random() < 0.8) this.parts.add(rand(0, W), -10, 1, CONFETTI[Math.floor(Math.random() * CONFETTI.length)], 50, 4, 4, 100);
    if (this.t > 1 && (inp[0].aP || inp[1].aP || inp[0].bP || inp[1].bP)) { sfx.select(); setScene(new MenuScene()); }
  }
  draw() {
    drawScenery(); this.parts.draw(); drawFlakes();
    card(W / 2 - 230, 40, 460, 60, PAL.paper, 250);
    ttxt('TOURNAMENT CHAMPION', W / 2, 72, 32, PAL.red);
    ctx.save(); ctx.translate(W / 2, 170); ctx.rotate(Math.sin(this.t * 2) * 0.04);
    ttxt(this.w >= 0 ? PN[this.w] + '!' : 'SHARED GOLD!', 0, 0, 100 + Math.sin(this.t * 4) * 6, this.w >= 0 ? PC[this.w] : PAL.yellow); ctx.restore();
    ttxt(`${game.score[0]}  –  ${game.score[1]}`, W / 2, 250, 34, PAL.white);
    inkPoly([400, 330, 560, 330, 560, 450, 400, 450], PAL.yellow, 3.5, 1, 251); inkPoly([560, 370, 700, 370, 700, 450, 560, 450], '#d5dbe6', 3.5, 1, 252);
    ttxt('1', 480, 395, 50, PAL.white); ttxt('2', 630, 412, 40, PAL.white);
    const win = this.w >= 0 ? this.w : 0;
    drawKid({ x: 480, y: 330 - Math.abs(Math.sin(this.t * 5)) * 18, fx: 0, fy: 1, charging: false, charge: 0, walk: 0, inv: 0, stun: 0, scoop: 0 }, win, this.t);
    drawKid({ x: 630, y: 370, fx: 0, fy: 1, charging: false, charge: 0, walk: 0, inv: 0, stun: this.w >= 0 ? 0.3 : 0, scoop: 0 }, this.w >= 0 ? 1 - win : 1, this.t);
    txt('Ⓐ: back to menu', W / 2, 500, 18, INK, 'center', false);
  }
}
