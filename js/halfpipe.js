'use strict';
// EVENT 3 — HALFPIPE JAM: both riders travel down a long tube (≈60 s). Top view = P1, bottom = P2.
// The middle strip animates both riders flowing down the tube; each view has a tube map in its corner.
const HP = { F: 100, R: 200, G: 650, L: 3600, PROG: 40, FIN_BONUS: 1000 };   // flat half-width, wall radius, gravity, tube length, base descent speed, bonus for finishing first
HP.SM = HP.F + Math.PI * HP.R / 2;
const VIEW_H = 230, BAND_Y = 230, BAND_H = 80, VIEW2_Y = 310;
function pipePos(s) {
  const as = Math.abs(s), sg = Math.sign(s) || 1;
  if (as <= HP.F) return { x: s, y: 0, a: 0, sg };
  const a = Math.min((as - HP.F) / HP.R, Math.PI / 2);
  return { x: sg * (HP.F + HP.R * Math.sin(a)), y: HP.R * (1 - Math.cos(a)), a, sg };
}
const GRABS = { n: 'Indy Grab', u: 'Method Grab', d: 'Stalefish', l: 'Melon Grab', r: 'Nosegrab' };
class Halfpipe extends EventBase {
  constructor() {
    super('HALFPIPE JAM', 'pipe', [
      'Ride the tube to the bottom! More speed = you flow down faster. First one down gets +1000 bonus.',
      'Hold Ⓐ (or stick down) while riding DOWN a wall to pump — it builds speed fast.',
      'In the air: stick ←/→ = flip, hold Ⓐ = grab. Land roughly feet-first and it counts!']);
    this.rd = [0, 1].map(() => ({ s: -HP.SM + 2, v: 0, air: false, ay: 0, vy: 0, side: -1, rot: 0, rv: 0, grab: false, grabT: 0, grabName: '', maxH: 0, crash: 0, score: 0, trick: '', trickT: 0, cam: 0, last: '', pump: false, best: 0, prog: 0, fin: false, trail: [], trT: 0, spd: 0 }));
    this.finished = 0;
    this.parts = [new Parts(), new Parts()];
  }
  latX(r) { return r.air ? r.side * (HP.F + HP.R) : pipePos(r.s).x; }
  play(dt) {
    for (let i = 0; i < 2; i++) this.upd(i, dt);
    this.parts.forEach(p => p.update(dt));
    if (this.phase === 'play' && ((this.rd.every(r => r.fin) && this.rd.every(r => !r.air)) || this.t > 90)) { this.doneText = 'FINISH!'; this.end(); }
  }
  upd(i, dt) {
    const r = this.rd[i], I = inp[i], g = HP.G, active = this.phase === 'play' && !r.fin;
    if (r.trickT > 0) r.trickT -= dt; if (r.crash > 0) r.crash -= dt;
    if (active) {
      if (!r.air) r.spd = Math.abs(r.v);                     // momentum carries you down the tube too
      r.prog += (HP.PROG + Math.min(r.spd, 1000) * 0.05) * dt;
      if (r.prog >= HP.L) {
        r.prog = HP.L; r.fin = true; this.finished++; sfx.finish(); rumble(i, 0.5, 0.5, 300);
        if (this.finished === 1) { r.score += HP.FIN_BONUS; r.trick = 'FIRST DOWN!  +' + HP.FIN_BONUS; } else r.trick = 'FINISH!';
        r.trickT = 3;
      }
    }
    r.trT -= dt; if (r.trT <= 0 && this.phase === 'play') { r.trT = 0.12; r.trail.push(r.prog, this.latX(r)); if (r.trail.length > 120) r.trail.splice(0, 2); }
    const camT = r.air ? Math.max(0, r.ay * 0.5 - 60) : 0; r.cam = lerp(r.cam, camT, 1 - Math.pow(0.0004, dt));
    if (r.air) r.cam = Math.max(r.cam, r.ay * 0.5 - 72);   // never let a fast launch leave the view
    if (!r.air) {
      const P = pipePos(r.s); let acc = -g * Math.sin(P.a) * P.sg;
      const down = r.v * P.sg < 0 && P.a > 0.03;               // moving toward the bottom of the pipe
      r.pump = active && r.crash <= 0 && (I.a || I.ly > 0.5);
      if (down && r.crash <= 0 && active) acc += (r.pump ? 720 : 140) * Math.sign(r.v);   // pump (with a little auto-assist)
      acc -= r.v * (r.crash > 0 ? 0.6 : 0.025);
      r.v += acc * dt; r.s += r.v * dt;
      if (Math.abs(r.s) >= HP.SM) {
        const sg = Math.sign(r.s); r.s = sg * HP.SM;
        if (r.v * sg > 0) {
          if (Math.abs(r.v) > 60 && r.crash <= 0 && active) { Object.assign(r, { air: true, side: sg, vy: Math.min(Math.abs(r.v), 1150), ay: 0, rot: 0, rv: 0, grabT: 0, maxH: 0, grab: false, grabName: '', v: 0 }); }
          else r.v = -r.v * 0.3;
        }
      }
      if (Math.abs(r.v) > 300 && Math.random() < 0.35) { const Q = pipePos(r.s); this.parts[i].add(Q.x, Q.y, 1, PAL.white, 50, 0.4, 2.5); }
    } else {
      r.vy -= g * dt; r.ay += r.vy * dt; r.maxH = Math.max(r.maxH, r.ay);
      if (this.phase === 'play') {
        r.rv += (I.lx * 10 - r.rv) * Math.min(1, 14 * dt);
        if (I.a && !r.grab) r.grabName = GRABS[I.ly < -0.5 ? 'u' : I.ly > 0.5 ? 'd' : Math.abs(I.lx) > 0.5 ? (I.lx * r.side < 0 ? 'l' : 'r') : 'n'];
        r.grab = I.a;
      } else { r.rv *= 0.9; r.grab = false; }
      r.rot += r.rv * dt; if (r.grab) r.grabT += dt;
      if (r.ay <= 0 && r.vy < 0) this.land(i);
    }
  }
  land(i) {
    const r = this.rd[i], sg = r.side; r.air = false; r.ay = 0; r.s = sg * (HP.SM - 0.5); r.grab = false;
    const full = Math.round(r.rot / (Math.PI * 2)), off = Math.abs(r.rot - full * Math.PI * 2);
    if (off < 1.15) {                                            // generous landing window
      const n = Math.abs(full), names = []; let pts = Math.round(r.maxH / 3);
      if (n > 0) { names.push(['', '', 'Double ', 'Triple ', 'Quad ', 'Quint '][Math.min(n, 5)] + (r.rot * sg > 0 ? 'Backflip' : 'Frontflip')); pts += [0, 500, 1200, 2200, 3500, 5000][Math.min(n, 5)]; }
      if (r.grabT > 0.12) { names.push(r.grabName); pts += Math.round(r.grabT * 600); }
      if (!names.length) names.push(r.maxH > 200 ? 'Big Air' : 'Air');
      const name = names.join(' + ');
      if (name === r.last && pts > 100) { pts = Math.round(pts * 0.5); r.trick = name + ' (repeat ½)  +' + pts; } else r.trick = name + '  +' + pts;
      r.last = name; r.score += pts; r.best = Math.max(r.best, pts); r.trickT = 2.2;
      r.v = -sg * Math.abs(r.vy) * 0.98;
      if (pts >= 500) { sfx.trick(); rumble(i, 0.3, 0.5, 150); } else sfx.land();
      this.parts[i].add(sg * (HP.F + HP.R), HP.R, 10, PAL.white, 100, 0.5, 3);
    } else {
      r.crash = 1.3; r.v = -sg * Math.abs(r.vy) * 0.35; r.rot = 0;
      r.trick = 'WIPEOUT!'; r.trickT = 1.6; r.last = '';
      sfx.crash(); rumble(i, 1, 0.8, 420);
      this.parts[i].add(sg * (HP.F + HP.R), HP.R, 26, PAL.white, 200, 0.8, 4);
    }
  }
  result() {
    const s = this.rd.map(r => r.score);
    return { winner: s[0] > s[1] ? 0 : s[1] > s[0] ? 1 : -1, lines: s.map(x => x + ' pts'), sub: this.rd.map(r => 'best trick: ' + r.best + ' pts') };
  }
  draw() {
    for (let i = 0; i < 2; i++) { const oy = i ? VIEW2_Y : 0; ctx.save(); ctx.beginPath(); ctx.rect(0, oy, W, VIEW_H); ctx.clip(); ctx.translate(0, oy); this.drawView(i); ctx.restore(); }
    this.drawBand();
    this.drawOverlay();
  }
  // middle strip: a long tube sloping down to the finish, both riders flowing along it
  drawBand() {
    const t = this.rt, y0 = BAND_Y;
    ctx.save(); ctx.beginPath(); ctx.rect(0, y0, W, BAND_H); ctx.clip();
    const g = ctx.createLinearGradient(0, y0, 0, y0 + BAND_H); g.addColorStop(0, '#cfe6f6'); g.addColorStop(1, '#eef5fb');
    ctx.fillStyle = g; ctx.fillRect(0, y0, W, BAND_H);
    // hillside the tube is carved into
    blobPoly([-20, y0 + 26, 200, y0 + 22, 480, y0 + 34, 760, y0 + 46, 980, y0 + 52, 980, y0 + 90, -20, y0 + 90], PAL.snow, 2.5, 1, 1100);
    for (let k = 0; k < 9; k++) { const x = 70 + k * 105; drawTree(x, y0 + 26 + x * 0.026 - 4, 0.05, 1110 + k); }
    ctx.restore();
    const X0 = 60, X1 = 860, Y0 = y0 + 38, Y1 = y0 + 62;
    const at = f => [X0 + (X1 - X0) * f, Y0 + (Y1 - Y0) * f];
    // tube body
    inkPoly([X0, Y0 - 11, X1, Y1 - 11, X1, Y1 + 11, X0, Y0 + 11], PAL.ice, 3, 0.8, 1120);
    inkLine([X0, Y0 + 4, X1, Y1 + 4], 3, PAL.ice2, 0.5, 1121);
    // flowing snow chevrons
    ctx.save(); ctx.beginPath(); ctx.moveTo(X0, Y0 - 9); ctx.lineTo(X1, Y1 - 9); ctx.lineTo(X1, Y1 + 9); ctx.lineTo(X0, Y0 + 9); ctx.closePath(); ctx.clip();
    for (let k = 0; k < 22; k++) { const f = ((k / 22) + t * 0.12) % 1, [x, y] = at(f); ctx.beginPath(); ctx.moveTo(x - 6, y - 6); ctx.lineTo(x + 2, y); ctx.lineTo(x - 6, y + 6); stroke(2.2, 'rgba(255,255,255,.85)'); }
    ctx.restore();
    // start gate + finish flag
    inkLine([X0 - 6, Y0 + 12, X0 - 6, Y0 - 24], 3, INK, 0.4, 1122); inkLine([X0 - 6, Y0 - 24, X0 + 18, Y0 - 24], 3, INK, 0.4, 1123);
    txt('START', X0 + 6, Y0 - 32, 11, PAL.green);
    inkLine([X1 + 8, Y1 + 12, X1 + 8, Y1 - 30], 3, INK, 0.4, 1124);
    for (let a = 0; a < 3; a++) for (let b = 0; b < 2; b++) { ctx.fillStyle = (a + b) % 2 ? INK : PAL.white; ctx.fillRect(X1 + 9 + a * 7, Y1 - 30 + b * 7, 7, 7); }
    inkPoly([X1 + 9, Y1 - 30, X1 + 30, Y1 - 30, X1 + 30, Y1 - 16, X1 + 9, Y1 - 16], null, 2, 0.3, 1125);
    // riders as bouncing heads, height ~ air height
    for (let i = 0; i < 2; i++) {
      const r = this.rd[i], f = r.prog / HP.L, [x, y] = at(f);
      const lat = this.latX(r) / (HP.F + HP.R), hop = r.air ? Math.min(30, r.ay * 0.05) : 0;
      const hx = x, hy = y + (i ? 5 : -5) + lat * 4 - hop - 4;
      for (let k = 1; k <= 5; k++) { const [tx, ty] = at(Math.max(0, f - k * 0.008)); ctx.globalAlpha = 0.5 - k * 0.08; inkEllipse(tx, ty + lat * 7 - 2, 3, 2, PC[i], 0, 0); }
      ctx.globalAlpha = 1;
      ctx.save(); ctx.translate(hx, hy); ctx.rotate(r.air ? r.rot : 0);
      inkEllipse(0, 0, 9, 8.5, PAL.skin, 2.4, 1130 + i);
      pieEye(2, -1, 3.2, 1, 0, false, 1132 + i); pieEye(6.5, -1, 3.2, 1, 0, false, 1134 + i);
      beanie(0, -4, PC[i], PCD[i], 1136 + i * 10, 0);
      ctx.restore();
      ttxt(PN[i] + ' ' + Math.floor(f * 100) + '%', hx, i ? y + 24 : hy - 20, 13, PC[i]);
    }
  }
  drawView(i) {
    const r = this.rd[i], sc = 0.5, cx = W / 2, t = this.rt;
    const yb = 212 + r.cam, lip = yb - HP.R * sc, wl = cx - (HP.F + HP.R) * sc, wr = cx + (HP.F + HP.R) * sc;
    const g = ctx.createLinearGradient(0, 0, 0, VIEW_H); g.addColorStop(0, i ? '#7db3e6' : '#9ab0ea'); g.addColorStop(1, i ? '#d6ecf8' : '#f6d9d0');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, VIEW_H);
    for (let k = 0; k < 3; k++) drawCloud(((k * 360 + t * 12 + i * 150) % (W + 240)) - 120, 40 + k * 22 + r.cam * 0.2, 0.55, 1200 + k * 9 + i * 30);
    // far hills
    const hp = []; for (let x = -40; x <= W + 40; x += 60) hp.push(x, lip - 40 + r.cam * 0.4 - 45 * Math.abs(Math.sin(x * 0.006 + i)) - 18 * Math.sin(x * 0.021));
    inkPoly([-40, VIEW_H + 10, ...hp, W + 40, VIEW_H + 10], i ? '#9fb8de' : '#b4a9d8', 2.6, 0.8, 1220 + i);
    // flyers only show up when the rider is really high in the air (fade in as the camera climbs)
    const fa = clamp((r.cam - 120) / 100, 0, 1);
    if (fa > 0) { ctx.save(); ctx.globalAlpha = fa; this.drawFlyers(t + i * 7, r.cam * 0.2); ctx.restore(); }
    // far wall of the tube, with snow streaks flowing upward as the rider descends
    ctx.save(); ctx.beginPath(); ctx.rect(wl, lip, wr - wl, yb - lip + 4); ctx.clip();
    const bw = ctx.createLinearGradient(0, lip, 0, yb); bw.addColorStop(0, '#d6e6f5'); bw.addColorStop(1, '#a6c4e2'); ctx.fillStyle = bw; ctx.fillRect(wl, lip, wr - wl, yb - lip + 4);
    const off = (r.prog * 1.4) % 26;
    for (let yy = yb + 26 - off; yy > lip - 26; yy -= 26) for (let k = 0; k < 6; k++) { const x = wl + 18 + k * 50 + hash(Math.floor((r.prog * 1.4 + yb - yy) / 26) * 7 + k) * 20; ctx.beginPath(); ctx.moveTo(x, yy); ctx.quadraticCurveTo(x + 7, yy - 3, x + 14, yy); stroke(1.6, 'rgba(255,255,255,.8)'); }
    ctx.restore();
    // pipe profile (snow body under the riding surface)
    const prof = [];
    for (let k = 0; k <= 28; k++) { const P = pipePos(-HP.SM + (2 * HP.SM) * k / 28); prof.push(cx + P.x * sc, yb - P.y * sc); }
    inkPoly([-20, lip, ...prof, W + 20, lip, W + 20, VIEW_H + 60, -20, VIEW_H + 60], PAL.snow, 0, 0, 0);
    inkLine([-20, lip + 1, wl, lip], 3, INK, 0.6, 1230); inkLine([wr, lip, W + 20, lip + 1], 3, INK, 0.6, 1231);
    inkLine(prof, 3.5, INK, 0.7, 1232);
    inkLine(prof.map((v, k) => k % 2 ? v + 6 : v), 2, PAL.ice, 0.6, 1233);
    inkEllipse(wl, lip, 3.5, 3.5, '#6b6474', 2, 1234); inkEllipse(wr, lip, 3.5, 3.5, '#6b6474', 2, 1235);
    // deck props: flags, a spectator snowman per side
    for (const fx of [110, 850]) { inkLine([fx, lip, fx, lip - 54], 3, INK, 0.4, 1240 + fx); blobPoly([fx + 1, lip - 54, fx + 26, lip - 48 + Math.sin(t * 6 + fx) * 3, fx + 1, lip - 40], PC[i], 2.2, 0.4, 1241 + fx); }
    for (const sx of [190, 770]) {
      inkEllipse(sx, lip - 14, 14, 13, PAL.white, 2.6, 1250 + sx); inkEllipse(sx, lip - 36, 10, 10, PAL.white, 2.6, 1251 + sx);
      pieEye(sx - 3, lip - 38, 3, (cx - sx) / 400, 0, false, 1252 + sx); pieEye(sx + 4, lip - 38, 3, (cx - sx) / 400, 0, false, 1253 + sx);
      inkPoly([sx, lip - 34, sx + 9, lip - 32, sx, lip - 31], PAL.orange, 1.4, 0.3, 1254 + sx);
      const cheer = r.trickT > 1.5 && r.trick !== 'WIPEOUT!' ? Math.sin(t * 20) * 6 : 0;
      inkLine([sx - 12, lip - 18, sx - 22, lip - 28 - cheer], 2, PAL.wood2, 0.3, 1255 + sx); inkLine([sx + 12, lip - 18, sx + 22, lip - 28 + cheer], 2, PAL.wood2, 0.3, 1256 + sx);
    }
    if (r.air) txt((r.ay / 50).toFixed(1) + ' m', cx + r.side * (HP.F + HP.R) * sc + r.side * 46, lip - r.ay * sc, 14, PAL.white);
    // rider
    ctx.save();
    if (r.air) {
      ctx.translate(cx + r.side * (HP.F + HP.R - 24) * sc, lip - r.ay * sc); ctx.rotate(-r.side * Math.PI / 2 + r.rot); ctx.scale(0.75, 0.75);
      if (r.side < 0) ctx.scale(-1, 1);
    } else {
      const P = pipePos(r.s); ctx.translate(cx + P.x * sc, yb - P.y * sc); ctx.rotate(-P.sg * P.a); ctx.scale(0.75, 0.75);
      if (r.v < 0) ctx.scale(-1, 1);
    }
    shadow(0, 2, 22, 4, 0.18);
    drawBoarder(i, { grab: r.grab, pump: r.pump, crash: r.crash > 0, t });
    ctx.restore();
    for (const p of this.parts[i].a) { ctx.globalAlpha = Math.max(0, p.life / p.max); inkEllipse(cx + p.x * sc, yb - p.y * sc, p.size, p.size, p.col, p.size > 2.5 ? 1.2 : 0, 0); }
    ctx.globalAlpha = 1;
    // HUD
    hudTag(10, 10, 210, 58, 1260 + i);
    ttxt(PN[i], 26, 30, 22, PC[i], 'left'); txt(r.score + ' pts', 206, 30, 22, INK, 'right', false);
    txt(r.fin ? 'finished!' : r.air ? 'AIR!' : r.pump ? 'PUMP!' : Math.round(Math.abs(r.v) * 0.1) + ' km/h', 26, 54, 14, r.pump ? PAL.red : PAL.wood2, 'left', false);
    if (r.trickT > 0) { ctx.globalAlpha = clamp(r.trickT, 0, 1); ttxt(r.trick, cx, VIEW_H - 18, 24, r.trick === 'WIPEOUT!' ? PAL.red : PAL.yellow); ctx.globalAlpha = 1; }
    this.drawMap(i, W - 214, 8);
  }
  // things flying high in the sky: plane with a banner, a bird, a hot-air balloon, a UFO
  drawFlyers(t, dy) {
    const lap = (speed, phase, span = W + 500) => ((t * speed + phase) % span + span) % span - 250;
    { // plane (left -> right) towing a banner
      const x = lap(70, 0, W + 900), y = 34 + dy + Math.sin(t * 0.8) * 4;
      if (x > -260 && x < W + 260) {
        inkLine([x - 30, y, x - 60, y + 2], 1.2, INK, 0.2, 1400);
        inkPoly([x - 220, y - 9, x - 60, y - 7 + Math.sin(t * 5) * 2, x - 60, y + 11 + Math.sin(t * 5) * 2, x - 220, y + 9], PAL.paper, 2, 0.5, 1401);
        txt('POWDER PANIC!', x - 140, y + 1, 11, PAL.red, 'center', false, FONT_T);
        blobPoly([x - 32, y - 2, x - 26, y - 14, x - 20, y - 4, x + 22, y - 6, x + 34, y, x + 22, y + 7, x - 28, y + 5], PAL.red, 2.2, 0.4, 1402);
        inkPoly([x - 8, y + 1, x + 10, y + 1, x + 2, y + 14, x - 12, y + 14], PAL.yellow, 2, 0.3, 1403);
        for (let k = 0; k < 3; k++) inkEllipse(x - 6 + k * 8, y - 2, 2, 2, PAL.ice, 1, 1404 + k);
        inkLine([x + 35, y - 9 * Math.cos(t * 40), x + 35, y + 9 * Math.cos(t * 40)], 2, INK, 0.1, 1408);
      }
    }
    { // bird (right -> left), flapping
      const x = W + 250 - lap(55, 300, W + 700) - 250, y = 70 + dy + Math.sin(t * 2) * 10, f = Math.sin(t * 12) * 8;
      inkCurve(x, y, x - 8, y - 4 - f, x - 16, y - f * 0.6, 2.4, INK, 1410); inkCurve(x, y, x + 8, y - 4 - f, x + 16, y - f * 0.6, 2.4, INK, 1411);
      inkEllipse(x, y + 1, 4, 3, PAL.wood, 1.4, 1412); inkPoly([x - 2, y + 2, x - 7, y + 3, x - 2, y + 4], PAL.orange, 1, 0.1, 1413);
    }
    { // hot-air balloon, slow drift and bob
      const x = lap(14, 600, W + 300), y = 60 + dy + Math.sin(t * 0.7) * 10;
      blobPoly([x, y - 34, x + 18, y - 26, x + 20, y - 8, x + 8, y + 10, x - 8, y + 10, x - 20, y - 8, x - 18, y - 26], PAL.yellow, 2.4, 0.5, 1420);
      blobPoly([x, y - 34, x + 7, y - 20, x + 5, y + 10, x - 5, y + 10, x - 7, y - 20], PAL.red, 1.6, 0.4, 1421);
      inkLine([x - 7, y + 10, x - 5, y + 20], 1, INK, 0.1, 1422); inkLine([x + 7, y + 10, x + 5, y + 20], 1, INK, 0.1, 1423);
      inkPoly([x - 6, y + 19, x + 6, y + 19, x + 5, y + 27, x - 5, y + 27], PAL.wood, 1.8, 0.3, 1424);
    }
    { // UFO: zig-zags across now and then, blinking lights and a little green pilot
      const x = lap(120, 900, W + 900) + Math.sin(t * 3) * 30, y = 46 + dy + Math.sin(t * 5) * 6;
      if (x > -60 && x < W + 60) {
        ctx.fillStyle = 'rgba(180,255,170,.18)'; ctx.beginPath(); ctx.moveTo(x - 8, y + 6); ctx.lineTo(x + 8, y + 6); ctx.lineTo(x + 26, y + 70); ctx.lineTo(x - 26, y + 70); ctx.fill();
        inkEllipse(x, y - 4, 11, 10, '#bfe8f7', 2, 1430);
        inkEllipse(x, y - 4, 4, 4.5, PAL.green, 1.2, 1431); ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(x + 1, y - 5, 1.4, 0, 7); ctx.fill();
        inkEllipse(x, y + 3, 26, 7, '#9a96a8', 2.4, 1432);
        for (let k = 0; k < 5; k++) { const on = (Math.floor(t * 6) + k) % 3 === 0; inkEllipse(x - 18 + k * 9, y + 4, 2.2, 2.2, on ? PAL.yellow : '#5b5560', 0.8, 1433 + k); }
      }
    }
  }
  // top-down tube map: progress left→right, lateral position up/down; zig-zag trail shows wall-to-wall runs
  drawMap(i, x, y) {
    const w = 204, h = 66, r = this.rd[i], o = this.rd[1 - i];
    card(x, y, w, h, PAL.paper, 1270 + i, 10);
    txt('TUBE MAP', x + 12, y + 12, 10, PAL.wood2, 'left', false);
    const mx0 = x + 14, mx1 = x + w - 24, my = y + 40, mh = 14;
    const map = (p, lat) => [mx0 + (mx1 - mx0) * p / HP.L, my + lat / (HP.F + HP.R) * mh];
    blobPoly([mx0 - 4, my - mh - 3, mx1 + 4, my - mh - 3, mx1 + 4, my + mh + 3, mx0 - 4, my + mh + 3], PAL.ice, 2.2, 0.5, 1280 + i);
    inkLine([mx0, my - mh + 2, mx1, my - mh + 2], 1.2, PAL.white, 0.3, 1282); inkLine([mx0, my + mh - 2, mx1, my + mh - 2], 1.2, PAL.white, 0.3, 1283);
    for (let a = 0; a < 2; a++) for (let b = 0; b < 4; b++) { ctx.fillStyle = (a + b) % 2 ? INK : PAL.white; ctx.fillRect(mx1 + 6 + a * 5, my - 10 + b * 5, 5, 5); }
    const [ox, oy] = map(o.prog, this.latX(o)); ctx.globalAlpha = 0.45; inkEllipse(ox, oy, 3.5, 3.5, PC[1 - i], 1.2, 0); ctx.globalAlpha = 1;
    if (r.trail.length > 2) { ctx.beginPath(); for (let k = 0; k < r.trail.length; k += 2) { const [px, py] = map(r.trail[k], r.trail[k + 1]); k ? ctx.lineTo(px, py) : ctx.moveTo(px, py); } stroke(2, PC[i]); }
    const [px, py] = map(r.prog, this.latX(r)); inkEllipse(px, py, 5, 5, PC[i], 1.8, 1290 + i);
  }
}
