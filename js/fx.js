// fx.js: cheap celebration and feedback effects on one overlay canvas (#fx, created on demand).
// The animation loop only runs while something is alive. All positions are CSS pixels.
//   XF.burst(x, y, { n, colors, power })   confetti
//   XF.sparkle(x, y, { color, n })         small stars popping outward
//   XF.ring(x, y, { color, r })            one expanding ring (a hit or a hint)
//   XF.floatText(x, y, 'text', { color })  text that rises and fades
//   XF.fly(x0, y0, x1, y1, { glyph, color, done })   a star (or any glyph) flying to a counter
// With prefers-reduced-motion the particle effects collapse to a single ring.
'use strict';
const XF = (() => {
  let cv = null, ctx = null, dpr = 1, raf = 0, last = 0;
  let items = [];
  const reduce = () => !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const PALETTE = ['#ff6b9d', '#ffd166', '#6ef2c4', '#7cc4ff', '#b79cff', '#ff9f68'];

  function ensure(){
    if (cv) return;
    cv = document.getElementById('fx');
    if (!cv){
      cv = document.createElement('canvas');
      cv.id = 'fx';
      cv.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:90;';
      document.body.appendChild(cv);
    }
    ctx = cv.getContext('2d');
  }
  function resize(){
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.round(cv.clientWidth * dpr), h = Math.round(cv.clientHeight * dpr);
    if (cv.width !== w || cv.height !== h){ cv.width = w; cv.height = h; }
  }
  function kick(){
    ensure();
    if (!raf){ last = performance.now(); raf = requestAnimationFrame(loop); }
  }
  function loop(now){
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    resize();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cv.clientWidth, cv.clientHeight);
    for (const it of items){ it.t += dt; it.draw(it, dt); }
    items = items.filter((it) => it.t < it.life);
    if (items.length) raf = requestAnimationFrame(loop);
    else { raf = 0; ctx.clearRect(0, 0, cv.clientWidth, cv.clientHeight); }
  }
  const easeOut = (x) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);

  function star(x, y, r, rot){
    ctx.beginPath();
    for (let i = 0; i < 10; i++){
      const a = rot + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r;
      ctx[i ? 'lineTo' : 'moveTo'](x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    ctx.closePath(); ctx.fill();
  }

  function ring(x, y, o){
    o = o || {};
    kick();
    items.push({ t: 0, life: o.life || 0.6, draw: (it) => {
      const k = easeOut(it.t / it.life);
      ctx.globalAlpha = 1 - k;
      ctx.strokeStyle = o.color || '#ffffff';
      ctx.lineWidth = (o.width || 5) * (1 - k * 0.6);
      ctx.beginPath(); ctx.arc(x, y, (o.r || 46) * (0.35 + 0.65 * k), 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 1;
    } });
  }

  function burst(x, y, o){
    o = o || {};
    if (reduce()){ ring(x, y, { color: (o.colors || PALETTE)[0] }); return; }
    kick();
    const n = o.n || 36, colors = o.colors || PALETTE, power = o.power || 1;
    for (let i = 0; i < n; i++){
      const a = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.5;
      const v = (220 + Math.random() * 380) * power;
      const p = { x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, r: 4 + Math.random() * 5,
                  rot: Math.random() * 6.28, vr: (Math.random() - 0.5) * 12, c: colors[i % colors.length],
                  shape: i % 3 };
      items.push({ t: 0, life: 1.1 + Math.random() * 0.6, draw: (it, dt) => {
        p.vy += 900 * dt; p.vx *= (1 - 1.2 * dt);
        p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
        ctx.globalAlpha = Math.min(1, (it.life - it.t) * 2.5);
        ctx.fillStyle = p.c;
        if (p.shape === 0){ ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillRect(-p.r, -p.r * 0.5, p.r * 2, p.r); ctx.restore(); }
        else if (p.shape === 1){ ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 0.7, 0, Math.PI * 2); ctx.fill(); }
        else star(p.x, p.y, p.r * 1.2, p.rot);
        ctx.globalAlpha = 1;
      } });
    }
  }

  function sparkle(x, y, o){
    o = o || {};
    if (reduce()){ ring(x, y, { color: o.color || '#ffd166', r: 30 }); return; }
    kick();
    const n = o.n || 7;
    for (let i = 0; i < n; i++){
      const a = i / n * Math.PI * 2 + Math.random() * 0.5, d = 26 + Math.random() * 30, r = 5 + Math.random() * 6;
      items.push({ t: 0, life: 0.55 + Math.random() * 0.25, draw: (it) => {
        const k = easeOut(it.t / it.life);
        ctx.globalAlpha = 1 - k * k;
        ctx.fillStyle = o.color || '#ffd166';
        star(x + Math.cos(a) * d * k, y + Math.sin(a) * d * k, r * (1 - k * 0.5), a + k * 2);
        ctx.globalAlpha = 1;
      } });
    }
  }

  function floatText(x, y, text, o){
    o = o || {};
    kick();
    items.push({ t: 0, life: o.life || 1.1, draw: (it) => {
      const k = it.t / it.life;
      ctx.globalAlpha = k < 0.15 ? k / 0.15 : 1 - Math.pow(Math.max(0, (k - 0.6) / 0.4), 2);
      ctx.font = `${o.weight || 700} ${o.size || 26}px ${o.font || 'system-ui, sans-serif'}`;
      ctx.textAlign = 'center';
      ctx.lineJoin = 'round'; ctx.lineWidth = 5; ctx.strokeStyle = o.stroke || 'rgba(20,16,40,.75)';
      const yy = y - 46 * easeOut(k);
      ctx.strokeText(text, x, yy);
      ctx.fillStyle = o.color || '#ffffff'; ctx.fillText(text, x, yy);
      ctx.globalAlpha = 1; ctx.textAlign = 'start';
    } });
  }

  function fly(x0, y0, x1, y1, o){
    o = o || {};
    kick();
    const life = reduce() ? 0.01 : (o.life || 0.7);
    let fired = false;
    items.push({ t: 0, life: life + 0.02, draw: (it) => {
      const k = easeOut(Math.min(1, it.t / life));
      const x = x0 + (x1 - x0) * k, y = y0 + (y1 - y0) * k - Math.sin(k * Math.PI) * 60;
      ctx.fillStyle = o.color || '#ffd166';
      if (o.glyph){ ctx.font = `${o.size || 28}px system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.fillText(o.glyph, x, y + 10); ctx.textAlign = 'start'; }
      else star(x, y, (o.size || 28) / 2 * (1.2 - 0.4 * k), k * 6);
      if (k >= 1 && !fired){ fired = true; if (o.done) o.done(); }
    } });
  }

  const clear = () => { items = []; };
  return { burst, sparkle, ring, floatText, fly, clear, PALETTE };
})();
