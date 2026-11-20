// labels.js: 2D label canvas with leader lines, collision avoidance, tap picking.
// Editions restyle it with XL.setStyle(), choose labels with XL.setFilter(), name them with XL.setText(),
// and read where every part is on screen with XL.anchors() / XL.pick().
'use strict';
const XL = (() => {
  let cv = null, ctx = null, dpr = 1;
  let boxes = [];       // drawn label boxes in device px, for tap picking
  let marks = [];       // every candidate part this frame: { id, seg, lvl, layer, x, y } in CSS px
  let selected = null;

  // ---------- style ----------
  // pill: null for plain text with a dark halo, or a CSS colour for a rounded plate behind the text.
  const STYLE0 = {
    font: 'system-ui, sans-serif', weight: 400, size: 12,
    color: '#f3eeff', leader: 'rgba(243,238,255,0.55)', sel: '#ff7a90',
    halo: 'rgba(8,7,16,0.8)', haloW: 3,
    pill: null, pillSel: null, pillText: null, pillLine: null, radius: 9, padX: 0, padY: 0,
    dot: 2.2, dotRing: null, upper: false, onePerId: false,
  };
  let style = Object.assign({}, STYLE0);
  function setStyle(s){ style = Object.assign({}, STYLE0, s || {}); }

  let filter = null;    // (label, layer) => boolean; layer is 'skel' | 'org' | 'circ'
  function setFilter(fn){ filter = fn || null; }
  let textFn = null;    // (id, side) => string; side is 'L' | 'R' | ''
  function setText(fn){ textFn = fn || null; }
  let tapFn = null;     // ({ id, via, x, y }) => void; id is null when nothing was hit
  function onTap(fn){ tapFn = fn || null; }

  function init(canvas){
    cv = canvas; ctx = cv.getContext('2d');
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.addEventListener('pointerdown', tapped);
  }

  function resize(){
    const w = Math.round(cv.clientWidth * dpr), h = Math.round(cv.clientHeight * dpr);
    if (cv.width !== w || cv.height !== h){ cv.width = w; cv.height = h; }
  }

  // nearest part to a CSS-pixel point; opts: { radius (CSS px, default 34), maxLvl (default 2), ids (allowed ids) }
  function pick(x, y, opts){
    const o = opts || {};
    const r = o.radius || 34, maxLvl = o.maxLvl || 2;
    let best = null, bd = r;
    for (const m of marks){
      if (m.lvl > maxLvl) continue;
      if (o.ids && o.ids.indexOf(m.id) < 0) continue;
      const d = Math.hypot(x - m.x, y - m.y);
      if (d < bd){ bd = d; best = m; }
    }
    return best;
  }

  function tapped(e){
    const r = cv.getBoundingClientRect();
    const cx = e.clientX - r.left, cy = e.clientY - r.top;
    const px = cx * dpr, py = cy * dpr;
    let best = null, bd = 1e9;
    for (const b of boxes){
      if (px >= b.x - 10 && px <= b.x + b.w + 10 && py >= b.y - 10 && py <= b.y + b.h + 10){
        const d = Math.hypot(px - (b.x + b.w/2), py - (b.y + b.h/2));
        if (d < bd){ bd = d; best = b; }
      }
    }
    let hit = best ? { id: best.id, via: 'label', x: cx, y: cy } : null;
    if (!hit){
      const m = pick(cx, cy, { maxLvl: Math.max(1, lastNames) });
      hit = m ? { id: m.id, via: 'part', x: cx, y: cy } : { id: null, via: null, x: cx, y: cy };
    }
    if (tapFn) tapFn(hit);
    else if (hit.id && window.XRAPP) window.XRAPP.select(hit.id);
  }

  let lastNames = 1;
  function draw(pose, st, t){
    resize();
    const W = cv.width, H = cv.height;
    ctx.setTransform(1, 0, 0, 1, 0, 0);   // device px: same space as the pose solver
    ctx.clearRect(0, 0, W, H);
    boxes = []; marks = [];
    lastNames = st.names;
    if (!pose || !pose.seg) return;

    const S = style;
    const fs = S.size * st.textSize / 100 * dpr;
    ctx.font = `${S.weight} ${fs}px ${S.font}`;
    ctx.lineJoin = 'round';
    const padX = S.padX * dpr, padY = S.padY * dpr;
    const placed = [];
    const seen = new Set();       // Main level: one label per id (side-aware)

    // candidate boxes: both directions, growing offsets and vertical shifts,
    // kept inside the canvas; first non-overlapping box wins.
    const tryPlace = (ax, ay, txt) => {
      const w = ctx.measureText(txt).width + padX * 2;
      const h = fs * 1.25 + padY * 2;
      const dir0 = ax > W * 0.5 ? -1 : 1;
      for (const off of [18, 30, 44]){
        for (const dy of [0, -h * 0.9, h * 0.9, -h * 1.9, h * 1.9]){
          for (const dir of [dir0, -dir0]){
            const c = dir > 0
              ? { x: ax + off * dpr, y: ay + dy - h / 2 }
              : { x: ax - off * dpr - w, y: ay + dy - h / 2 };
            if (c.x < 2 || c.y < 2 || c.x + w > W - 2 || c.y + h > H - 2) continue;
            const hit = placed.some((p) => !(c.x + w + 6 < p.x || c.x - 6 > p.x + p.w ||
                        c.y + h + 4 < p.y || c.y - 4 > p.y + p.h));
            if (!hit){
              placed.push({ x: c.x, y: c.y, w, h });
              return { ...c, w, h };
            }
          }
        }
      }
      return null;
    };

    const plate = (b, fill, line) => {
      const r = Math.min(S.radius * dpr, b.h / 2);
      ctx.beginPath();
      ctx.moveTo(b.x + r, b.y);
      ctx.arcTo(b.x + b.w, b.y, b.x + b.w, b.y + b.h, r);
      ctx.arcTo(b.x + b.w, b.y + b.h, b.x, b.y + b.h, r);
      ctx.arcTo(b.x, b.y + b.h, b.x, b.y, r);
      ctx.arcTo(b.x, b.y, b.x + b.w, b.y, r);
      ctx.closePath();
      ctx.fillStyle = fill; ctx.fill();
      if (line){ ctx.strokeStyle = line; ctx.lineWidth = Math.max(1, dpr); ctx.stroke(); }
    };

    const todo = [];              // labels to draw this frame: { L, x, y, txt, box }
    // pass 1: leader line and dot; pass 2: plate and text (so no dot or line ever sits on top of a name)
    const drawLead = (d) => {
      const sel = d.L.id === selected;
      if (d.box){
        const tx = d.box.x > d.x ? d.box.x : d.box.x + d.box.w;
        const ty = d.box.y + d.box.h / 2;
        ctx.strokeStyle = sel ? S.sel : S.leader;
        ctx.lineWidth = Math.max(1, dpr * 0.8);
        ctx.beginPath(); ctx.moveTo(d.x, d.y); ctx.lineTo(tx, ty); ctx.stroke();
      }
      if (S.dotRing){
        ctx.fillStyle = S.dotRing;
        ctx.beginPath(); ctx.arc(d.x, d.y, (S.dot + 1.6) * dpr, 0, Math.PI * 2); ctx.fill();
      }
      ctx.fillStyle = sel ? S.sel : S.color;
      ctx.beginPath(); ctx.arc(d.x, d.y, S.dot * dpr, 0, Math.PI * 2); ctx.fill();
    };
    const drawName = (d) => {
      if (!d.box) return;
      const sel = d.L.id === selected;
      const bx = d.box.x + padX, by = d.box.y + padY + fs;
      if (S.pill){
        plate(d.box, sel && S.pillSel ? S.pillSel : S.pill, S.pillLine);
        ctx.fillStyle = sel && S.pillSel ? '#ffffff' : (S.pillText || S.color);
      } else {
        if (S.halo){ ctx.strokeStyle = S.halo; ctx.lineWidth = S.haloW * dpr; ctx.strokeText(d.txt, bx, by); }
        ctx.fillStyle = sel ? S.sel : S.color;
      }
      ctx.fillText(d.txt, bx, by);
      boxes.push({ x: d.box.x, y: d.box.y, w: d.box.w, h: d.box.h + 8, id: d.L.id });
    };

    const once = (L) => {           // Main level: skip repeat ids per side/pair
      if (st.names !== 1) return true;
      const s = String(L.seg || '');
      const key = (s.endsWith('_L') || s.endsWith('_R')) ? `${L.id}:${s.slice(-1)}` : L.id;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    };
    const visit = (L, layer, p) => {
      marks.push({ id: L.id, seg: L.seg, lvl: L.lvl, layer, x: p[0] / dpr, y: p[1] / dpr });
      if (st.names === 0 || L.lvl > st.names) return;
      if (!once(L)) return;
      if (S.onePerId){ if (seen.has('#' + L.id)) return; seen.add('#' + L.id); }
      todo.push({ L, x: p[0], y: p[1] });
    };

    // SKEL labels
    if (st.layerSkel){
      for (const L of window.SKEL.labels){
        if (filter && !filter(L, 'skel')) continue;
        const s = pose.seg[L.seg];
        if (!s || !s.visible) continue;
        const p = XP.applySeg(pose, L.seg, L.p);
        if (!p) continue;
        visit(L, 'skel', p);
      }
    }
    // SOFT labels
    if (window.SOFT && pose.mainOK && (st.layerOrg || st.layerCirc)){
      for (const L of window.SOFT.labels){
        const isOrgans = L.grp !== 'vessels';
        if (isOrgans && !st.layerOrg) continue;
        if (!isOrgans && !st.layerCirc) continue;
        if (L.grp === 'heart' && !st.layerOrg && !st.layerCirc) continue;
        const layer = isOrgans ? 'org' : 'circ';
        if (filter && !filter(L, layer)) continue;
        const slot = window.SOFT.main[L.seg];
        const s = pose.seg[slot];
        if (!s || !s.visible) continue;
        const p = XP.applyMain(pose, L.seg, L.p);
        if (!p) continue;
        visit(L, layer, p);
      }
    }

    // every dot is an obstacle, then names are placed, then lines and dots are drawn under the names
    const r = 7 * dpr;
    for (const d of todo) placed.push({ x: d.x - r, y: d.y - r, w: r * 2, h: r * 2 });
    for (const d of todo){ d.txt = labelText(d.L); d.box = tryPlace(d.x, d.y, d.txt); }
    ctx.globalAlpha = 0.95;
    for (const d of todo) drawLead(d);
    for (const d of todo) drawName(d);
    ctx.globalAlpha = 1;
  }

  function setSelected(id){ selected = id; }

  // paired bones: same id labelled on an _L and an _R segment
  const PAIRED = (() => {
    const m = new Map();
    const scan = (arr) => {
      if (!arr) return;
      for (const L of arr){
        const s = L.seg || '';
        const suf = s.endsWith('_L') ? 'L' : (s.endsWith('_R') ? 'R' : '');
        if (!suf) continue;
        const e = m.get(L.id) || {};
        e[suf] = 1; m.set(L.id, e);
      }
    };
    scan(window.SKEL.labels); scan(window.SOFT ? window.SOFT.labels : null);
    const out = new Set();
    for (const [id, e] of m) if (e.L && e.R) out.add(id);
    return out;
  })();

  function labelText(L){
    const s = String(L.seg || '');
    const side = !PAIRED.has(L.id) ? '' : (s.endsWith('_L') ? 'L' : (s.endsWith('_R') ? 'R' : ''));
    let txt;
    if (textFn) txt = textFn(L.id, side);
    else {
      const base = PARTS[L.id] ? PARTS[L.id][0] : L.id;
      txt = (side === 'L' ? 'Left ' : side === 'R' ? 'Right ' : '') + base;
    }
    return style.upper ? String(txt).toUpperCase() : txt;
  }

  return { init, draw, setSelected, setStyle, setFilter, setText, onTap, pick,
           anchors: () => marks, STYLE0, PAIRED };
})();
