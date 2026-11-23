'use strict';
// Hand-drawn cartoon style: wobbly ink outlines that "boil" (re-jitter at 12 fps), pie-cut eyes,
// rubber-hose limbs, paper cards. Everything is drawn in code.
const INK = '#221c2e';
const PAL = {
  paper: '#fbf3df', paper2: '#f1e2bd', snow: '#fdfbf6', snow2: '#e6eef6', snowShade: '#cddcec', hatch: '#b8cbe0',
  ice: '#aad6f2', ice2: '#7bb6e0', pine: '#3f7a55', pine2: '#5b9c66', pineDark: '#2d5a40', trunk: '#8a5a33',
  rock: '#a7a19a', rock2: '#827c76', skin: '#f7d3a6', cheek: '#ef8f78', yellow: '#ffd84a', orange: '#ff9a3c',
  green: '#78c264', red: '#e8553f', wood: '#a06c3c', wood2: '#7a4f2b', sky1: '#86c1ea', sky2: '#fbe6c2', white: '#fffdf7',
};
const FONT = '"Fredoka", "Trebuchet MS", sans-serif';
const FONT_T = '"Luckiest Guy", "Fredoka", Impact, sans-serif';
let BOIL = 0;   // ink boil phase (cycles 0..2)
const WOB = 0.4;   // how much the ink lines wiggle (1 = very sketchy)

function jit(k, a) { return (hash(k * 13.37 + BOIL * 71.3) - 0.5) * 2 * a * WOB; }

// Sprite cache: static ink drawings are rendered once per boil phase into an offscreen canvas
// at the current pixel scale, then blitted. Keeps the hand-drawn look but saves most stroke work.
const SPR = new Map(); let sprK = 0;
function sprite(key, w, h, ox, oy, fn) {
  if (sprK !== K) { SPR.clear(); sprK = K; }
  const k = key + '|' + BOIL; let c = SPR.get(k);
  if (!c) {
    c = document.createElement('canvas'); c.width = Math.ceil(w * K); c.height = Math.ceil(h * K);
    const old = ctx; ctx = c.getContext('2d'); ctx.setTransform(K, 0, 0, K, ox * K, oy * K);
    try { fn(); } finally { ctx = old; }
    SPR.set(k, c);
  }
  return c;
}
function blit(key, x, y, w, h, ox, oy, fn) { ctx.drawImage(sprite(key, w, h, ox, oy, fn), x - ox, y - oy, w, h); }
function stroke(lw, col = INK) { ctx.lineWidth = lw; ctx.strokeStyle = col; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.stroke(); }
function inkPoly(pts, fill, lw = 3, amp = 0.8, seed = 0) {
  ctx.beginPath();
  for (let i = 0; i < pts.length; i += 2) { const x = pts[i] + jit(seed + i, amp), y = pts[i + 1] + jit(seed + i + 1, amp); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
  ctx.closePath(); if (fill) { ctx.fillStyle = fill; ctx.fill(); } if (lw) stroke(lw);
}
// closed organic shape: smooth curve through jittered points
function blobPoly(pts, fill, lw = 3, amp = 0.8, seed = 0) {
  const n = pts.length / 2, P = [];
  for (let i = 0; i < n; i++) P.push([pts[i * 2] + jit(seed + i * 2, amp), pts[i * 2 + 1] + jit(seed + i * 2 + 1, amp)]);
  ctx.beginPath();
  const m = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  let s = m(P[n - 1], P[0]); ctx.moveTo(s[0], s[1]);
  for (let i = 0; i < n; i++) { const c = P[i], e = m(P[i], P[(i + 1) % n]); ctx.quadraticCurveTo(c[0], c[1], e[0], e[1]); }
  ctx.closePath(); if (fill) { ctx.fillStyle = fill; ctx.fill(); } if (lw) stroke(lw);
}
function inkLine(pts, lw = 3, col = INK, amp = 0.6, seed = 0) {
  ctx.beginPath();
  for (let i = 0; i < pts.length; i += 2) { const x = pts[i] + jit(seed + i, amp), y = pts[i + 1] + jit(seed + i + 1, amp); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
  stroke(lw, col);
}
function inkCurve(x0, y0, cx, cy, x1, y1, lw = 3, col = INK, seed = 0) {
  ctx.beginPath(); ctx.moveTo(x0 + jit(seed, 0.5), y0 + jit(seed + 1, 0.5));
  ctx.quadraticCurveTo(cx + jit(seed + 2, 1), cy + jit(seed + 3, 1), x1 + jit(seed + 4, 0.5), y1 + jit(seed + 5, 0.5));
  stroke(lw, col);
}
function inkEllipse(x, y, rx, ry, fill, lw = 3, seed = 0, rot = 0) {
  ctx.beginPath();
  ctx.ellipse(x + jit(seed, 0.5), y + jit(seed + 1, 0.5), Math.max(0.5, rx + jit(seed + 2, rx * 0.04 + 0.3)), Math.max(0.5, ry + jit(seed + 3, ry * 0.04 + 0.3)), rot, 0, Math.PI * 2);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); } if (lw) stroke(lw);
}
// cluster of circles with one shared outline (clouds, snow puffs, bushes)
function blobs(list, fill, lw = 3, seed = 0) {
  ctx.beginPath();
  list.forEach(([x, y, r], i) => { const rr = Math.max(0.5, r + jit(seed + i + 4, 0.5)), cx = x + jit(seed + i, 0.6), cy = y + jit(seed + i + 9, 0.6); ctx.moveTo(cx + rr, cy); ctx.arc(cx, cy, rr, 0, Math.PI * 2); });
  if (lw) stroke(lw * 2); ctx.fillStyle = fill; ctx.fill();
}
function shadow(x, y, rx, ry, a = 0.2) { ctx.fillStyle = `rgba(60,70,120,${a})`; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fill(); }

function txt(s, x, y, size, color, align = 'center', outline = true, font = FONT) {
  ctx.font = `700 ${size}px ${font}`; ctx.textAlign = align; ctx.textBaseline = 'middle';
  if (outline) { ctx.lineJoin = 'round'; ctx.lineWidth = Math.max(3, size * 0.2); ctx.strokeStyle = INK; ctx.strokeText(s, x, y); }
  ctx.fillStyle = color; ctx.fillText(s, x, y);
}
const ttxt = (s, x, y, size, color, align = 'center') => txt(s, x, y, size, color, align, true, FONT_T);
// paper card with wobbly outline and drop shadow
function card(x, y, w, h, fill = PAL.paper, seed = 0, r = 14) {
  const n = Math.max(3, Math.round(w / 90)), m = Math.max(2, Math.round(h / 90)), pts = [];
  for (let i = 0; i <= n; i++) pts.push([x + r + (w - 2 * r) * i / n, y]);
  pts.push([x + w - r * 0.3, y + r * 0.3]);
  for (let i = 0; i <= m; i++) pts.push([x + w, y + r + (h - 2 * r) * i / m]);
  pts.push([x + w - r * 0.3, y + h - r * 0.3]);
  for (let i = 0; i <= n; i++) pts.push([x + w - r - (w - 2 * r) * i / n, y + h]);
  pts.push([x + r * 0.3, y + h - r * 0.3]);
  for (let i = 0; i <= m; i++) pts.push([x, y + h - r - (h - 2 * r) * i / m]);
  pts.push([x + r * 0.3, y + r * 0.3]);
  const path = () => { ctx.beginPath(); pts.forEach(([px, py], i) => { const jx = px + jit(seed + i, 1), jy = py + jit(seed + i + 50, 1); i ? ctx.lineTo(jx, jy) : ctx.moveTo(jx, jy); }); ctx.closePath(); };
  path(); ctx.save(); ctx.translate(5, 6); ctx.fillStyle = 'rgba(34,28,46,0.35)'; ctx.fill(); ctx.restore();
  path(); ctx.fillStyle = fill; ctx.fill(); stroke(4);
}
// classic 1930s pie-cut eye
function pieEye(x, y, s, lx = 0, ly = 0, blink = false, seed = 0) {
  if (blink) { inkLine([x - s * 0.6, y, x + s * 0.6, y], Math.max(2, s * 0.3), INK, 0.3, seed); return; }
  inkEllipse(x, y, s * 0.62, s, PAL.white, Math.max(1.5, s * 0.22), seed);
  const px = x + lx * s * 0.22, py = y + s * 0.15 + ly * s * 0.2;
  ctx.fillStyle = INK; ctx.beginPath(); ctx.ellipse(px, py, s * 0.36, s * 0.64, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = PAL.white; ctx.beginPath(); ctx.moveTo(px + s * 0.05, py - s * 0.1); ctx.lineTo(px + s * 0.4, py - s * 0.6); ctx.lineTo(px + s * 0.42, py - s * 0.1); ctx.closePath(); ctx.fill();
}
function xEye(x, y, s, seed) { inkLine([x - s * 0.5, y - s * 0.5, x + s * 0.5, y + s * 0.5], 2.2, INK, 0.3, seed); inkLine([x + s * 0.5, y - s * 0.5, x - s * 0.5, y + s * 0.5], 2.2, INK, 0.3, seed + 3); }
function dizzy(x, y, t, r = 14) { for (let k = 0; k < 3; k++) { const a = t * 5 + k * 2.09; star(x + Math.cos(a) * r, y + Math.sin(a) * r * 0.35, 5, PAL.yellow, k); } }
function star(x, y, r, fill, seed = 0) { const p = []; for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5, rr = k % 2 ? r * 0.45 : r; p.push(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } inkPoly(p, fill, 1.6, 0.3, seed); }
// beanie hat with pompom (cx, y = brim line)
function beanie(x, y, col, dark, seed, f = 0) {
  blobPoly([x - 13, y + 1, x - 13, y - 9, x - 7, y - 16, x + 7, y - 16, x + 13, y - 9, x + 13, y + 1], col, 2.6, 0.5, seed);
  inkPoly([x - 14, y - 1, x + 14, y - 1, x + 14, y + 5, x - 14, y + 5], dark, 2.4, 0.5, seed + 9);
  blobs([[x + f * 3, y - 18, 5]], PAL.white, 1.3, seed + 20);
}

/* ---------- characters ---------- */
// Skier, front 3/4 view (they ski toward the viewer). x,y = feet on snow, z = air height, ang = heading.
// o: {tuck, crash, alpha, t, spd, noShadow, scared, sign, scale, rot}
function drawSkier(x, y, z, ang, i, o = {}) {
  const col = PC[i], dark = PCD[i], seed = i * 100, t = o.t || 0, A = o.alpha == null ? 1 : o.alpha;
  const PANTS = i ? '#2f3a66' : '#4a2f45', MITT = PAL.yellow, BOOT = '#3a2f3a';
  if (!o.noShadow) shadow(x + z * 0.3, y + 2 + z * 0.1, 17 + z * 0.03, 5.5);
  ctx.save(); ctx.globalAlpha = A;
  ctx.translate(x, y - z); const sc = (o.scale || 1) * (1 + z / 260); ctx.scale(sc, sc); if (o.rot) ctx.rotate(o.rot);
  if (o.crash) {
    // tumbled in a heap: skis crossed, boots up, dizzy stars
    for (const [a0, a1, b0, b1, k] of [[-24, -4, 22, 7, 1], [-18, 10, 24, -7, 2]]) { inkLine([a0, a1, b0, b1], 6.5, INK, 0.3, seed + k); inkLine([a0, a1, b0, b1], 3.4, PAL.yellow, 0.2, seed + k + 2); }
    blobs([[-12, -6, 9], [0, -10, 11], [12, -5, 8]], PAL.white, 1.6, seed + 5);
    inkCurve(-6, -10, -14, -22, -18, -28, 7, INK, seed + 6); inkCurve(-6, -10, -14, -22, -18, -28, 4, PANTS, seed + 6);
    blobPoly([-24, -27, -20, -34, -12, -32, -14, -25], BOOT, 2, 0.3, seed + 7);
    inkEllipse(0, -8, 11, 9, col, 2.8, seed + 8);
    inkEllipse(6, -21, 11, 10, PAL.skin, 2.8, seed + 9);
    xEye(2, -22, 5, seed + 10); xEye(11, -22, 5, seed + 11);
    beanie(6, -28, col, dark, seed + 12);
    dizzy(6, -44, t, 17);
    ctx.restore(); return;
  }
  const dx = Math.sin(ang), dy = Math.cos(ang) * 0.55;          // ski direction in screen space
  const tuck = o.tuck ? 1 : 0, scared = !!o.scared;
  // --- skis with curled tips, bindings, boots
  for (const s of [-1, 1]) {
    const ox = s * 7 * (Math.abs(dy) + 0.35), oy = s * 2 * dx;
    const tx = ox + dx * 25, ty = oy + dy * 25, bx = ox - dx * 17, by = oy - dy * 17;
    inkLine([bx, by, tx, ty], 7, INK, 0.2, seed + 10 + s);
    inkLine([bx, by, tx, ty], 3.8, PAL.yellow, 0.15, seed + 12 + s);
    inkLine([bx + dx * 4, by + dy * 4, tx - dx * 6, ty - dy * 6], 1.3, PAL.red, 0.15, seed + 14 + s);   // racing stripe
    ctx.beginPath(); ctx.moveTo(tx, ty); ctx.quadraticCurveTo(tx + dx * 5, ty + dy * 5 - 1, tx + dx * 4, ty + dy * 4 - 6); stroke(4.5);   // curled tip
    blobPoly([ox - 5, oy + 2, ox - 5, oy - 7, ox, oy - 9, ox + 5, oy - 7, ox + 5, oy + 2, ox, oy + 3], BOOT, 2.2, 0.3, seed + 16 + s);  // boot
    inkLine([ox - 5, oy - 3, ox + 5, oy - 3], 1.6, '#8a8494', 0.2, seed + 18 + s);   // buckle
  }
  const lean = ang * 0.35, hipY = -17 + tuck * 6;
  ctx.rotate(lean * 0.4);
  // --- scarf tails flutter behind (drawn first so they sit behind the body)
  const wind = clamp((o.spd || 300) / 600, 0.3, 1.4), fl = Math.sin(t * 14) * 3 * wind;
  const ny = hipY - 23 + tuck * 3;
  for (const k of [0, 1]) {
    const ex = 9 + k * 5 + wind * 5, ey = ny - 6 - wind * 6 + fl * (k ? -1 : 1) + k * 3;
    blobPoly([3, ny - 1, ex * 0.6, ny - 3 + fl * 0.4, ex, ey, ex + 3.5, ey + 3, ex * 0.6 + 2, ny + 1 + fl * 0.4, 4, ny + 3], PAL.red, 1.8, 0.3, seed + 20 + k);
    inkLine([ex * 0.55, ny - 3 + fl * 0.4, ex * 0.55 + 2, ny + 1 + fl * 0.4], 1.3, PAL.white, 0.1, seed + 22 + k);
  }
  // --- legs (puffy pants)
  for (const s of [-1, 1]) { inkCurve(s * 5, hipY, s * 7.5, hipY / 2, s * 6, -6, 9, INK, seed + 24 + s); inkCurve(s * 5, hipY, s * 7.5, hipY / 2, s * 6, -6, 5.5, PANTS, seed + 24 + s); }
  // --- poles with grips and baskets
  const poleBack = tuck ? -1 : 0.3;
  for (const s of [-1, 1]) {
    const gx = s * 16, gy = hipY - 7 + tuck * 4, ex = s * (19 + tuck * 2), ey = 7 - poleBack * 14;
    inkLine([gx, gy, ex, ey], 2.2, '#5b5560', 0.2, seed + 30 + s);
    inkEllipse(gx + (ex - gx) * 0.86, gy + (ey - gy) * 0.86, 4, 1.6, null, 1.4, seed + 32 + s);
  }
  // --- jacket (bean), collar, zip, pocket, number bib
  ctx.save(); ctx.translate(0, hipY); if (tuck) ctx.scale(1.1, 0.82);
  inkEllipse(0, -11, 12, 14.5, col, 3, seed + 40);
  ctx.save(); ctx.beginPath(); ctx.ellipse(0, -11, 11, 13.5, 0, 0, Math.PI * 2); ctx.clip();
  ctx.fillStyle = dark; ctx.fillRect(-14, -1, 28, 6);                                // waist band
  ctx.restore();
  inkPoly([-6.5, -18, 6.5, -18, 5.5, -6, -5.5, -6], PAL.white, 1.8, 0.2, seed + 41);   // bib
  txt(String(i + 1), 0, -11.5, 9, INK, 'center', false);
  inkLine([0, -24, 0, -18], 1.3, dark, 0.2, seed + 42);                                // zip
  // arms (sleeves) + mittens
  for (const s of [-1, 1]) {
    const up = o.sign && s === 1;
    const hx = up ? 13 : s * 16, hy = up ? -40 : -6 + tuck * 2;
    inkCurve(s * 8, -19, s * (up ? 14 : 17), up ? -28 : -14, hx, hy, 7.5, INK, seed + 43 + s);
    inkCurve(s * 8, -19, s * (up ? 14 : 17), up ? -28 : -14, hx, hy, 4.2, col, seed + 43 + s);
    inkEllipse(hx, hy, 4.6, 4.2, MITT, 2, seed + 45 + s);
  }
  if (o.sign) {   // Coyote-style little sign on a stick
    inkLine([13, -40, 13, -62], 2.2, PAL.wood2, 0.2, seed + 47);
    inkPoly([-12, -84, 38, -84, 38, -62, -12, -62], PAL.paper, 2.2, 0.4, seed + 48);
    txt(o.sign, 13, -73, 10, INK, 'center', false);
  }
  ctx.restore();
  // --- neck scarf wrap
  blobPoly([-9, ny - 3, 9, ny - 3, 10, ny + 3, -10, ny + 3], PAL.red, 2.2, 0.3, seed + 50);
  inkLine([-4, ny - 3, -5, ny + 3], 1.4, PAL.white, 0.2, seed + 51); inkLine([3, ny - 3, 2, ny + 3], 1.4, PAL.white, 0.2, seed + 52);
  // --- head
  const hy = hipY - 35 + tuck * 10, look = clamp(dx * 2, -1, 1);
  inkEllipse(0, hy, 12.5, 11.5, PAL.skin, 3, seed + 53);
  ctx.fillStyle = PAL.cheek; ctx.globalAlpha = A * 0.6; ctx.beginPath(); ctx.arc(-7.5 + look * 2, hy + 4.5, 2.6, 0, 7); ctx.arc(7.5 + look * 2, hy + 4.5, 2.6, 0, 7); ctx.fill(); ctx.globalAlpha = A;
  if (scared) {   // big round "uh-oh" eyes, wobbly mouth
    for (const s of [-1, 1]) { inkEllipse(s * 5 + look * 2, hy - 1, 4.6, 5.6, PAL.white, 1.8, seed + 54 + s); ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(s * 5 + look * 2, hy, 1.5, 0, 7); ctx.fill(); }
    inkLine([-4, hy + 7, -2, hy + 6, 0, hy + 7, 2, hy + 6, 4, hy + 7], 1.6, INK, 0.2, seed + 56);
  } else {
    const bl = hash(Math.floor(t * 3) + seed) < 0.05;
    pieEye(-4.5 + look * 3, hy - 1, 4.4, look, 0.6, bl, seed + 54); pieEye(5 + look * 3, hy - 1, 4.4, look, 0.6, bl, seed + 55);
    if (tuck) { ctx.beginPath(); ctx.moveTo(-4 + look * 3, hy + 5); ctx.quadraticCurveTo(look * 3, hy + 11, 4 + look * 3, hy + 5); ctx.closePath(); ctx.fillStyle = '#7a2f2a'; ctx.fill(); stroke(1.6); inkLine([-3 + look * 3, hy + 5.6, 3 + look * 3, hy + 5.6], 1.6, PAL.white, 0.1, seed + 57); }
    else { ctx.beginPath(); ctx.arc(look * 3, hy + 5, 3.5, 0.15 * Math.PI, 0.85 * Math.PI); stroke(2); }
  }
  inkEllipse(0.5 + look * 4, hy + 2.5, 2.2, 1.8, PAL.cheek, 1.4, seed + 58);           // nose
  // --- beanie with stripe, goggles pushed up on it
  beanie(0, hy - 8.5, col, dark, seed + 60, -look);
  inkLine([-12.5, hy - 16, 12.5, hy - 16], 2.2, INK, 0.2, seed + 62);                       // goggle strap
  for (const s of [-1, 1]) { inkEllipse(s * 5.5 + look * 2, hy - 16.5, 5, 3.6, PAL.orange, 1.8, seed + 63 + s); ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.fillRect(s * 5.5 + look * 2 - 3, hy - 18.5, 2.2, 1.6); }
  ctx.restore();
}

// Rubber-hose kid for the snowball fight (top-down 3/4). p: {x,y,fx,fy,charging,charge,walk,inv,stun,scoop}
function drawKid(p, i, t = 0) {
  const x = p.x, y = p.y, col = PC[i], dark = PCD[i], seed = 300 + i * 100;
  ctx.save();
  if (p.inv > 0 && Math.floor(p.inv * 14) % 2 === 0) ctx.globalAlpha = 0.45;
  shadow(x, y + 1, 16, 6);
  const crouch = p.scoop > 0 ? 7 : 0, ph = p.walk || 0, mv = ph ? 1 : 0, f = p.fx >= 0 ? 1 : -1;
  for (const s of [-1, 1]) {                                        // legs + boots
    const sw = Math.sin(ph + (s > 0 ? 0 : Math.PI)) * 5 * mv, lift = Math.max(0, Math.cos(ph + (s > 0 ? 0 : Math.PI))) * 3 * mv;
    inkCurve(x + s * 5, y - 14 + crouch, x + s * 6, y - 8, x + s * 6 + sw, y - 3 - lift, 4.5, INK, seed + s);
    inkEllipse(x + s * 6 + sw + f * 2, y - 2 - lift, 6, 3.6, '#3a2a30', 2.2, seed + 3 + s);
  }
  inkEllipse(x, y - 21 + crouch, 12, 13, col, 3, seed + 10);         // bean body
  inkLine([x - 11, y - 25 + crouch, x + 11, y - 25 + crouch], 4, dark, 0.5, seed + 11);   // scarf
  inkPoly([x + f * 6, y - 25 + crouch, x + f * 14, y - 16 + crouch, x + f * 9, y - 15 + crouch], dark, 2, 0.5, seed + 12);
  // arms: throwing arm up when charging, otherwise swinging / reaching to ground when scooping
  const hy0 = y - 41 + crouch;
  for (const s of [-1, 1]) {
    let hx, hy;
    if (p.charging && s === -f) { hx = x - f * 10; hy = hy0 - 14 - p.charge * 4; }
    else if (p.scoop > 0) { hx = x + s * 10 + p.fx * 8; hy = y - 4; }
    else { hx = x + s * 16 + p.fx * 4; hy = y - 16 + crouch + p.fy * 4 + Math.sin(ph + s) * 2 * mv; }
    inkCurve(x + s * 9, y - 28 + crouch, (x + s * 9 + hx) / 2 + s * 5, (y - 28 + hy) / 2 + 4, hx, hy, 4, INK, seed + 20 + s);
    inkEllipse(hx, hy, 5, 4.6, dark, 2.2, seed + 22 + s);
  }
  if (p.charging) { const r = 4 + p.charge * 4; inkEllipse(x - f * 10, hy0 - 18 - p.charge * 4, r, r, PAL.white, 2, seed + 30); }
  inkEllipse(x, hy0, 12, 11, PAL.skin, 3, seed + 40);                 // head
  ctx.fillStyle = PAL.cheek; ctx.globalAlpha *= 0.6; ctx.beginPath(); ctx.arc(x - 7 + p.fx * 3, hy0 + 5, 2.6, 0, 7); ctx.arc(x + 7 + p.fx * 3, hy0 + 5, 2.6, 0, 7); ctx.fill(); ctx.globalAlpha = 1;
  if (p.stun > 0) { xEye(x - 4 + p.fx * 3, hy0, 5, seed + 41); xEye(x + 5 + p.fx * 3, hy0, 5, seed + 42); inkEllipse(x + p.fx * 3, hy0 + 6, 2.5, 3, '#7a2f2a', 1.6, seed + 43); }
  else if (p.fy > -0.6) {
    const bl = hash(Math.floor(t * 3) + seed) < 0.05;
    pieEye(x - 4 + p.fx * 4, hy0, 4.4, p.fx, p.fy, bl, seed + 44); pieEye(x + 5 + p.fx * 4, hy0, 4.4, p.fx, p.fy, bl, seed + 45);
    ctx.beginPath(); if (p.charging) ctx.arc(x + p.fx * 4, hy0 + 7, 3, 0, Math.PI * 2); else ctx.arc(x + p.fx * 4, hy0 + 5, 3.5, 0.15 * Math.PI, 0.85 * Math.PI); stroke(2);
  }
  beanie(x, hy0 - 6, col, dark, seed + 50, -p.fx);
  if (p.charging) { ctx.beginPath(); ctx.arc(x, y - 20, 25, -Math.PI / 2, -Math.PI / 2 + p.charge * 6.283); stroke(4, p.charge >= 1 ? PAL.yellow : PAL.white); }
  if (p.stun > 0) dizzy(x, hy0 - 16, t, 15);
  ctx.restore();
}

// Snowboarder, side view in local coords: board at y=0, "up" = -y. Facing +x.
function drawBoarder(i, o = {}) {
  const col = PC[i], dark = PCD[i], seed = 600 + i * 100, t = o.t || 0;
  inkPoly([-24, -3, 24, -3, 27, 0, 24, 4, -24, 4, -27, 0], PAL.yellow, 2.6, 0.4, seed);
  inkLine([-14, 0.5, 14, 0.5], 2, PAL.orange, 0.3, seed + 1);
  if (o.crash) {
    blobs([[-12, -6, 8], [0, -8, 10], [12, -6, 8]], PAL.white, 1.5, seed + 2);
    inkEllipse(-2, -12, 14, 8, col, 2.8, seed + 3);
    inkEllipse(16, -14, 10, 9, PAL.skin, 2.8, seed + 4);
    xEye(14, -16, 4.5, seed + 5); xEye(21, -16, 4.5, seed + 6);
    dizzy(16, -30, t, 14); return;
  }
  const c = o.grab ? 10 : o.pump ? 6 : 0;
  for (const s of [-1, 1]) inkCurve(s * 9, -3, s * 10 + 6, -12 + c * 0.5, s * 4, -20 + c, 5, INK, seed + 10 + s);   // bent knees
  ctx.save(); ctx.translate(0, -20 + c);
  inkEllipse(0, -12, 11, 14, col, 3, seed + 20);
  inkLine([-10, -8, 10, -8], 3, dark, 0.4, seed + 21);
  if (o.grab) { inkCurve(6, -18, 18, -6, 14, 18 - c, 4, INK, seed + 22); inkEllipse(14, 18 - c, 4.5, 4, dark, 2, seed + 23); inkCurve(-6, -18, -18, -26, -22, -32, 4, INK, seed + 24); inkEllipse(-22, -32, 4.5, 4, dark, 2, seed + 25); }
  else { const wv = Math.sin(t * 6) * 3; inkCurve(-7, -18, -16, -26, -26, -20 + wv, 4, INK, seed + 22); inkEllipse(-26, -20 + wv, 4.5, 4, dark, 2, seed + 23); inkCurve(7, -18, 16, -26, 26, -22 - wv, 4, INK, seed + 24); inkEllipse(26, -22 - wv, 4.5, 4, dark, 2, seed + 25); }
  const hy = -36;
  inkEllipse(3, hy, 12, 11, PAL.skin, 3, seed + 30);
  pieEye(6, hy - 1, 4.4, 1, 0, false, seed + 31); pieEye(13, hy - 1, 4.4, 1, 0, false, seed + 32);
  ctx.beginPath(); if (o.grab) ctx.arc(10, hy + 6, 3.2, 0, 7); else ctx.arc(9, hy + 4, 4, 0.1 * Math.PI, 0.8 * Math.PI); stroke(2);
  // helmet + goggles strap
  blobPoly([-9, hy - 2, -9, hy - 10, -3, hy - 15, 9, hy - 15, 15, hy - 9, 15, hy - 5], dark, 2.6, 0.4, seed + 33);
  inkLine([-9, hy - 4, 15, hy - 6], 2.2, PAL.orange, 0.3, seed + 34);
  ctx.restore();
}

/* ---------- scenery props ---------- */
function drawTree(x, y, v, seed = 0) {
  const vq = Math.round(clamp(v, 0, 1) * 4) / 4, sv = (seed || Math.floor(v * 997)) % 5;
  blit('tree' + vq + '_' + sv, x, y, 100, 104, 50, 88, () => drawTreeInk(0, 0, vq, 11 + sv * 37));
}
function drawTreeInk(x, y, v, seed) {
  const s = 0.85 + v * 0.45;
  shadow(x + 8, y + 3, 19 * s, 6 * s);
  inkPoly([x - 3.5 * s, y + 1, x - 3.5 * s, y - 10 * s, x + 3.5 * s, y - 10 * s, x + 3.5 * s, y + 1], PAL.trunk, 2.2, 0.4, seed);
  for (let k = 0; k < 3; k++) {
    const by = y - 7 * s - k * 12 * s, hw = (21 - k * 5) * s, top = by - 21 * s;
    blobPoly([x - hw, by, x - hw * 0.55, by - 3 * s, x - hw * 0.28, top + 9 * s, x, top, x + hw * 0.28, top + 9 * s, x + hw * 0.55, by - 3 * s, x + hw, by, x, by + 3 * s], k % 2 ? PAL.pine2 : PAL.pine, 2.6, 0.7, seed + k * 20);
    blobPoly([x - hw * 0.42, top + 12 * s, x - hw * 0.15, top + 5 * s, x, top + 1, x + hw * 0.15, top + 5 * s, x + hw * 0.42, top + 12 * s, x + hw * 0.1, top + 9 * s, x - hw * 0.1, top + 11 * s], PAL.white, 1.8, 0.5, seed + k * 20 + 9);
  }
}
function drawRock(x, y, v, seed = 0) {
  const vq = Math.round(clamp(v, 0, 1) * 3) / 3, sv = (seed || Math.floor(v * 991)) % 3;
  blit('rock' + vq + '_' + sv, x, y, 64, 44, 26, 30, () => drawRockInk(0, 0, vq, 7 + sv * 29));
}
function drawRockInk(x, y, v, seed) {
  shadow(x + 5, y + 2, 17, 5);
  blobPoly([x - 15, y + 2, x - 13, y - 8, x - 4, y - 15 - v * 4, x + 8, y - 12, x + 15, y - 3, x + 13, y + 3], PAL.rock, 2.8, 0.6, seed);
  inkCurve(x - 3, y - 12, x - 1, y - 5, x + 3, y + 1, 1.5, INK, seed + 4);
  blobPoly([x - 10, y - 9, x - 4, y - 15 - v * 4, x + 7, y - 12, x + 3, y - 8, x - 3, y - 10], PAL.white, 1.6, 0.4, seed + 9);
}
function drawFlag(x, y, col, faded, t, seed) {
  ctx.save(); if (faded) ctx.globalAlpha = 0.4;
  shadow(x + 3, y + 1, 7, 2.5);
  inkLine([x, y, x + 0.5, y - 38], 3, INK, 0.4, seed);
  const w = Math.sin(t * 8 + seed) * 3;
  blobPoly([x + 1, y - 38, x + 10, y - 36 + w * 0.3, x + 19, y - 33 + w, x + 10, y - 29 - w * 0.3, x + 1, y - 26], col, 2.2, 0.4, seed + 3);
  ctx.restore();
}
function drawCloud(x, y, s, seed) {
  const sq = Math.round(s * 10) / 10, sv = seed % 4;
  blit('cloud' + sq + '_' + sv, x, y, 110 * sq + 16, 70 * sq + 16, 50 * sq + 8, 40 * sq + 8, () => drawCloudInk(0, 0, sq, 730 + sv * 20));
}
function drawCloudInk(x, y, s, seed) { blobs([[x - 30 * s, y, 18 * s], [x - 8 * s, y - 12 * s, 24 * s], [x + 20 * s, y - 4 * s, 20 * s], [x + 38 * s, y + 4 * s, 13 * s], [x + 2 * s, y + 6 * s, 18 * s]], PAL.white, 2, seed); }

// Cartoon mountain landscape used on menus / results.
const scenery = { t: 0 };
function drawScenery(t = scenery.t) {
  const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#7dbbe8'); g.addColorStop(0.6, '#c9e4f4'); g.addColorStop(1, PAL.sky2);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  // smiling sun
  const sx = 820, sy = 90;
  ctx.save(); ctx.translate(sx, sy); ctx.rotate(t * 0.2);
  for (let k = 0; k < 12; k++) { const a = k * Math.PI / 6; inkPoly([Math.cos(a - 0.12) * 44, Math.sin(a - 0.12) * 44, Math.cos(a) * 62, Math.sin(a) * 62, Math.cos(a + 0.12) * 44, Math.sin(a + 0.12) * 44], PAL.yellow, 2.2, 0.6, 700 + k); }
  ctx.restore();
  inkEllipse(sx, sy, 40, 40, PAL.yellow, 3.2, 720);
  pieEye(sx - 12, sy - 6, 7, -0.5, 0.3, hash(Math.floor(t * 2)) < 0.06, 721); pieEye(sx + 10, sy - 6, 7, -0.5, 0.3, hash(Math.floor(t * 2)) < 0.06, 722);
  ctx.beginPath(); ctx.arc(sx, sy + 8, 14, 0.15 * Math.PI, 0.85 * Math.PI); stroke(3);
  for (let k = 0; k < 4; k++) drawCloud(((k * 290 + t * (14 + k * 4)) % (W + 260)) - 130, 70 + k * 38, 0.7 + (k % 2) * 0.3, 730 + k * 20);
  blit('scenery', 0, 0, W, H, 0, 0, () => {
    mountains(330, 170, 1.3, '#9aa6dd', 800);
    mountains(400, 130, 4.1, '#7b86c6', 840);
    mountains(470, 90, 7.7, '#5d68ad', 880);
    // snowy foreground with pines
    blobPoly([-20, 560, -20, 500, 120, 486, 300, 496, 480, 482, 660, 494, 820, 484, 980, 494, 980, 560], PAL.snow, 3, 1, 900);
    for (let k = 0; k < 9; k++) drawTreeInk(30 + k * 112 + (k % 2) * 30, 520 + (k % 3) * 8, hash(k + 3) * 0.6, 920 + k * 13);
  });
}
function mountains(base, amp, seed, col, s0) {
  const pts = [];
  for (let x = -40; x <= W + 40; x += 48) pts.push(x, base - amp * (0.55 + 0.45 * Math.sin(x * 0.006 + seed) * Math.sin(x * 0.0131 + seed * 2.3)) - amp * 0.35 * Math.abs(Math.sin(x * 0.019 + seed)));
  const poly = [-40, H + 10, ...pts, W + 40, H + 10];
  inkPoly(poly, col, 3, 1, s0);
  // snow caps: short wavy strip under each ridge peak
  for (let i = 2; i < pts.length - 2; i += 2) {
    const x = pts[i], y = pts[i + 1], yl = pts[i - 1], yr = pts[i + 3];
    if (y < yl && y < yr) blobPoly([pts[i - 2] * 0.5 + x * 0.5, (yl + y) / 2, x, y, pts[i + 2] * 0.5 + x * 0.5, (yr + y) / 2, x + 8, y + 18, x, y + 12, x - 8, y + 20], PAL.white, 2, 0.6, s0 + i);
  }
}
const flakes = Array.from({ length: 110 }, () => ({ x: rand(0, W), y: rand(0, H), r: rand(1.5, 3.5), s: rand(20, 60), w: rand(0, 6) }));
function updFlakes(dt) { scenery.t += dt; for (const f of flakes) { f.y += f.s * dt; f.w += dt; f.x += Math.sin(f.w) * 15 * dt; if (f.y > H + 5) { f.y = -5; f.x = rand(0, W); } } }
function drawFlakes() { ctx.fillStyle = PAL.white; ctx.strokeStyle = 'rgba(34,28,46,.35)'; ctx.lineWidth = 1; for (const f of flakes) { ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, 6.283); ctx.fill(); if (f.r > 2.6) ctx.stroke(); } }

// controller button glyph
const BTN_COL = { A: '#5aa84a', B: '#d0473a', X: '#3f7fd0', Y: '#e3b23c' };
function btn(x, y, name, s = 11) { inkEllipse(x, y, s, s, BTN_COL[name] || '#555', 2.4, name.charCodeAt(0)); txt(name, x, y + 1, s * 1.1, PAL.white, 'center', false); }
function drawPad(x, y, s) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  blobPoly([-80, 10, -70, -24, -40, -30, 40, -30, 70, -24, 80, 10, 66, 34, 40, 26, 20, 14, -20, 14, -40, 26, -66, 34], '#eceaf2', 3, 0.6, 990);
  inkEllipse(-42, -8, 11, 11, '#4a4450', 2.4, 991); inkEllipse(18, 10, 9, 9, '#4a4450', 2.4, 992);
  inkPoly([-28, 6, -10, 6, -10, 12, -28, 12], '#4a4450', 2, 0.3, 993); inkPoly([-22, 0, -16, 0, -16, 18, -22, 18], '#4a4450', 2, 0.3, 994);
  btn(46, 4, 'A', 7); btn(58, -8, 'B', 7); btn(34, -8, 'X', 7); btn(46, -20, 'Y', 7);
  ctx.restore();
}
