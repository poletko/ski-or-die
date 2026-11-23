'use strict';
// MATEMATIČNI ODMOR — math duel (4.–5. razred). Wheels: stick ↕ digit, ↔ move, Ⓐ confirm. Keys: P1 number row, P2 numpad.
const digitQ = [];
addEventListener('keydown', e => {
  let m = /^Digit(\d)$/.exec(e.code); if (m) digitQ.push([0, +m[1]]);
  m = /^Numpad(\d)$/.exec(e.code); if (m) digitQ.push([1, +m[1]]);
});
function makeMathQ() {
  const r = (a, b) => a + Math.floor(Math.random() * (b - a + 1)), pick = a => a[Math.floor(Math.random() * a.length)];
  const kind = pick(['add', 'sub', 'table', 'table', 'mul', 'div', 'word', 'word', 'word', 'units', 'fraction', 'missing']);
  if (kind === 'add') { const a = r(100, 899), b = r(100, 999 - a + 100); return [`${a} + ${b} = ?`, a + b, '']; }
  if (kind === 'sub') { const a = r(300, 1000), b = r(50, a - 1); return [`${a} − ${b} = ?`, a - b, '']; }
  if (kind === 'table') { const a = r(2, 10), b = r(2, 10); return pick([[`${a} · ${b} = ?`, a * b, ''], [`${a * b} : ${b} = ?`, a, '']]); }
  if (kind === 'mul') { const b = r(2, 9), a = r(11, 120); return [`${a} · ${b} = ?`, a * b, '']; }
  if (kind === 'div') { const b = r(2, 9), q = r(11, 99); return pick([[`${q * b} : ${b} = ?`, q, ''], [`${q * b} : □ = ${q}`, b, '']]); }
  if (kind === 'word') {
    const a = r(3, 9), b = r(4, 12), q = r(3, 25), mm = r(5, 30), d = r(5, 25), s = r(80, 130), t = r(5, 30);
    return pick([
      [`${q * a} snežnih kep razdelimo med ${a} otrok. Koliko kep dobi vsak?`, q, ''],
      [`Vozovnica za žičnico stane ${b} €. Koliko stane ${a} vozovnic?`, a * b, '€'],
      [`Sedežnica pelje ${a} smučarjev naenkrat. Koliko jih pripelje v ${b} vožnjah?`, a * b, ''],
      [`Smučar se ${a}-krat spusti po progi, dolgi ${b * 100} m. Koliko metrov prevozi?`, a * b * 100, 'm'],
      [`Skakalec skoči ${s} m, drugi skoči ${t} m dlje. Koliko metrov skoči drugi?`, s + t, 'm'],
      [`Tekma se začne ob 10:${String(mm).padStart(2, '0')} in traja ${d} minut. Ob koliko minut čez 10 se konča?`, mm + d, 'min'],
      [`Na progi je ${q + 10} vratc, vsaka imajo 2 zastavici. Koliko zastavic je to?`, (q + 10) * 2, ''],
      [`Snežak je visok 1 m ${mm + 20} cm. Koliko centimetrov je to?`, 100 + mm + 20, 'cm'],
      [`V koči je ${a * b} rogljičkov, na pladenj jih gre ${b}. Koliko pladnjev napolnimo?`, a, ''],
    ]);
  }
  if (kind === 'units') {
    const a = r(2, 9), b = r(11, 99);
    return pick([
      [`${a} m ${b} cm = ? cm`, a * 100 + b, 'cm'], [`${a * 1000} m = ? km`, a, 'km'], [`${a} km = ? m`, a * 1000, 'm'],
      [`${a} t = ? kg`, a * 1000, 'kg'], [`${a} h = ? min`, a * 60, 'min'], [`${a * 60} s = ? min`, a, 'min'], [`${a} l = ? dl`, a * 10, 'dl'],
    ]);
  }
  if (kind === 'fraction') { const d = r(2, 10), n = d * r(2, 12); return [`Koliko je 1/${d} od ${n}?`, n / d, '']; }
  const a = r(12, 80), b = r(5, 60);
  return pick([[`${a} + □ = ${a + b}`, b, ''], [`□ − ${b} = ${a}`, a + b, '']]);
}
class MathBreak extends EventBase {
  constructor(rounds) {
    super('MATEMATIČNI ODMOR', 'math', [
      'Oba dobita isti račun. Kdor prvi pravilno odgovori, dobi točko!',
      'Palica ↕: spremeni števko    Palica ↔: premik    Ⓐ: potrdi',
      'Tipkovnica: P1 vtipka s številkami zgoraj, P2 s številčnico. Napačen odgovor = kratka kazen, 3 poskusi.']);
    this.rounds = rounds; this.round = 0; this.limit = 45; this.score = [0, 0];
    this.pl = [0, 1].map(() => ({ hold: {} }));
    this.newQ();
  }
  newQ() {
    [this.q, this.ans, this.unit] = makeMathQ();
    this.nd = Math.max(2, String(this.ans).length + 1);
    this.qt = 0; this.state = 'ask'; this.revealT = 0; this.winnerR = -1;
    for (const p of this.pl) Object.assign(p, { digits: new Array(this.nd).fill(0), cursor: this.nd - 1, tries: 0, lock: 0, shake: 0, msg: '', msgCol: INK, out: false });
  }
  rep(i, d, dt) {
    const p = this.pl[i], on = inp[i][d], h = p.hold[d] || 0;
    if (!on) { p.hold[d] = 0; return false; }
    p.hold[d] = h + dt;
    return h === 0 || (h + dt > 0.35 && Math.floor((h + dt - 0.35) / 0.08) !== Math.floor((h - 0.35) / 0.08));
  }
  play(dt) {
    if (this.phase === 'done') return;
    if (this.state === 'reveal') {
      this.revealT -= dt;
      if (this.revealT <= 0) { this.round++; if (this.round >= this.rounds) { this.doneText = 'KONEC!'; this.end(); } else this.newQ(); }
      digitQ.length = 0; return;
    }
    if (this.qt === 0) digitQ.length = 0;
    this.qt += dt;
    for (const [i, d] of digitQ.splice(0)) { const p = this.pl[i]; if (!p.out && p.lock <= 0) { p.digits = [...p.digits.slice(1), d]; sfx.move(); } }
    for (let i = 0; i < 2; i++) {
      const p = this.pl[i];
      p.shake = Math.max(0, p.shake - dt); p.lock -= dt;
      if (p.out || p.lock > 0) continue;
      if (this.rep(i, 'left', dt)) { p.cursor = (p.cursor + this.nd - 1) % this.nd; sfx.move(); }
      if (this.rep(i, 'right', dt)) { p.cursor = (p.cursor + 1) % this.nd; sfx.move(); }
      if (this.rep(i, 'up', dt)) { p.digits[p.cursor] = (p.digits[p.cursor] + 1) % 10; sfx.move(); }
      if (this.rep(i, 'down', dt)) { p.digits[p.cursor] = (p.digits[p.cursor] + 9) % 10; sfx.move(); }
      if (inp[i].aP) this.check(i);
      if (this.state !== 'ask') return;
    }
    if (this.pl.every(p => p.out) || this.qt >= this.limit) this.reveal(-1, this.qt >= this.limit ? 'Čas je potekel!' : 'Nihče ni uganil.');
  }
  check(i) {
    const p = this.pl[i];
    if (+p.digits.join('') === this.ans) {
      this.score[i]++; p.msg = 'PRAVILNO! +1'; p.msgCol = '#3f8f3a'; sfx.trick(); rumble(i, 0.4, 0.6, 200);
      this.pl[1 - i].msg = PN[i] + ' je bil hitrejši!'; this.pl[1 - i].msgCol = PAL.wood2;
      this.reveal(i, '');
    } else {
      p.tries++; p.shake = 0.4; p.lock = 1.0; sfx.miss(); rumble(i, 0.6, 0.2, 150);
      if (p.tries >= 3) { p.out = true; p.msg = 'Ni več poskusov'; } else p.msg = `Ni še prav – še ${3 - p.tries}×`;
      p.msgCol = PAL.red;
    }
  }
  reveal(w, why) {
    this.state = 'reveal'; this.winnerR = w; this.revealT = w >= 0 ? 2.2 : 3.2; this.why = why;
    if (w < 0) sfx.back();
  }
  result() {
    const s = this.score;
    return { winner: s[0] > s[1] ? 0 : s[1] > s[0] ? 1 : -1, lines: s.map(x => x + ' / ' + this.rounds + ' pravilnih'), sub: null };
  }
  draw() {
    drawScenery(); drawFlakes();
    const t = this.rt;
    card(W / 2 - 200, 8, 400, 64, PAL.paper, 1400, 12);
    ttxt('MATEMATIČNI ODMOR', W / 2, 32, 28, PAL.yellow);
    txt(`Račun ${Math.min(this.round + 1, this.rounds)} / ${this.rounds}`, W / 2, 58, 15, PAL.wood2, 'center', false);
    for (let i = 0; i < 2; i++) { hudTag(i ? W - 130 : 20, 14, 110, 52, 1401 + i); ttxt(PN[i], (i ? W - 75 : 75) - 22, 41, 22, PC[i]); ttxt(String(this.score[i]), (i ? W - 75 : 75) + 26, 41, 30, PAL.yellow); }
    // question on a paper card, with a timer drawn as a melting icicle bar
    card(70, 84, 820, 150, PAL.white, 1410, 16);
    const tf = clamp(1 - this.qt / this.limit, 0, 1);
    inkPoly([100, 210, 860, 210, 860, 222, 100, 222], PAL.snow2, 2, 0.4, 1411);
    if (tf > 0) inkPoly([100, 210, 100 + 760 * tf, 210, 100 + 760 * tf, 222, 100, 222], tf > 0.3 ? PAL.green : PAL.red, 2, 0.4, 1412);
    ctx.font = `700 30px ${FONT}`;
    const words = this.q.split(' '), lines = []; let line = '';
    for (const w of words) { const tt = line ? line + ' ' + w : w; if (ctx.measureText(tt).width > 740 && line) { lines.push(line); line = w; } else line = tt; }
    lines.push(line);
    lines.forEach((l, k) => txt(l, W / 2, 148 + k * 38 - (lines.length - 1) * 19, 30, INK, 'center', false));
    for (let i = 0; i < 2; i++) {
      const p = this.pl[i], x0 = i ? 500 : 40, cx = x0 + 210;
      card(x0, 248, 420, 236, PAL.paper, 1420 + i * 30, 16);
      inkLine([x0 + 12, 254, x0 + 408, 254], 5, PC[i], 1, 1421 + i);
      drawKid({ x: x0 + 46, y: 330, fx: 0.7, fy: 0.5, charging: false, charge: 0, walk: 0, inv: 0, stun: p.lock > 0 ? 0.3 : 0, scoop: 0 }, i, t);
      ttxt(PN[i], x0 + 46, 352, 18, PC[i]);
      if (p.tries && !p.out) txt('✗'.repeat(p.tries), x0 + 400, 276, 18, PAL.red, 'right', false);
      const bw = 50, gap = 10, total = this.nd * bw + (this.nd - 1) * gap;
      const sx = cx + 24 - total / 2 + (p.shake > 0 ? Math.sin(p.shake * 60) * 8 : 0), by = 300;
      ctx.globalAlpha = p.out || p.lock > 0 ? 0.5 : 1;
      for (let k = 0; k < this.nd; k++) {
        const bx = sx + k * (bw + gap), sel = k === p.cursor && this.state === 'ask' && !p.out;
        card(bx, by, bw, 68, sel ? '#fff1b8' : PAL.white, 1440 + k + i * 10, 9);
        txt(String(p.digits[k]), bx + bw / 2, by + 36, 40, INK, 'center', false);
        if (sel) { const b = Math.sin(t * 8) * 2; inkPoly([bx + bw / 2 - 10, by - 6 - b, bx + bw / 2 + 10, by - 6 - b, bx + bw / 2, by - 20 - b], PAL.yellow, 2.2, 0.4, 1460); inkPoly([bx + bw / 2 - 10, by + 76 + b, bx + bw / 2 + 10, by + 76 + b, bx + bw / 2, by + 90 + b], PAL.yellow, 2.2, 0.4, 1461); }
      }
      if (this.unit) txt(this.unit, sx + total + 10, by + 36, 22, INK, 'left', false);
      ctx.globalAlpha = 1;
      if (p.msg) txt(p.msg, cx, 440, 20, p.msgCol, 'center', false);
      else if (this.state === 'ask') txt('Ⓐ potrdi', cx, 440, 15, PAL.wood2, 'center', false);
    }
    if (this.state === 'reveal') {
      ctx.save(); ctx.translate(W / 2, 506); ctx.rotate(-0.01);
      card(-250, -22, 500, 44, PAL.yellow, 1470, 12);
      txt((this.why ? this.why + ' ' : '') + `Rešitev: ${this.ans}${this.unit ? ' ' + this.unit : ''}`, 0, 1, 20, INK, 'center', false);
      ctx.restore();
    }
    this.drawOverlay();
  }
}
