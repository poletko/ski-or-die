'use strict';
// EVENT 1 — DOWNHILL DASH: vertical split-screen race (left P1, right P2).
class Downhill extends EventBase {
  constructor() {
    super('DOWNHILL DASH', 'race', [
      'Race to the bottom! Pass between the flags of every gate — each missed gate costs +3 seconds.',
      'Stick: steer    Ⓐ hold: tuck (faster, wider turns)    Ⓑ: jump    Stick up: brake',
      'Halfway down: HUGE CLIFF JUMPS! Tuck for speed and steer in the air to land on the next cliff — or fall into the clouds!']);
    this.L = 17500; this.CW = 480;
    const rng = mulberry((Math.random() * 1e9) | 0), R = (a, b) => a + rng() * (b - a);
    // Cliff section: mainland edge -> island -> island -> mainland. Each gap is open sky above the clouds.
    const C0 = 7200, w1 = 300, w2 = 290;
    const x1 = R(30, 150), x2 = x1 + w1 / 2 < 240 ? R(170, 190) : R(30, 60);
    let y = C0; this.surf = [{ y0: -1e9, y1: C0, x0: 0, x1: 480, main: true }];
    for (const [gap, len, x0, w] of [[400, 900, x1, w1], [450, 900, x2, w2]]) { y += gap; this.surf.push({ y0: y, y1: y + len, x0, x1: x0 + w }); y += len; }
    y += 500; this.surf.push({ y0: y, y1: 1e9, x0: 0, x1: 480, main: true });
    this.cz = [C0, y];
    const inCz = yy => yy > C0 - 260 && yy < y + 160;
    this.gates = []; this.obs = []; this.ramps = [];
    let gi = 0;
    for (let y = 900; y < this.L - 500; y += R(620, 880)) if (!inCz(y)) this.gates.push({ y, cx: R(110, 370), gap: 120, done: [0, 0], ok: [0, 0], col: gi++ % 2 ? '#8a5ad6' : '#ff7a2f' });
    for (let y = 1700; y < this.L - 800; y += R(1300, 1900)) if (!inCz(y) && !inCz(y + 400)) this.ramps.push({ x: R(90, 390), y, w: 80, h: 30 });
    for (let y = 520; y < this.L - 220; y += R(24, 46)) {
      const dens = 0.32 + 0.42 * (y / this.L); if (rng() > dens || inCz(y)) continue;
      const x = R(34, 446), tree = rng() < 0.7;
      if (this.gates.some(g => Math.abs(g.y - y) < 100 && Math.abs(x - g.cx) < g.gap / 2 + 45)) continue;
      if (this.ramps.some(q => y > q.y - 160 && y < q.y + 90 && Math.abs(x - q.x) < 75)) continue;
      this.obs.push({ x, y, r: tree ? 15 : 11, type: tree ? 'tree' : 'rock', v: rng() });
    }
    this.sk = [0, 1].map(() => ({ x: 240, y: 200, ang: 0, spd: 0, z: 0, vz: 0, air: false, crash: 0, ghost: 0, pen: 0, fin: null, dnf: false, trail: [], lastTr: 200, hit: 0, miss: 0, tuck: false, cliff: false, fall: 0, falls: 0, from: 0, camOff: 170, fvx: 0, fvy: 0 }));
    this.parts = [new Parts(), new Parts()]; this.pops = [[], []]; this.cut = 0;
  }
  pop(i, x, y, t, c) { this.pops[i].push({ x, y, t, c, life: 1.2 }); }
  surfIdx(y) { for (let k = 0; k < this.surf.length; k++) if (y >= this.surf[k].y0 && y < this.surf[k].y1) return k; return -1; }
  solid(x, y) { const k = this.surfIdx(y); return k >= 0 && x >= this.surf[k].x0 && x <= this.surf[k].x1; }
  startFall(i, from) {
    const s = this.sk[i]; s.fall = 0.001; s.falls++; s.from = from; s.air = false; s.cliff = false; s.spd = 0;
    sfx.fall(); rumble(i, 0.4, 0.2, 200);
  }
  respawn(i) {
    const s = this.sk[i], su = this.surf[s.from];
    s.y = su.main && s.from === 0 ? this.cz[0] - 700 : su.y0 + 90; s.x = (su.x0 + su.x1) / 2;
    s.z = 0; s.vz = 0; s.air = false; s.cliff = false; s.fall = 0; s.spd = 330; s.ang = 0; s.ghost = 1.5; s.crash = 0;
    s.trail.push(NaN, NaN, 0, 0); s.lastTr = s.y; s.camOff = 120;
    this.pop(i, s.x, s.y - 60, 'TRY AGAIN!', PAL.yellow); sfx.select();
  }
  play(dt) {
    for (let i = 0; i < 2; i++) this.upd(i, dt);
    this.parts.forEach(p => p.update(dt)); this.pops.forEach(p => updPops(p, dt));
    if (this.phase !== 'play') return;
    const f = this.sk.map(s => s.fin != null);
    if (f[0] && f[1]) this.end();
    else if ((f[0] || f[1]) && !this.cut) this.cut = this.t + 20;
    if ((this.cut && this.t > this.cut) || this.t > 240) { this.sk.forEach(s => { if (s.fin == null) s.dnf = true; }); this.end(); }
  }
  crash(i, o) {
    const s = this.sk[i]; s.crash = 1.3; s.spd = 0; s.air = false; s.z = 0;
    s.x += (s.x < o.x ? -1 : 1) * 10; sfx.crash(); rumble(i, 1, 0.7, 380);
    this.parts[i].add(s.x, s.y, 22, '#ffffff', 170, 0.7, 4); if (o.type === 'tree') this.parts[i].add(o.x, o.y - 20, 10, PAL.pine, 90, 0.7, 2.5);
    this.pop(i, s.x, s.y - 40, 'WIPEOUT!', PAL.red);
  }
  upd(i, dt) {
    const s = this.sk[i], I = inp[i];
    if (s.fin != null || s.dnf) { s.spd *= Math.pow(0.35, dt); s.y += s.spd * dt; return; }
    if (s.ghost > 0) s.ghost -= dt;
    // camera looks further ahead around the cliffs and while flying
    const nearCz = s.y > this.cz[0] - 900 && s.y < this.cz[1];
    s.camOff += ((nearCz ? 140 : 170) + (s.cliff ? s.z * 0.5 : 0) - s.camOff) * Math.min(1, 4 * dt);
    if (s.fall > 0) {   // Coyote moment: hang in the air, look at the camera, then drop into the clouds
      s.fall += dt;
      if (s.fall > 1.45 && !s.poofed) { s.poofed = true; sfx.poof(); }
      if (s.fall > 2.3) { s.poofed = false; this.respawn(i); }
      return;
    }
    if (s.crash > 0) { s.crash -= dt; if (s.crash <= 0) { s.ang = 0; s.ghost = 1.3; } return; }
    s.tuck = I.a && !s.air; const brake = I.ly < -0.5 && !s.air;
    const prevY = s.y, sIdx = this.surfIdx(s.y);
    if (s.air && s.cliff) {   // air steering: gentle sideways drift, forward speed stays constant
      s.fvx += (clamp(I.lx, -1, 1) * 220 - s.fvx) * Math.min(1, 3 * dt);
      s.x += s.fvx * dt; s.y += s.fvy * dt; s.ang = Math.atan2(s.fvx, s.fvy) * 0.6;
    }
    if (!s.air) {
      const tgt = clamp(I.lx, -1, 1) * 1.3, rate = s.tuck ? 1.8 : 3.8;
      s.ang += clamp(tgt - s.ang, -rate * dt, rate * dt);
      if (Math.abs(tgt - s.ang) > 0.4 && s.spd > 250 && Math.random() < 0.6) this.parts[i].add(s.x - Math.sin(s.ang) * 6, s.y + 8, 2, '#ffffff', 70, 0.4, 2.5);
    }
    let k = s.air ? 0.12 : (s.tuck ? 0.46 : 0.74) + 0.9 * Math.abs(Math.sin(s.ang)); if (brake) k += 2.4;
    if (!s.cliff) { s.spd += (400 * Math.cos(s.ang) - k * s.spd) * dt; if (s.spd < 0) s.spd = 0; }
    if (!s.cliff) { s.x += Math.sin(s.ang) * s.spd * dt; s.y += Math.cos(s.ang) * s.spd * dt; }
    const onMain = sIdx >= 0 && this.surf[sIdx].main && !s.cliff;
    if (onMain) { if (s.x < 26) { s.x = 26; s.spd *= Math.pow(0.25, dt); } if (s.x > 454) { s.x = 454; s.spd *= Math.pow(0.25, dt); } }
    s.x = clamp(s.x, -30, 510);
    // ran over a cliff edge -> huge launch
    if (sIdx >= 0 && !s.cliff && prevY < this.surf[sIdx].y1 && s.y >= this.surf[sIdx].y1 && sIdx < this.surf.length - 1) {
      s.air = true; s.cliff = true; s.from = sIdx; s.vz = 380 + s.spd * 0.2; s.spd = Math.min(s.spd, 760); s.fvx = Math.sin(s.ang) * s.spd; s.fvy = Math.max(120, Math.cos(s.ang) * s.spd); s.z = Math.max(s.z, 1);
      sfx.bigair(); rumble(i, 0.6, 0.4, 250); this.pop(i, s.x, s.y - 70, sIdx ? 'AND AGAIN!' : 'HUGE AIR!', PAL.yellow);
    }
    if (!s.air && !this.solid(s.x, s.y)) { this.startFall(i, Math.max(0, sIdx)); return; }   // skied off the side
    if (I.bP && !s.air) { s.air = true; s.vz = 280; sfx.jump(); }
    if (s.air) {
      s.vz -= (s.cliff ? 650 : 950) * dt; s.z += s.vz * dt;
      if (s.z <= 0) {
        s.z = 0; s.air = false;
        if (!this.solid(s.x, s.y) && this.solid(s.x, s.y + 30)) { s.y = this.surf[this.surfIdx(s.y + 30)].y0 + 2; s.spd *= 0.6; s.fvx *= 0.6; s.fvy *= 0.6; this.pop(i, s.x, s.y - 50, 'PHEW!', PAL.orange); }   // caught the lip
        if (!this.solid(s.x, s.y)) { this.startFall(i, s.from); return; }
        if (s.cliff) { s.cliff = false; s.spd = Math.hypot(s.fvx, s.fvy); s.ang = clamp(Math.atan2(s.fvx, s.fvy), -1.2, 1.2); s.ghost = 0.3; sfx.land(); sfx.gate(); rumble(i, 0.8, 0.6, 260); this.parts[i].add(s.x, s.y, 26, '#ffffff', 200, 0.6, 4); this.pop(i, s.x, s.y - 50, 'STUCK THE LANDING!', PAL.green); }
        else { sfx.land(); this.parts[i].add(s.x, s.y, 8, '#ffffff', 90, 0.4, 3); rumble(i, 0.2, 0.3, 80); }
      }
    } else {
      for (const r of this.ramps) if (s.y > r.y && s.y < r.y + r.h && Math.abs(s.x - r.x) < r.w / 2) { s.air = true; s.vz = 500; s.spd += 90; sfx.jump(); this.pop(i, s.x, s.y - 40, 'BIG AIR!', PAL.yellow); break; }
    }
    if (s.ghost <= 0 && s.z < 10) {
      for (const o of this.obs) { if (o.y < s.y - 30) continue; if (o.y > s.y + 30) break; const dx = s.x - o.x, dy = s.y - o.y; if (dx * dx + dy * dy < (o.r + 7) * (o.r + 7)) { this.crash(i, o); return; } }
    }
    for (const g of this.gates) {
      if (g.done[i]) continue; if (g.y > s.y) break;
      g.done[i] = 1;
      if (Math.abs(s.x - g.cx) < g.gap / 2) { g.ok[i] = 1; s.hit++; sfx.gate(); this.pop(i, g.cx, g.y - 40, 'GATE ✓', PAL.green); }
      else { s.pen += 3; s.miss++; sfx.miss(); this.pop(i, s.x, s.y - 40, '+3 SEC', PAL.red); rumble(i, 0.3, 0.2, 120); }
    }
    if (!s.air && s.y - s.lastTr > 9) { s.trail.push(s.x, s.y, Math.sin(s.ang), Math.cos(s.ang)); s.lastTr = s.y; if (s.trail.length > 400) s.trail.splice(0, 4); }
    if (s.y >= this.L) { s.fin = this.t + s.pen; this.pop(i, 240, s.y - 50, 'FINISH! ' + fmtT(s.fin), PAL.yellow); rumble(i, 0.5, 0.5, 300); }
  }
  result() {
    const t = this.sk.map(s => s.dnf ? Infinity : s.fin);
    return { winner: t[0] < t[1] ? 0 : t[1] < t[0] ? 1 : -1, lines: t.map(fmtT), sub: this.sk.map(s => `${s.hit} gates • ${s.miss} missed (+${s.pen}s) • ${s.falls} cloud falls`) };
  }

  draw() {
    for (let i = 0; i < 2; i++) { ctx.save(); ctx.beginPath(); ctx.rect(i * 480, 0, 480, H); ctx.clip(); ctx.translate(i * 480, 0); this.drawView(i); ctx.restore(); }
    // hand-drawn divider with a progress "thermometer"
    inkPoly([472, -5, 488, -5, 488, H + 5, 472, H + 5], PAL.wood, 3, 1, 1);
    inkLine([480, 40, 480, 500], 4, PAL.wood2, 0.6, 2);
    inkEllipse(480, 30, 9, 9, PAL.white, 2.4, 3); ttxt('S', 480, 31, 11, PAL.green);
    inkEllipse(480, 510, 9, 9, PAL.yellow, 2.4, 4); txt('🏁', 480, 511, 10, INK, 'center', false);
    for (let i = 0; i < 2; i++) { const p = clamp(this.sk[i].y / this.L, 0, 1); inkEllipse(480, 40 + p * 460, 7, 7, PC[i], 2.4, 5 + i); }
    this.doneText = 'FINISH!';
    this.drawOverlay();
  }
  // Wile E. Coyote style: freeze in mid-air with a little sign, then drop into the clouds — poof!
  drawFall(q, j, cy, t, al) {
    const p = q.fall, x = q.x, y = q.y - cy;
    if (p < 0.6) drawSkier(x, y, q.z, 0, j, { scared: true, sign: p > 0.12 ? 'UH-OH!' : null, noShadow: true, t, alpha: al });
    else if (p < 1.45) { const e = Math.pow((p - 0.6) / 0.85, 2); drawSkier(x, y + e * 90, q.z * (1 - e), 0, j, { scared: true, noShadow: true, scale: 1 - 0.93 * e, rot: e * 3, t, alpha: al }); }
    else if (p < 2.3) {
      const u = (p - 1.45) / 0.85; ctx.globalAlpha = (1 - u) * al;
      const L = []; for (let k = 0; k < 7; k++) { const a = k * 0.9; L.push([x + Math.cos(a) * (3 + u * 18), y + 92 + Math.sin(a) * (2 + u * 7), 2.5 + u * 4]); }
      blobs(L, PAL.white, 1.3, 77 + j); ctx.globalAlpha = 1;
    }
  }
  // predicted landing spot while flying off a cliff: green ring = safe, red X = clouds
  drawTarget(q, cy) {
    const g = 650, tl = (q.vz + Math.sqrt(q.vz * q.vz + 2 * g * q.z)) / g;
    const lx = q.x + q.fvx * tl, ly = q.y + q.fvy * tl - cy, ok = this.solid(lx, ly + cy);
    if (ok) { ctx.setLineDash([6, 6]); inkEllipse(lx, ly, 22, 9, 'rgba(120,194,100,.25)', 3, 90); ctx.setLineDash([]); inkLine([lx, ly - 4, lx, ly + 4], 2, PAL.green, 0.2, 91); }
    else { inkLine([lx - 12, ly - 7, lx + 12, ly + 7], 4, PAL.red, 0.3, 92); inkLine([lx + 12, ly - 7, lx - 12, ly + 7], 4, PAL.red, 0.3, 93); }
  }
  drawSign(x, y, a, b, seed) {
    shadow(x + 6, y + 2, 14, 4);
    inkLine([x - 9, y, x - 9, y - 30], 3.5, PAL.wood2, 0.3, seed); inkLine([x + 9, y, x + 9, y - 30], 3.5, PAL.wood2, 0.3, seed + 1);
    inkPoly([x - 34, y - 62, x + 34, y - 62, x + 34, y - 26, x - 34, y - 26], PAL.yellow, 3, 0.6, seed + 2);
    txt(a, x, y - 51, 12, INK, 'center', false, FONT_T); txt(b, x, y - 36, 12, PAL.red, 'center', false, FONT_T);
  }
  drawCliffs(cy, t) {
    const [z0, z1] = this.cz, top = z0 - cy, len = z1 - z0;
    if (top > H + 20 || top + len < -20) return;
    ctx.save(); ctx.beginPath(); ctx.rect(0, top, 480, len); ctx.clip();
    // open sky far below, two parallax layers of clouds drifting
    ctx.fillStyle = '#a4d4f2'; ctx.fillRect(0, Math.max(0, top), 480, Math.min(H, top + len) - Math.max(0, top));
    for (const [par, sc, step, al, n] of [[0.35, 0.45, 70, 0.75, 0], [0.6, 0.8, 95, 1, 1]]) {
      ctx.globalAlpha = al;
      for (let k = 0; ; k++) {
        const sy = top * par - H * par + k * step; if (sy > H + 50) break; if (sy < -50 || sy < top - 50) continue;
        drawCloud(hash(k * 7 + n * 3) * 540 - 30 + Math.sin(t * 0.25 + k) * 14, sy, sc, k + n * 2);
      }
    }
    ctx.globalAlpha = 1;
    // rock faces under every edge (they fade into a band of mist)
    for (let k = 0; k < this.surf.length - 1; k++) {
      const su = this.surf[k], ey = su.y1 - cy, x0 = Math.max(-10, su.x0), x1 = Math.min(490, su.x1);
      if (ey < -160 || ey > H + 10) continue;
      const pts = [x0, ey], n = Math.max(3, Math.round((x1 - x0) / 34));
      for (let m = n; m >= 0; m--) { const xx = x0 + (x1 - x0) * m / n; pts.push(xx, ey + 104 + hash(k * 31 + m) * 34); }
      pts.splice(2, 0, x1, ey);
      inkPoly(pts, PAL.rock2, 3, 0.6, 500 + k * 40);
      for (let m = 1; m < n; m++) { const xx = x0 + (x1 - x0) * m / n + hash(m + k) * 10; inkLine([xx, ey + 10, xx - 4, ey + 40 + hash(m * 3 + k) * 40], 1.5, '#5f5a56', 0.3, 520 + m + k * 40); }
      for (let r = 0; r < 2; r++) inkLine([x0 + 6, ey + 38 + r * 30, (x0 + x1) / 2, ey + 34 + r * 30 + hash(k + r) * 8, x1 - 6, ey + 40 + r * 30], 1.4, '#6d6762', 0.4, 540 + r + k * 40);
      for (let m = 0; m < n * 2; m++) { const xx = x0 + 8 + (x1 - x0 - 16) * (m + 0.5) / (n * 2), hh = 6 + hash(m * 5 + k) * 10; inkPoly([xx - 3, ey + 1, xx + 3, ey + 1, xx, ey + hh], PAL.ice, 1.4, 0.2, 560 + m + k * 40); }   // icicles
      for (let m = 0; m <= n; m++) drawCloud(x0 + (x1 - x0) * m / n, ey + 128 + hash(m + k * 9) * 12, 0.6, m + k);   // mist
    }
    // island tops: snowy mesas with corner flags and takeoff arrows
    for (let k = 1; k < this.surf.length - 1; k++) {
      const su = this.surf[k], y0 = su.y0 - cy, y1 = su.y1 - cy, x0 = su.x0, x1 = su.x1;
      if (y1 < -20 || y0 > H + 20) continue;
      const pts = [], nx = 4, ny = Math.round((y1 - y0) / 110);
      for (let m = 0; m < nx; m++) pts.push(x0 + (x1 - x0) * m / nx, y0);
      for (let m = 0; m < ny; m++) pts.push(x1, y0 + (y1 - y0) * m / ny);
      for (let m = 0; m < nx; m++) pts.push(x1 - (x1 - x0) * m / nx, y1);
      for (let m = 0; m < ny; m++) pts.push(x0, y1 - (y1 - y0) * m / ny);
      inkPoly(pts, PAL.snow, 0, 1, 600 + k * 50);
      ctx.fillStyle = PAL.snow2; ctx.fillRect(x0, y0, 12, y1 - y0); ctx.fillRect(x1 - 12, y0, 12, y1 - y0); ctx.fillRect(x0, y1 - 10, x1 - x0, 10);   // soft edge shading
      inkPoly(pts, null, 3.5, 1, 600 + k * 50);
      for (let r = Math.max(0, Math.floor(-y0 / 50)); r * 50 < y1 - y0 && y0 + r * 50 < H; r++) for (let c = 0; c < 4; c++) {
        const h = hash(r * 13 + c * 7 + k); if (h < 0.5) continue;
        const xx = x0 + 20 + (x1 - x0 - 50) * (c + h) / 4, yy = y0 + r * 50 + h * 30;
        ctx.beginPath(); ctx.moveTo(xx, yy); ctx.quadraticCurveTo(xx + 6, yy + 3, xx + 12, yy); stroke(1.6, PAL.hatch);
      }
      for (let m = 0; m < 3; m++) { const ax = (x0 + x1) / 2 + (m - 1) * 40, ay = y1 - 70; inkPoly([ax - 12, ay, ax, ay + 14, ax + 12, ay, ax + 6, ay, ax, ay + 6, ax - 6, ay], PAL.red, 2, 0.3, 640 + m + k * 50); }
      drawFlag(x0 + 10, y0 + 40, PAL.red, false, t, 650 + k); drawFlag(x1 - 10, y0 + 40, PAL.red, false, t, 660 + k);
      drawFlag(x0 + 10, y1 - 8, PAL.red, false, t, 670 + k); drawFlag(x1 - 10, y1 - 8, PAL.red, false, t, 680 + k);
    }
    ctx.restore();
    // mainland takeoff arrows and the far landing lip
    if (top - 70 > -20 && top - 70 < H) for (let m = 0; m < 5; m++) { const ax = 80 + m * 80, ay = top - 70; inkPoly([ax - 12, ay, ax, ay + 14, ax + 12, ay, ax + 6, ay, ax, ay + 6, ax - 6, ay], PAL.red, 2, 0.3, 700 + m); }
    const ly = z1 - cy; if (ly > -10 && ly < H + 10) { inkLine([-5, ly, 120, ly - 3, 240, ly + 1, 360, ly - 2, 485, ly], 3.5, INK, 0.8, 710); }
  }
  drawView(i) {
    const s = this.sk[i], cy = s.y - s.camOff, bot = cy + H + 60, t = this.rt;
    ctx.fillStyle = PAL.snow; ctx.fillRect(0, 0, 480, H);
    // hand-drawn snow texture: little hatch strokes and soft mogul shadows that scroll with the slope
    const r0 = Math.floor(cy / 40);
    for (let r = r0; r < r0 + 16; r++) for (let c = 0; c < 8; c++) {
      const h = hash(r * 31 + c * 17); if (h < 0.45) continue;
      const x = c * 60 + h * 40, y = r * 40 - cy + hash(r + c * 3) * 30;
      if (h > 0.9) { ctx.fillStyle = 'rgba(160,190,220,.25)'; ctx.beginPath(); ctx.ellipse(x, y, 22, 7, 0, 0, Math.PI * 2); ctx.fill(); }
      ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + 6, y + 3, x + 12, y); stroke(1.6, PAL.hatch);
    }
    this.drawCliffs(cy, t);
    if (cy < 260) { inkLine([20, 228 - cy, 460, 230 - cy], 4, PAL.red, 1, 30); card(180, 186 - cy, 120, 32, PAL.paper, 31, 8); ttxt('START', 240, 203 - cy, 20, PAL.red); }
    if (bot > this.L - 40) {
      const fy = this.L - cy;
      for (let c = 0; c < 24; c++) for (let r = 0; r < 2; r++) { ctx.fillStyle = (c + r) % 2 ? INK : PAL.white; ctx.fillRect(c * 20, fy + r * 10, 20, 10); }
      inkLine([0, fy, 480, fy], 2.5, INK, 0.5, 33);
      inkLine([16, fy + 20, 17, fy - 74], 5, INK, 0.6, 34); inkLine([464, fy + 20, 463, fy - 74], 5, INK, 0.6, 35);
      blobPoly([10, fy - 82, 240, fy - 92, 470, fy - 82, 470, fy - 50, 240, fy - 58, 10, fy - 50], PAL.yellow, 3.2, 0.8, 36);
      ttxt('FINISH', 240, fy - 70, 24, PAL.red);
    }
    // ski tracks (hand-drawn double lines)
    for (let j = 0; j < 2; j++) {
      const tr = this.sk[j].trail; ctx.lineWidth = 2; ctx.strokeStyle = j === i ? 'rgba(130,160,200,.55)' : 'rgba(130,160,200,.22)'; ctx.lineCap = 'round';
      for (const off of [-5, 5]) { ctx.beginPath(); let st = false; for (let k = 0; k < tr.length; k += 4) { const ty = tr[k + 1] - cy; if (ty < -20 || ty > H + 20) { st = false; continue; } if (tr[k] !== tr[k]) { st = false; continue; } const tx = tr[k] + off * tr[k + 3], ty2 = ty - off * tr[k + 2] * 0.5; if (!st) { ctx.moveTo(tx, ty2); st = true; } else ctx.lineTo(tx, ty2); } ctx.stroke(); }
    }
    const list = [];
    for (const r of this.ramps) if (r.y > cy - 60 && r.y < bot) list.push({ y: r.y + r.h, f: () => {
      const ry = r.y - cy, x0 = r.x - r.w / 2;
      shadow(r.x + 6, ry + r.h + 4, r.w / 2 + 4, 6);
      inkPoly([x0, ry + r.h, x0 + 4, ry, x0 + r.w - 4, ry, x0 + r.w, ry + r.h], PAL.ice, 3, 0.7, 40 + r.y);
      inkPoly([x0, ry + r.h, x0 + r.w, ry + r.h, x0 + r.w, ry + r.h + 8, x0, ry + r.h + 8], PAL.ice2, 3, 0.6, 41 + r.y);
      for (let a = 0; a < 3; a++) { const ax = r.x - 22 + a * 22; inkPoly([ax - 7, ry + 21, ax, ry + 8, ax + 7, ry + 21], PAL.white, 2, 0.4, 42 + a); }
    } });
    for (const g of this.gates) if (g.y > cy - 60 && g.y < bot) list.push({ y: g.y, f: () => {
      const gy = g.y - cy, fd = g.done[i], col = fd ? (g.ok[i] ? PAL.green : '#9a96a0') : g.col;
      if (!fd) { ctx.setLineDash([3, 9]); inkLine([g.cx - g.gap / 2 + 4, gy, g.cx + g.gap / 2 - 4, gy], 2, 'rgba(34,28,46,.25)', 0.3, 50); ctx.setLineDash([]); }
      drawFlag(g.cx - g.gap / 2, gy, col, fd, t, Math.floor(g.y) % 97); drawFlag(g.cx + g.gap / 2, gy, col, fd, t, Math.floor(g.y) % 89 + 3);
    } });
    for (const o of this.obs) { if (o.y < cy - 60) continue; if (o.y > bot) break; list.push({ y: o.y, f: () => o.type === 'tree' ? drawTree(o.x, o.y - cy, o.v) : drawRock(o.x, o.y - cy, o.v) }); }
    const e0 = Math.floor((cy - 40) / 46);
    for (let r = e0; r < e0 + 15; r++) { const yy = r * 46; if (yy < 120 || (yy > this.cz[0] - 40 && yy < this.cz[1] + 30)) continue; list.push({ y: yy, f: () => drawTree(6 + hash(r) * 8, yy - cy, hash(r + 9), 60 + (r % 50)) }); list.push({ y: yy + 20, f: () => drawTree(474 - hash(r + 3) * 8, yy + 20 - cy, hash(r + 5), 120 + (r % 50)) }); }
    const c0 = this.cz[0];
    for (const [yy, x, a, b] of [[c0 - 620, 46, 'CLIFFS', 'AHEAD!'], [c0 - 620, 434, 'CLIFFS', 'AHEAD!'], [c0 - 330, 40, 'TUCK', '& FLY!'], [c0 - 330, 440, 'TUCK', '& FLY!']])
      if (yy > cy - 60 && yy < bot) list.push({ y: yy, f: () => this.drawSign(x, yy - cy, a, b, yy + x) });
    for (let j = 0; j < 2; j++) {
      const q = this.sk[j], al = j === i ? 1 : 0.35;
      list.push({ y: q.y + (j === i ? 0.1 : 0), f: () => {
        if (q.fall > 0) { this.drawFall(q, j, cy, t, al); return; }
        const blink = q.ghost > 0 && Math.floor(q.ghost * 12) % 2 === 0;
        if (q.cliff && j === i) this.drawTarget(q, cy);
        drawSkier(q.x, q.y - cy, q.cliff ? q.z * 0.6 : q.z, q.ang, j, { tuck: q.tuck, crash: q.crash > 0, t, spd: q.spd, noShadow: !this.solid(q.x, q.y), alpha: blink ? al * 0.4 : al });
      } });
    }
    list.sort((a, b) => a.y - b.y).forEach(d => d.f());
    this.parts[i].draw(0, cy); drawPops(this.pops[i], 0, cy);
    // HUD
    hudTag(8, 8, 206, 76, 60 + i);
    ttxt(PN[i], 24, 30, 24, PC[i], 'left');
    const tm = s.fin != null ? s.fin : s.dnf ? Infinity : this.t + s.pen;
    txt(fmtT(tm), 200, 30, 22, s.fin != null ? PAL.red : INK, 'right', false);
    txt(Math.round(s.spd * 0.13) + ' km/h', 24, 62, 17, PAL.wood2, 'left', false);
    if (s.pen) txt('+' + s.pen + 's', 200, 62, 16, PAL.red, 'right', false);
    if (this.cut && s.fin == null && this.phase === 'play') ttxt('HURRY! ' + Math.max(0, this.cut - this.t).toFixed(1), 240, 112, 24, PAL.red);
  }
}
