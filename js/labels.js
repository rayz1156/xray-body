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

    const tryPlace = (ax, ay, id) => {
      const w = ctx.measureText(PARTS[id] ? PARTS[id][0] : id).width;
      const h = fs * 1.25;
      const cands = [];
      const dir = ax > W * 0.5 ? -1 : 1;
      // text x anchored: if dir>0 text starts at ax+18*dpr; if dir<0 ends at ax-18*dpr
      const candList = [];
      for (const dy of [ -h*0.8, 0, h*0.8 ]){
        candList.push(dir > 0
          ? { x: ax + 18 * dpr, y: ay + dy - h/2 }
          : { x: ax - 18 * dpr - w, y: ay + dy - h/2 });
      }
      for (const c of candList){
        const hit = placed.some((p) => !(c.x + w + 4 < p.x || c.x > p.x + p.w ||
                    c.y + h + 3 < p.y || c.y > p.y + p.h));
        if (!hit){
          placed.push({ x: c.x, y: c.y, w, h });
          return { ...c, w, h };
        }
      }
      return null;
    };

    const drawLabel = (ax, ay, id) => {
      const box = tryPlace(ax, ay, id);
      const sel = id === selected;
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
        ctx.fillText(PARTS[id] ? PARTS[id][0] : id, box.x, box.y + fs);
        boxes.push({ x: box.x, y: box.y, w: box.w, h: box.h + 8, id });
      }
      ctx.globalAlpha = 1;
    };

    // SKEL labels
    if (st.layerSkel){
      for (const L of window.SKEL.labels){
        if (L.lvl > st.names) continue;
        const s = pose.seg[L.seg];
        if (!s || !s.visible) continue;
        const p = XP.applySeg(pose, L.seg, L.p);
        if (!p) continue;
        drawLabel(p[0], p[1], L.id);
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
        drawLabel(p[0], p[1], L.id);
      }
    }
  }

  function setSelected(id){ selected = id; }

  return { init, draw, setSelected };
})();