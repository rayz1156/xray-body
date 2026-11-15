// labels.js: 2D label canvas with leader lines, collision avoidance, tap picking.
'use strict';
const XL = (() => {
  let cv = null, ctx = null, dpr = 1;
  let boxes = [];       // [x,y,w,h,id] in CSS px, for tap picking
  let selected = null;

  function init(canvas){
    cv = canvas; ctx = cv.getContext('2d');
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.addEventListener('pointerdown', onTap);
  }

  function resize(){
    const w = Math.round(cv.clientWidth * dpr), h = Math.round(cv.clientHeight * dpr);
    if (cv.width !== w || cv.height !== h){ cv.width = w; cv.height = h; }
  }

  function onTap(e){
    const x = e.clientX, y = e.clientY;
    const r = cv.getBoundingClientRect();
    const px = (e.clientX - r.left) * dpr, py = (e.clientY - r.top) * dpr;
    let best = null, bd = 1e9;
    for (const b of boxes){
      if (px >= b.x - 10 && px <= b.x + b.w + 10 && py >= b.y - 10 && py <= b.y + b.h + 10){
        const d = Math.hypot(px - (b.x + b.w/2), py - (b.y + b.h/2));
        if (d < bd){ bd = d; best = b; }
      }
    }
    if (best && typeof window !== 'undefined' && window.XRAPP){
      window.XRAPP.select(best.id);
    }
  }

  function draw(pose, st, t){
    resize();
    const W = cv.width, H = cv.height;
    ctx.setTransform(1, 0, 0, 1, 0, 0);   // device px: same space as the pose solver
    ctx.clearRect(0, 0, W, H);
    boxes = [];
    if (!pose || !pose.seg || st.names === 0) return;

    const fs = 12 * st.textSize / 100 * dpr;
    ctx.font = `${fs}px system-ui, sans-serif`;
    ctx.lineWidth = Math.max(1, dpr * 0.8);
    const placed = [];
    const seen = new Set();       // Main level: one label per id (side-aware)

    // candidate boxes: both directions, growing offsets and vertical shifts,
    // kept inside the canvas; first non-overlapping box wins.
    const tryPlace = (ax, ay, txt) => {
      const w = ctx.measureText(txt).width;
      const h = fs * 1.25;
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

    const drawLabel = (ax, ay, L) => {
      const txt = labelText(L);
      const box = tryPlace(ax, ay, txt);
      const sel = L.id === selected;
      ctx.strokeStyle = sel ? '#ffd166' : 'rgba(223,241,255,0.55)';
      ctx.fillStyle = sel ? '#ffd166' : '#dff1ff';
      ctx.globalAlpha = st.look === 'xray' ? 0.95 : 0.9;
      ctx.beginPath();
      ctx.arc(ax, ay, 2.2 * dpr, 0, Math.PI * 2);
      ctx.fill();
      if (box){
        const tx = box.x > ax ? ax + 18 * dpr : ax - 18 * dpr;
        const ty = box.y + box.h / 2;
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(tx, ty);
        ctx.stroke();
        ctx.fillText(txt, box.x, box.y + fs);
        boxes.push({ x: box.x, y: box.y, w: box.w, h: box.h + 8, id: L.id });
      }
      ctx.globalAlpha = 1;
    };

    const once = (L) => {           // Main level: skip repeat ids per side/pair
      if (st.names !== 1) return true;
      const s = String(L.seg || '');
      const key = (s.endsWith('_L') || s.endsWith('_R')) ? `${L.id}:${s.slice(-1)}` : L.id;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    };

    // SKEL labels
    if (st.layerSkel){
      for (const L of window.SKEL.labels){
        if (L.lvl > st.names) continue;
        const s = pose.seg[L.seg];
        if (!s || !s.visible) continue;
        const p = XP.applySeg(pose, L.seg, L.p);
        if (!p) continue;
        if (!once(L)) continue;
        drawLabel(p[0], p[1], L);
      }
    }
    // SOFT labels
    if (window.SOFT && pose.mainOK && (st.layerOrg || st.layerCirc)){
      for (const L of window.SOFT.labels){
        if (L.lvl > st.names) continue;
        const isOrgans = L.grp !== 'vessels';
        if (isOrgans && !st.layerOrg) continue;
        if (!isOrgans && !st.layerCirc) continue;
        if (L.grp === 'heart' && !st.layerOrg && !st.layerCirc) continue;
        const slot = window.SOFT.main[L.seg];
        const s = pose.seg[slot];
        if (!s || !s.visible) continue;
        const p = XP.applyMain(pose, L.seg, L.p);
        if (!p) continue;
        if (!once(L)) continue;
        drawLabel(p[0], p[1], L);
      }
    }
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
    const base = PARTS[L.id] ? PARTS[L.id][0] : L.id;
    let side = '';
    const s = String(L.seg || '');
    if (PAIRED.has(L.id)){
      if (s.endsWith('_L')) side = 'Left ';
      else if (s.endsWith('_R')) side = 'Right ';
    }
    return side + base;
  }

  return { init, draw, setSelected, PAIRED };
})();