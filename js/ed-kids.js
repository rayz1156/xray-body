// ed-kids.js: Kids edition. Cartoon skeleton, kid names, Sendi the mascot, missions with stars, a sticker book.
'use strict';
(() => {
  const K = window.KIDS;
  const L = (pair) => pair[XI.lang === 'ms' ? 1 : 0];
  const kname = (id) => (K.parts[id] ? L(K.parts[id].name) : XI.part(id)[0]);
  const klow = (id) => { const n = kname(id); return n.charAt(0).toLowerCase() + n.slice(1); };   // inside a sentence
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const SKEY = 'xray-kids-v1';
  let prog = { stickers: {}, best: {} };
  try { prog = Object.assign(prog, JSON.parse(localStorage.getItem(SKEY) || '{}')); } catch (e) {}
  const store = () => { try { localStorage.setItem(SKEY, JSON.stringify(prog)); } catch (e) {} };
  const ALL = Object.keys(K.parts);

  let app = null;
  let run = null;          // running mission: { m, i, misses, total, qMiss, t0, timers }
  let quietUntil = 0;

  // ---------- mascot ----------
  let bubbleTimer = 0;
  function say(text, mood, ms){
    const img = document.getElementById('mascotImg'), b = document.getElementById('bubble');
    if (!img) return;
    img.src = 'assets/mascot/sendi-' + (mood || 'happy') + '.svg';
    img.classList.remove('jump'); void img.offsetWidth;
    if (mood === 'cheer') img.classList.add('jump');
    b.textContent = text;
    b.classList.add('show');
    clearTimeout(bubbleTimer);
    if (ms !== 0) bubbleTimer = setTimeout(() => b.classList.remove('show'), ms || 5000);
    speak(text);
  }
  // read aloud for children who cannot read yet (only when the device has a voice for the language)
  function speak(text){
    try {
      if (XS.isMuted() || !window.speechSynthesis) return;
      const want = XI.lang === 'ms' ? 'ms' : 'en';
      const v = speechSynthesis.getVoices().find((x) => x.lang && x.lang.toLowerCase().startsWith(want));
      if (!v) return;
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.voice = v; u.lang = v.lang; u.rate = 0.95; u.pitch = 1.15;
      speechSynthesis.speak(u);
    } catch (e) {}
  }

  // ---------- dock ----------
  const svg = (n) => `<svg class="i"><use href="#i-${n}"/></svg>`;
  function idleDock(){
    const n = Object.keys(prog.stickers).length;
    const bar = document.createElement('div');
    bar.className = 'bar';
    bar.innerHTML = `<button class="btn primary" data-a="play">${svg('star')}<span>${esc(XI.t('kPlay'))}</span></button>` +
      `<button class="btn" data-a="book"><span>${esc(XI.t('kStickers'))}</span><b>${n}/${ALL.length}</b></button>`;
    bar.querySelector('[data-a="play"]').addEventListener('click', () => { XS.play('open'); missionsSheet(); });
    bar.querySelector('[data-a="book"]').addEventListener('click', () => { XS.play('open'); stickerBook(); });
    app.dock(bar);
  }
  function questionDock(){
    const r = run, id = r.m.ids[r.i];
    const bar = document.createElement('div');
    bar.className = 'bar';
    const dots = r.m.ids.map((x, k) => `<i style="width:9px;height:9px;border-radius:9px;display:inline-block;background:${k < r.i ? 'var(--good)' : k === r.i ? 'var(--accent)' : 'var(--line)'}"></i>`).join('');
    bar.innerHTML = `<button class="ic" data-a="quit" aria-label="${esc(XI.t('close'))}" style="box-shadow:none">✕</button>` +
      `<div style="padding:0 6px;min-width:0"><div style="font-family:var(--font-display);font-weight:600;font-size:17px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(XI.t('kFind', { name: klow(id) }))}</div>` +
      `<div style="display:flex;gap:5px;margin-top:4px">${dots}</div></div>` +
      `<button class="ic" data-a="hint" aria-label="hint" style="box-shadow:none;font-size:20px">💡</button>`;
    bar.querySelector('[data-a="quit"]').addEventListener('click', () => { endMission(true); });
    bar.querySelector('[data-a="hint"]').addEventListener('click', () => hint(2));
    app.dock(bar);
  }

  // ---------- stickers ----------
  function award(id, x, y){
    if (prog.stickers[id]) return false;
    prog.stickers[id] = 1; store();
    if (x !== undefined){
      const btn = document.querySelector('#dock [data-a="book"]') || document.getElementById('dock');
      const r = btn.getBoundingClientRect();
      XF.fly(x, y, r.left + r.width / 2, r.top + r.height / 2, { glyph: '⭐', size: 30 });
    }
    return true;
  }
  function stickerBook(){
    const n = Object.keys(prog.stickers).length;
    const tiles = ALL.map((id) => {
      const got = !!prog.stickers[id];
      const p = K.parts[id];
      const ic = p.layer === 'org' ? 'organ' : p.layer === 'circ' ? 'blood' : 'bone';
      return `<button data-id="${id}" ${got ? '' : 'disabled'} style="border:2px ${got ? 'solid' : 'dashed'} ${got ? 'var(--accent)' : 'var(--line)'};
        background:${got ? 'var(--surface-2)' : 'transparent'};border-radius:16px;padding:10px 6px;min-height:88px;display:flex;flex-direction:column;
        align-items:center;justify-content:center;gap:4px;color:${got ? 'var(--ink)' : 'var(--dim)'};font-family:var(--font-display);font-weight:600;font-size:13.5px;line-height:1.15">
        <span style="color:${got ? (p.layer === 'skel' ? 'var(--accent)' : 'var(--hot)') : 'var(--line)'}">${svg(got ? ic : 'star')}</span>${got ? esc(kname(id)) : '?'}</button>`;
    }).join('');
    const sh = app.openSheet(`<div class="sh"><h2>${esc(XI.t('kStickerBook'))}</h2><button class="x" data-close aria-label="${esc(XI.t('close'))}">✕</button></div>
      <p style="margin:0 0 10px;color:var(--dim)">${esc(XI.t('kFound', { n, m: ALL.length }))}</p>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(96px,1fr));gap:8px">${tiles}</div>`);
    sh.querySelectorAll('button[data-id]').forEach((b) => b.addEventListener('click', () => {
      const id = b.dataset.id;
      app.closeSheet();
      app.setView(K.parts[id].layer, true);
      app.select(id);
      XS.play('select');
    }));
  }

  // ---------- missions ----------
  function unlocked(k){ return k === 0 || (prog.best[K.missions[k - 1].id] || 0) > 0; }
  function missionsSheet(){
    const rows = K.missions.map((m, k) => {
      const best = prog.best[m.id] || 0, open = unlocked(k);
      const stars = [1, 2, 3].map((s) => `<span style="color:${s <= best ? 'var(--star)' : 'var(--line)'}">${svg('star')}</span>`).join('');
      return `<button data-k="${k}" ${open ? '' : 'aria-disabled="true"'} style="display:flex;align-items:center;gap:12px;width:100%;text-align:left;
        border:2px solid var(--line);background:${open ? 'var(--surface)' : 'var(--surface-2)'};border-radius:18px;padding:12px;margin-bottom:8px;opacity:${open ? 1 : .55}">
        <span style="width:46px;height:46px;border-radius:14px;background:var(--accent);color:var(--accent-ink);display:flex;align-items:center;justify-content:center;flex:none">${svg(open ? m.icon : 'star')}</span>
        <span style="flex:1;font-family:var(--font-display);font-weight:600;font-size:17px">${esc(XI.t('kMission_' + m.id))}<small style="display:block;font-family:var(--font);font-weight:600;color:var(--dim);font-size:12.5px">${m.ids.length} × ${esc(XI.t('kFindSub'))}</small></span>
        <span style="display:flex">${stars}</span></button>`;
    }).join('');
    const sh = app.openSheet(`<div class="sh"><h2>${esc(XI.t('kMissions'))}</h2><button class="x" data-close aria-label="${esc(XI.t('close'))}">✕</button></div>${rows}`);
    sh.querySelectorAll('button[data-k]').forEach((b) => b.addEventListener('click', () => {
      const k = +b.dataset.k;
      if (!unlocked(k)){ XS.play('oops'); say(XI.t('kLocked'), 'think'); return; }
      app.closeSheet();
      startMission(k);
    }));
  }
  function startMission(k){
    const m = K.missions[k];
    app.closeCard(); app.closeLesson();
    run = { k, m, i: 0, misses: 0, qMiss: 0, timers: [] };
    XS.play('whoosh');
    ask();
  }
  function clearTimers(){ if (run){ run.timers.forEach(clearTimeout); run.timers = []; } app.highlight(null); }
  function ask(){
    clearTimers();
    const id = run.m.ids[run.i];
    const layer = K.parts[id].layer;
    app.setView(run.m.view === 'mix' ? layer : run.m.view, true);
    run.qMiss = 0; run.qStart = performance.now();
    questionDock();
    say(XI.t('kFind', { name: klow(id) }), 'happy', 0);
    run.timers.push(setTimeout(() => hint(1), 7000), setTimeout(() => hint(2), 14000));
  }
  // hint 1: the part glows; hint 2: rings pulse on it and Sendi points
  function hint(level){
    if (!run) return;
    const id = run.m.ids[run.i];
    if (window.SKEL.ids.indexOf(id) >= 0) app.highlight(id);
    if (level >= 2){
      run.hinted = true;
      const pulse = () => { if (!run || run.m.ids[run.i] !== id) return; ringAt(id); run.timers.push(setTimeout(pulse, 1100)); };
      pulse();
      say(XI.t('kHint2'), 'think', 0);
    } else {
      say(XI.t('kHint'), 'think', 0);
    }
    XS.play('hint');
  }
  function anchorsOf(id){ return XL.anchors().filter((a) => a.id === id); }
  function ringAt(id){ for (const a of anchorsOf(id)) XF.ring(a.x, a.y, { color: '#ff5c8a', r: 52, width: 6, life: 0.9 }); }
  function answer(hit){
    const id = run.m.ids[run.i];
    const R = 52;
    const near = anchorsOf(id).some((a) => Math.hypot(a.x - hit.x, a.y - hit.y) < R) || hit.id === id;
    if (near){
      clearTimers();
      XS.play('great'); XS.haptic([12, 40, 12]);
      XF.burst(hit.x, hit.y, { n: 40 });
      XF.floatText(hit.x, hit.y - 10, kname(id), { font: 'Fredoka, sans-serif', size: 26 });
      const fresh = award(id, hit.x, hit.y);
      say(XI.t('kYes', { name: klow(id) }) + (fresh ? ' ⭐' : ''), 'cheer', 0);
      run.i++;
      const done = run.i >= run.m.ids.length;
      run.timers.push(setTimeout(() => { if (!run) return; if (done) finish(); else ask(); }, 1500));
      run.busyUntil = performance.now() + 1500;
    } else {
      run.misses++; run.qMiss++;
      XS.play('oops'); XS.haptic(30);
      const other = hit.id && K.parts[hit.id] ? klow(hit.id) : null;
      say(other ? XI.t('kNotYet', { name: other }) : XI.t('kTapBody'), 'oops', 0);
      if (run.qMiss === 1) run.timers.push(setTimeout(() => hint(1), 600));
      if (run.qMiss >= 2) hint(2);
    }
  }
  function finish(){
    const r = run;
    const stars = r.misses <= 1 ? 3 : r.misses <= 4 ? 2 : 1;
    const key = r.m.id;
    prog.best[key] = Math.max(prog.best[key] || 0, stars); store();
    run = null; clearTimers();
    XS.play('win');
    XF.burst(innerWidth / 2, innerHeight * 0.45, { n: 90, power: 1.3 });
    const starRow = [1, 2, 3].map((s) => `<span style="color:${s <= stars ? 'var(--star)' : 'var(--line)'};display:inline-block;transform:scale(1.9);margin:0 14px">${svg('star')}</span>`).join('');
    const hasNext = r.k + 1 < K.missions.length;
    const sh = app.openSheet(`<div style="text-align:center;padding:8px 4px">
      <img src="assets/mascot/sendi-cheer.svg" alt="" style="width:120px;height:120px">
      <h2 style="font-family:var(--font-display);margin:4px 0 10px;font-size:26px">${esc(XI.t('kDone'))}</h2>
      <div style="margin:14px 0 18px">${starRow}</div>
      <p style="margin:0 0 16px;font-weight:700">${esc(XI.t('kStarsGot', { n: stars }))}</p>
      <div class="row" style="justify-content:center">
        <button class="btn" data-a="again" style="min-height:52px">${esc(XI.t('kAgain'))}</button>
        ${hasNext ? `<button class="btn primary" data-a="next" style="min-height:52px">${esc(XI.t('kNext'))}</button>` : ''}
      </div></div>`, () => { idleDock(); });
    sh.querySelector('[data-a="again"]').addEventListener('click', () => { app.closeSheet(); startMission(r.k); });
    const nx = sh.querySelector('[data-a="next"]');
    if (nx) nx.addEventListener('click', () => { app.closeSheet(); startMission(r.k + 1); });
    say(XI.t('kStarsGot', { n: stars }), 'cheer');
  }
  function endMission(quiet){
    clearTimers();
    run = null;
    idleDock();
    if (!quiet) say(XI.t('kHello'), 'happy');
    else document.getElementById('bubble').classList.remove('show');
  }

  // ---------- edition ----------
  XE.register({
    id: 'kids',
    bodyClass: 'ed-kids',
    look: 'solid',
    names: 2,
    tabMode: 'single',
    defaultView: 'skel',
    panel: { look: false, names: false },
    renderStyle: {
      bone: { body: 2, solid: [1.0, 0.97, 0.90], shade: [0.80, 0.82, 0.98], line: [0.24, 0.19, 0.45], steps: 3, outline: 0.0045, hot: [1.0, 0.36, 0.54] },
      soft: { body: 2, shade: 0.72, line: [0.24, 0.19, 0.45], steps: 3, outline: 0.004, lift: 0.12 },
    },
    labelStyle: { font: 'Fredoka, Nunito, system-ui, sans-serif', weight: 600, size: 14, color: '#2a2156', leader: 'rgba(42,33,86,.5)',
      sel: '#ff5c8a', pill: 'rgba(255,255,255,.97)', pillSel: '#ff5c8a', pillText: '#2a2156', pillLine: 'rgba(42,33,86,.22)',
      radius: 14, padX: 9, padY: 4, dot: 3.4, dotRing: '#ffffff', halo: null, onePerId: true },
    // only kid parts, one label per part (both sides still count as answers)
    labelFilter: (lab) => !!K.parts[lab.id],
    labelText: (id) => kname(id),
    drawSettings: () => (run ? { names: 0 } : {}),
    still: () => !!run,
    busy: () => !!run,
    card: (id) => {
      const p = K.parts[id];
      if (!p) return { name: kname(id), latin: '', desc: XI.part(id)[2] };
      return {
        name: L(p.name), latin: '', desc: L(p.job),
        html: `<div style="margin-top:10px;background:var(--surface-2);border-radius:14px;padding:10px 12px;font-size:14.5px;line-height:1.45">
          <b style="font-family:var(--font-display);color:var(--accent)">${esc(XI.t('kWow'))}</b> ${esc(L(p.wow))}</div>
          <div style="margin-top:8px;display:flex;gap:8px;align-items:center;font-weight:700;font-size:14px">👉 <span>${esc(XI.t('kOnYou'))}: ${esc(L(p.touch))}</span></div>`,
      };
    },
    onTap(hit){
      if (run){
        if (performance.now() < (run.busyUntil || 0)) return true;
        answer(hit);
        return true;
      }
      if (!hit.id){
        if (performance.now() > quietUntil){ say(XI.t('kTapBody'), 'think', 2500); quietUntil = performance.now() + 4000; }
        return true;
      }
      XS.play('select');
      app.select(hit.id);
      const fresh = award(hit.id, hit.x, hit.y);
      if (fresh){ XS.play('star'); XF.sparkle(hit.x, hit.y); say(XI.t('kSticker', { name: kname(hit.id) }), 'cheer'); idleDock(); }
      else document.getElementById('bubble').classList.remove('show');
      return true;
    },
    mount(a){
      app = a;
      idleDock();
    },
    onStart(){ if (!run) say(XI.t('kHello'), 'happy', 6000); },
    onView(){ app.closeCard(); },
    onLang(){
      if (run) questionDock(); else idleDock();
      document.getElementById('bubble').classList.remove('show');
    },
    unmount(){
      clearTimers(); run = null;
      try { speechSynthesis.cancel(); } catch (e) {}
      document.getElementById('bubble').classList.remove('show');
    },
  });
})();
