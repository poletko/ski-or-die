'use strict';
// EVENT 2 — SNOWBALL BRAWL: top-down arena snowball fight.
function circRect(p, r, w) {
  const nx = clamp(p.x, w.x, w.x + w.w), ny = clamp(p.y, w.y, w.y + w.h);
  let dx = p.x - nx, dy = p.y - ny; const d = Math.hypot(dx, dy);
  if (d > 0 && d < r) { p.x = nx + dx / d * r; p.y = ny + dy / d * r; }
  else if (d === 0) {
    const l = p.x - w.x, rr = w.x + w.w - p.x, t = p.y - w.y, b = w.y + w.h - p.y, m = Math.min(l, rr, t, b);
    if (m === l) p.x = w.x - r; else if (m === rr) p.x = w.x + w.w + r; else if (m === t) p.y = w.y - r; else p.y = w.y + w.h + r;
  }
}
class Brawl extends EventBase {
  constructor() {
    super('SNOWBALL BRAWL', 'brawl', [
      'First to 7 hits wins (90 second limit). Snow forts block shots — and crumble!',
      'Stick: move    Right stick: aim    Ⓐ hold & release: throw (charge it up!)',
      'Ⓑ: dodge dash (brief invincibility)    Ⓧ hold: scoop snow to reload (max 5)']);
    this.ar = { x: 30, y: 70, w: 900, h: 450 };
    this.walls = [{ x: 440, y: 275, w: 80, h: 40 }, { x: 220, y: 150, w: 30, h: 90 }, { x: 710, y: 150, w: 30, h: 90 }, { x: 220, y: 350, w: 30, h: 90 }, { x: 710, y: 350, w: 30, h: 90 }, { x: 440, y: 130, w: 80, h: 24 }, { x: 440, y: 416, w: 80, h: 24 }]
      .map(w => ({ ...w, hp: 5, max: 5 }));
    this.pl = [{ x: 110, y: 295, fx: 1, fy: 0 }, { x: 850, y: 295, fx: -1, fy: 0 }].map(p => ({ ...p, vx: 0, vy: 0, ammo: 5, cd: 0, charge: 0, charging: false, dash: 0, dashCd: 0, stun: 0, inv: 0, hits: 0, scoop: 0, walk: 0 }));
    this.balls = []; this.parts = new Parts(); this.pops = []; this.limit = 90; this.goal = 7;
    this.speck = Array.from({ length: 160 }, (_, k) => [this.ar.x + hash(k) * this.ar.w, this.ar.y + hash(k + 500) * this.ar.h, hash(k + 900)]);
  }
  pop(x, y, t, c, owner) { this.pops.push({ x, y, t, c, life: 1, owner }); }
  play(dt) {
    for (let i = 0; i < 2; i++) this.upd(i, dt);
    // separate players
    const a = this.pl[0], b = this.pl[1], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy);
    if (d > 0 && d < 28) { const o = (28 - d) / 2; a.x -= dx / d * o; a.y -= dy / d * o; b.x += dx / d * o; b.y += dy / d * o; }
    this.updBalls(dt); this.parts.update(dt); updPops(this.pops, dt);
    if (this.phase === 'play' && (this.pl.some(p => p.hits >= this.goal) || this.t >= this.limit)) { this.doneText = this.t >= this.limit ? 'TIME!' : 'KNOCKOUT!'; this.end(); }
  }
  upd(i, dt) {
    const p = this.pl[i], I = inp[i], active = this.phase === 'play';
    p.cd -= dt; p.dashCd -= dt; p.inv -= dt;
    let mx = 0, my = 0;
    if (p.stun > 0) { p.stun -= dt; p.charging = false; p.scoop = 0; }
    else if (active) {
      mx = I.lx; my = I.ly; let ml = Math.hypot(mx, my); if (ml > 1) { mx /= ml; my /= ml; ml = 1; }
      const rl = Math.hypot(I.rx, I.ry);
      if (rl > 0.35) { p.fx = I.rx / rl; p.fy = I.ry / rl; } else if (ml > 0.2) { p.fx = mx / ml; p.fy = my / ml; }
      if (I.x && p.ammo < 5 && !p.charging) { p.scoop += dt; mx = my = 0; if (p.scoop >= 0.45) { p.scoop = 0.001; p.ammo++; sfx.scoop(); this.parts.add(p.x + p.fx * 12, p.y, 5, PAL.white, 60, 0.3, 2); } } else p.scoop = 0;
      if (I.aP) { if (p.ammo > 0 && p.cd <= 0 && p.scoop === 0) { p.charging = true; p.charge = 0; } else if (p.ammo <= 0) { sfx.empty(); if (!this.pops.some(q => q.owner === i)) this.pop(p.x, p.y - 50, 'OUT OF SNOW! hold Ⓧ', PAL.white, i); } }
      if (p.charging) { p.charge = Math.min(1, p.charge + dt * 1.3); if (!I.a) this.throwBall(i); }
      if (I.bP && p.dashCd <= 0) {
        p.charging = false; p.dash = 0.16; p.dashCd = 0.9; p.inv = Math.max(p.inv, 0.25);
        const dx = ml > 0.2 ? mx : p.fx, dy = ml > 0.2 ? my : p.fy, n = Math.hypot(dx, dy) || 1;
        p.vx = dx / n * 650; p.vy = dy / n * 650; sfx.dash(); this.parts.add(p.x, p.y, 8, PAL.white, 80, 0.35, 3);
      }
    }
    const spd = p.charging ? 110 : 225;
    if (p.dash > 0) p.dash -= dt;
    else { const a = Math.min(1, (p.stun > 0 ? 3 : 14) * dt); p.vx += (mx * spd - p.vx) * a; p.vy += (my * spd - p.vy) * a; }
    p.x += p.vx * dt; p.y += p.vy * dt;
    const sp = Math.hypot(p.vx, p.vy); if (sp > 40) p.walk += dt * sp / 25; else p.walk = 0;
    p.x = clamp(p.x, this.ar.x + 15, this.ar.x + this.ar.w - 15); p.y = clamp(p.y, this.ar.y + 15, this.ar.y + this.ar.h - 8);
    for (const w of this.walls) circRect(p, 15, w);
  }
  throwBall(i) {
    const p = this.pl[i], c = p.charge; p.charging = false;
    const speed = 430 + 430 * c, range = 260 + 360 * c;
    this.balls.push({ x: p.x + p.fx * 16, y: p.y - 4 + p.fy * 16, vx: p.fx * speed, vy: p.fy * speed, d: 0, range, r: 5 + 3 * c, o: i, pow: c > 0.8 ? 2 : 1 });
    p.ammo--; p.cd = 0.22; sfx.throw(); rumble(i, 0, 0.25, 60);
  }
  updBalls(dt) {
    for (const b of this.balls) {
      b.x += b.vx * dt; b.y += b.vy * dt; b.d += Math.hypot(b.vx, b.vy) * dt;
      if (b.d >= b.range) { b.dead = 1; this.parts.add(b.x, b.y, 6, PAL.white, 60, 0.35, 2.5); sfx.splat(); continue; }
      if (b.x < this.ar.x || b.x > this.ar.x + this.ar.w || b.y < this.ar.y || b.y > this.ar.y + this.ar.h) { b.dead = 1; this.parts.add(clamp(b.x, 30, 930), clamp(b.y, 70, 520), 6, PAL.white, 60, 0.35, 2.5); continue; }
      for (const w of this.walls) {
        if (b.x > w.x && b.x < w.x + w.w && b.y > w.y && b.y < w.y + w.h) {
          b.dead = 1; w.hp -= b.pow; this.parts.add(b.x, b.y, 10, PAL.white, 120, 0.4, 3); sfx.splat();
          if (w.hp <= 0) { w.dead = 1; this.parts.add(w.x + w.w / 2, w.y + w.h / 2, 34, PAL.white, 220, 0.8, 4); sfx.crumble(); }
          break;
        }
      }
      if (b.dead) continue;
      const ti = 1 - b.o, t = this.pl[ti];
      if (t.inv <= 0 && Math.hypot(t.x - b.x, t.y - 12 - b.y) < 16 + b.r) {
        b.dead = 1; const sh = this.pl[b.o]; if (this.phase === 'play') sh.hits++;
        t.stun = 0.45 + (b.pow - 1) * 0.3; t.inv = 0.9; t.charging = false;
        const n = Math.hypot(b.vx, b.vy); t.vx = b.vx / n * 320 * b.pow; t.vy = b.vy / n * 320 * b.pow;
        sfx.hit(); rumble(ti, 0.9, 0.9, 260);
        this.parts.add(t.x, t.y - 20, 18, PAL.white, 180, 0.5, 3.5);
        this.pop(t.x, t.y - 60, b.pow > 1 ? 'POW!' : 'SPLAT!', PC[b.o]);
      }
    }
    this.balls = this.balls.filter(b => !b.dead); this.walls = this.walls.filter(w => !w.dead);
  }
  result() {
    const h = this.pl.map(p => p.hits);
    return { winner: h[0] > h[1] ? 0 : h[1] > h[0] ? 1 : -1, lines: h.map(x => x + ' hits'), sub: null };
  }
  draw() {
    const ar = this.ar, t = this.rt;
    ctx.fillStyle = '#9fc6e6'; ctx.fillRect(0, 0, W, H);
    // distant pines behind the fence
    for (let k = 0; k < 14; k++) drawTree(20 + k * 72, 70, hash(k + 40) * 0.5, 400 + k * 7);
    const rim = [], N = 10;
    for (let k = 0; k < N; k++) rim.push(ar.x - 8 + (ar.w + 16) * k / N, ar.y - 8 + Math.sin(k * 2.1) * 3);
    for (let k = 0; k < 4; k++) rim.push(ar.x + ar.w + 8 + Math.sin(k * 1.7) * 3, ar.y - 8 + (ar.h + 18) * k / 4);
    for (let k = 0; k < N; k++) rim.push(ar.x + ar.w + 8 - (ar.w + 16) * k / N, ar.y + ar.h + 10 + Math.sin(k * 1.3) * 3);
    for (let k = 0; k < 4; k++) rim.push(ar.x - 8 + Math.sin(k * 2.9) * 3, ar.y + ar.h + 10 - (ar.h + 18) * k / 4);
    inkPoly(rim, PAL.snow, 3.5, 1.2, 401);
    for (const [x, y, v] of this.speck) { ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + 5, y + 3, x + 10 + v * 6, y); stroke(1.5, PAL.hatch); }
    ctx.setLineDash([10, 12]); inkLine([480, ar.y + 6, 480, ar.y + ar.h - 6], 2.5, 'rgba(120,150,190,.5)', 0.6, 402); ctx.setLineDash([]);
    // wooden picket fence (top and bottom rails)
    for (const fy of [ar.y - 6, ar.y + ar.h + 4]) {
      inkLine([ar.x - 4, fy, ar.x + ar.w + 4, fy + 1], 5, PAL.wood2, 0.8, 403 + fy);
      for (let x = ar.x; x <= ar.x + ar.w; x += 50) inkPoly([x - 5, fy + 8, x - 5, fy - 12, x, fy - 18, x + 5, fy - 12, x + 5, fy + 8], PAL.wood, 2.2, 0.5, 410 + x);
    }
    const list = [];
    for (const w of this.walls) list.push({ y: w.y + w.h, f: () => {
      const k = w.hp / w.max, hh = 6 + 16 * k, seed = 500 + w.x + w.y;
      shadow(w.x + w.w / 2 + 6, w.y + w.h + 2, w.w / 2 + 6, 7);
      // front face (snow bricks), top face lighter
      inkPoly([w.x, w.y + w.h - hh * 0.2, w.x + w.w, w.y + w.h - hh * 0.2, w.x + w.w, w.y + w.h + 4, w.x, w.y + w.h + 4], PAL.snowShade, 2.6, 0.6, seed);
      blobPoly([w.x - 2, w.y + w.h - hh * 0.2, w.x - 2, w.y - hh + 6, w.x + w.w * 0.25, w.y - hh, w.x + w.w * 0.75, w.y - hh + 1, w.x + w.w + 2, w.y - hh + 6, w.x + w.w + 2, w.y + w.h - hh * 0.2], PAL.white, 3, 0.8, seed + 7);
      for (let bx = w.x + 16; bx < w.x + w.w - 6; bx += 18) inkLine([bx, w.y - hh + 8, bx + 1, w.y + w.h - hh * 0.3], 1.4, PAL.hatch, 0.5, seed + bx);
      if (k < 0.7) inkLine([w.x + w.w * 0.4, w.y - hh + 5, w.x + w.w * 0.5, w.y - hh / 2, w.x + w.w * 0.42, w.y + 2], 1.8, INK, 0.5, seed + 30);
      if (k < 0.4) inkLine([w.x + w.w * 0.7, w.y - hh + 6, w.x + w.w * 0.62, w.y - hh / 3, w.x + w.w * 0.75, w.y + w.h - 4], 1.8, INK, 0.5, seed + 40);
    } });
    this.pl.forEach((p, i) => list.push({ y: p.y, f: () => {
      drawKid(p, i, t);
      // snowball ammo: white balls on a dark tag in the player's colour so they show up on the snow
      inkPoly([p.x - 28, p.y + 6, p.x + 28, p.y + 6, p.x + 28, p.y + 20, p.x - 28, p.y + 20], PCD[i], 2, 0.3, 590 + i);
      for (let k = 0; k < 5; k++) inkEllipse(p.x - 20 + k * 10, p.y + 13, 4, 4, k < p.ammo ? PAL.white : 'rgba(0,0,0,.25)', k < p.ammo ? 1.4 : 0, 600 + k);
      if (p.ammo === 0) txt('0', p.x, p.y + 13, 11, PAL.yellow, 'center', false);
      if (p.scoop > 0) { ctx.beginPath(); ctx.arc(p.x, p.y - 20, 25, -Math.PI / 2, -Math.PI / 2 + p.scoop / 0.45 * 6.283); stroke(4, PAL.green); }
    } }));
    list.sort((a, b) => a.y - b.y).forEach(d => d.f());
    for (const b of this.balls) {
      const h = Math.sin(Math.PI * b.d / b.range) * (8 + b.range / 40);
      shadow(b.x, b.y + 10, b.r, b.r * 0.5, 0.25);
      inkEllipse(b.x, b.y - h, b.r, b.r, PAL.white, 2, 700 + (b.o * 3));
      ctx.beginPath(); ctx.moveTo(b.x - b.vx * 0.03, b.y - h - b.vy * 0.03); ctx.lineTo(b.x - b.vx * 0.06, b.y - h - b.vy * 0.06); stroke(1.5, 'rgba(34,28,46,.4)');
    }
    for (const p of this.parts.a) { ctx.globalAlpha = Math.max(0, p.life / p.max); inkEllipse(p.x, p.y, p.size, p.size, p.col, p.size > 2.5 ? 1.2 : 0, 0); }
    ctx.globalAlpha = 1;
    drawPops(this.pops);
    // HUD: hit tallies as snowball marks on paper tags
    for (let i = 0; i < 2; i++) {
      hudTag(i ? 600 : 10, 8, 350, 46, 800 + i);
      ttxt(PN[i], i ? 930 : 30, 31, 24, PC[i], i ? 'right' : 'left');
      for (let k = 0; k < this.goal; k++) { const cx = i ? 880 - k * 34 : 80 + k * 34; inkEllipse(cx, 31, 11, 11, k < this.pl[i].hits ? PC[i] : PAL.white, 2.2, 810 + k + i * 10); if (k < this.pl[i].hits) star(cx, 31, 6, PAL.yellow, 830 + k); }
    }
    const left = Math.max(0, this.limit - this.t);
    card(W / 2 - 34, 6, 68, 50, left < 10 ? PAL.red : PAL.yellow, 850, 10);
    ttxt(Math.ceil(left) + '', W / 2, 32, 28, PAL.white);
    this.drawOverlay();
  }
}
