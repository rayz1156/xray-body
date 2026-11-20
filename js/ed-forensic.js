// ed-forensic.js: Forensic Lab edition. Specimen skeleton, evidence cards per bone, a locate drill,
// a fictional case file and a stature calculator.
'use strict';
(() => {
  const F = window.FOR;
  const L = (pair) => pair[XI.lang === 'ms' ? 1 : 0];
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const pname = (id) => XI.part(id)[0];
  const SKEY = 'xray-forensic-v1';
  let prog = { drillBest: 0, caseBest: {} };
  try { prog = Object.assign(prog, JSON.parse(localStorage.getItem(SKEY) || '{}')); } catch (e) {}
  const store = () => { try { localStorage.setItem(SKEY, JSON.stringify(prog)); } catch (e) {} };
  const isBone = (id) => window.SKEL.ids.indexOf(id) >= 0;

  let app = null;
  let drill = null;       // { list, i, score, t0, wait }
  let caseRun = null;     // { c, i, score, answered }

  function rank(){
    const cs = Object.values(prog.caseBest).reduce((a, b) => Math.max(a, b), 0);
    const R = XI.raw('fRanks');
    if (prog.drillBest >= 9 && cs >= 5) return R[2];
    if (prog.drillBest >= 7 || cs >= 4) return R[1];
    return R[0];
  }

  // ---------- dock ----------
  function idleDock(){
    const bar = document.createElement('div');
    bar.className = 'bar';
    bar.innerHTML = `<button class="btn" data-a="drill">${esc(XI.t('fDrill'))}</button>` +
      `<button class="btn primary" data-a="case">${esc(XI.t('fCase'))}</button>` +
      `<button class="btn" data-a="calc">${esc(XI.t('fStature'))}</button>`;
    bar.querySelector('[data-a="drill"]').addEventListener('click', startDrill);
    bar.querySelector('[data-a="case"]').addEventListener('click', () => startCase(0));
    bar.querySelector('[data-a="calc"]').addEventListener('click', () => calcSheet());
    app.dock(bar);
  }
  function drillDock(){
    const d = drill, id = d.list[d.i];
    const bar = document.createElement('div');
    bar.className = 'bar';
    bar.innerHTML = `<button class="ic" data-a="quit" style="box-shadow:none" aria-label="${esc(XI.t('close'))}">✕</button>` +
      `<div style="padding:0 8px;min-width:0"><div style="font-family:var(--mono);font-size:11.5px;color:var(--dim);letter-spacing:.06em">${esc(XI.t('fDrill').toUpperCase())} ${d.i + 1}/${d.list.length} · ${esc(XI.t('fScore', { s: d.score, n: d.list.length }))}</div>` +
      `<div style="font-weight:600;font-size:16px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(XI.t('fLocate', { name: pname(id) }))}</div></div>`;
    bar.querySelector('[data-a="quit"]').addEventListener('click', () => { drill = null; app.highlight(null); idleDock(); XS.play('close'); });
    app.dock(bar);
  }

  // ---------- evidence card ----------
  function evidenceHtml(id){
    const items = F.bones[id];
    if (!items){
      return isBone(id) ? `<p style="margin:10px 0 0;color:var(--dim);font-size:13px">${esc(XI.t('fNoEvidence'))}</p>` : '';
    }
    const T = XI.raw('fTells');
    return `<div style="margin-top:12px;border-top:1px solid var(--line);padding-top:10px">
      <div style="font-family:var(--mono);font-size:11px;letter-spacing:.08em;color:var(--accent);text-transform:uppercase;margin-bottom:8px">${esc(XI.t('fEvidence'))}</div>` +
      items.map((it) => `<div style="margin-bottom:10px">
        <div style="display:flex;gap:5px;flex-wrap:wrap;margin-bottom:4px">${it.tells.map((k) => `<span style="font-family:var(--mono);font-size:10.5px;letter-spacing:.06em;text-transform:uppercase;border:1px solid var(--info);color:var(--info);border-radius:4px;padding:1px 6px">${esc(T[k] || k)}</span>`).join('')}</div>
        <div style="font-size:13.5px;line-height:1.5">${esc(L(it.text))}</div>
        <div style="font-size:12px;color:var(--dim);margin-top:3px"><b>${esc(XI.t('fCaveat'))}:</b> ${esc(L(it.caveat))}</div></div>`).join('') + '</div>';
  }

  // ---------- locate drill ----------
  function shuffle(a, seed){ a = a.slice(); for (let i = a.length - 1; i > 0; i--){ const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  function startDrill(){
    if (caseRun) return;
    app.closeCard(); app.closeLesson(); app.closeSheet();
    app.setView('skel', true);
    drill = { list: shuffle(F.drill).slice(0, 10), i: 0, score: 0, t0: performance.now(), wait: 0 };
    XS.play('confirm');
    drillDock();
    app.setPill(XI.t('fLocateSub'), 2500);
  }
  function drillTap(hit){
    const d = drill, id = d.list[d.i];
    if (performance.now() < d.wait) return;
    const anchors = XL.anchors().filter((a) => a.id === id);
    const ok = hit.id === id || anchors.some((a) => Math.hypot(a.x - hit.x, a.y - hit.y) < 40);
    if (ok){
      d.score++;
      XS.play('stamp'); XS.haptic(15);
      XF.ring(hit.x, hit.y, { color: '#5fd0a0', r: 40 });
      XF.floatText(hit.x, hit.y, XI.t('fCorrect'), { color: '#5fd0a0', font: 'IBM Plex Sans, sans-serif', size: 18 });
    } else {
      if (!hit.id) return;              // a tap on empty space is not an answer
      XS.play('deny'); XS.haptic(40);
      XF.ring(hit.x, hit.y, { color: '#f2b134', r: 34 });
      XF.floatText(hit.x, hit.y, XI.t('fWrongWas', { name: pname(hit.id) }), { color: '#f2b134', font: 'IBM Plex Sans, sans-serif', size: 16 });
      for (const a of anchors) XF.ring(a.x, a.y, { color: '#5fd0a0', r: 46, life: 1.2 });
      app.highlight(id);
    }
    d.wait = performance.now() + (ok ? 650 : 1500);
    setTimeout(() => {
      if (drill !== d) return;
      app.highlight(null);
      d.i++;
      if (d.i >= d.list.length) drillDone(); else drillDock();
    }, ok ? 650 : 1500);
  }
  function drillDone(){
    const d = drill; drill = null;
    const secs = Math.round((performance.now() - d.t0) / 1000);
    prog.drillBest = Math.max(prog.drillBest, d.score); store();
    XS.play(d.score >= 8 ? 'win' : 'confirm');
    const sh = app.openSheet(`<div class="sh"><h2>${esc(XI.t('fDrillDone'))}</h2><button class="x" data-close aria-label="${esc(XI.t('close'))}">✕</button></div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:14px;text-align:center">
        <div class="stat"><div style="font-family:var(--mono);font-size:28px;color:var(--accent)">${d.score}/${d.list.length}</div><small style="color:var(--dim)">${esc(XI.t('fScoreLbl'))}</small></div>
        <div class="stat"><div style="font-family:var(--mono);font-size:28px">${secs}s</div><small style="color:var(--dim)">${esc(XI.t('fTimeLbl'))}</small></div>
        <div class="stat"><div style="font-size:17px;font-weight:700;margin-top:8px">${esc(rank())}</div><small style="color:var(--dim)">${esc(XI.t('fRank'))}</small></div>
      </div>
      <div class="row"><button class="btn primary" data-a="again" style="min-height:48px">${esc(XI.t('fRetry'))}</button></div>`, () => idleDock());
    sh.querySelector('[data-a="again"]').addEventListener('click', () => { app.closeSheet(); startDrill(); });
  }

  // ---------- case file ----------
  function startCase(k){
    if (drill) return;
    app.closeCard(); app.closeLesson();
    app.setView('skel', true);
    caseRun = { c: F.cases[k], k, i: -1, score: 0, answered: false };
    XS.play('open');
    caseStep();
  }
  function caseHeader(){
    const r = caseRun;
    return `<div class="sh"><h2>${esc(L(r.c.title))}</h2><button class="x" data-close aria-label="${esc(XI.t('close'))}">✕</button></div>
      <div style="font-family:var(--mono);font-size:11px;letter-spacing:.06em;color:var(--accent);margin:-4px 0 10px;text-transform:uppercase">${esc(XI.t('fTraining'))}</div>`;
  }
  function caseStep(){
    const r = caseRun;
    if (!r) return;
    const n = r.c.steps.length;
    if (r.i < 0){
      const sh = app.openSheet(caseHeader() + `<p style="line-height:1.55;margin:0 0 14px">${esc(L(r.c.brief))}</p>
        <div class="row"><button class="btn primary" data-a="go" style="min-height:48px">${esc(XI.t('fNextStep'))}</button></div>`, onCaseClose);
      sh.querySelector('[data-a="go"]').addEventListener('click', () => { r.i = 0; caseStep(); });
      return;
    }
    const s = r.c.steps[r.i];
    app.highlight(isBone(s.focus) ? s.focus : null);
    r.answered = false;
    const opts = s.opts.map((o, k) => `<button class="btn" data-k="${k}" style="display:block;width:100%;text-align:left;margin:6px 0;min-height:48px;font-size:14.5px">${esc(L(o))}</button>`).join('');
    const sh = app.openSheet(caseHeader() +
      `<div style="font-family:var(--mono);font-size:11.5px;color:var(--dim);margin-bottom:6px">${esc(XI.t('fStep', { i: r.i + 1, n }))} · ${esc(XI.t('fScore', { s: r.score, n }))}</div>
      <div style="height:4px;background:var(--line);border-radius:4px;margin-bottom:12px"><div style="height:4px;width:${(r.i / n) * 100}%;background:var(--accent);border-radius:4px"></div></div>
      <p style="font-weight:600;line-height:1.5;margin:0 0 8px">${esc(L(s.q))}</p>${opts}
      <div id="cWhy" style="display:none;margin-top:10px;padding:10px 12px;border-radius:6px;background:var(--surface-2);font-size:13.5px;line-height:1.5"></div>
      <div class="row"><button class="btn primary hidden" data-a="next" style="min-height:48px">${esc(r.i + 1 < n ? XI.t('fNextStep') : XI.t('fFinish'))}</button></div>`, onCaseClose);
    sh.querySelectorAll('button[data-k]').forEach((b) => b.addEventListener('click', () => {
      if (r.answered) return;
      r.answered = true;
      const k = +b.dataset.k, ok = k === s.a;
      if (ok){ r.score++; XS.play('stamp'); } else XS.play('deny');
      sh.querySelectorAll('button[data-k]').forEach((x) => {
        const kk = +x.dataset.k;
        if (kk === s.a){ x.style.borderColor = 'var(--good)'; x.style.background = 'rgba(95,208,160,.15)'; }
        else if (kk === k){ x.style.borderColor = 'var(--accent)'; x.style.opacity = '.8'; }
        else x.style.opacity = '.55';
      });
      const why = sh.querySelector('#cWhy');
      why.style.display = 'block';
      why.innerHTML = `<b style="color:${ok ? 'var(--good)' : 'var(--accent)'}">${esc(ok ? XI.t('fCorrect') : '→')}</b> ${esc(L(s.why))}`;
      sh.querySelector('[data-a="next"]').classList.remove('hidden');
    }));
    sh.querySelector('[data-a="next"]').addEventListener('click', () => {
      r.i++;
      if (r.i >= n) caseDone(); else caseStep();
    });
  }
  function onCaseClose(){ if (caseRun && !caseRun.switching){ caseRun = null; app.highlight(null); } }
  function caseDone(){
    const r = caseRun, n = r.c.steps.length;
    prog.caseBest[r.c.id] = Math.max(prog.caseBest[r.c.id] || 0, r.score); store();
    XS.play(r.score >= n - 1 ? 'win' : 'confirm');
    app.highlight(null);
    const lines = r.c.steps.map((s, k) => `<li style="margin:4px 0">${esc(L(s.opts[s.a]))}</li>`).join('');
    const sh = app.openSheet(caseHeader() + `<h3 style="margin:0 0 6px;font-size:15px">${esc(XI.t('fReport'))}</h3>
      <p style="font-family:var(--mono);color:var(--accent);margin:0 0 8px">${esc(XI.t('fCaseScore', { s: r.score, n }))} · ${esc(XI.t('fRank'))}: ${esc(rank())}</p>
      <ol style="padding-left:20px;margin:0 0 14px;font-size:14px;line-height:1.45">${lines}</ol>
      <div class="row"><button class="btn" data-a="again" style="min-height:48px">${esc(XI.t('fRetry'))}</button><button class="btn primary" data-close style="min-height:48px">${esc(XI.t('close'))}</button></div>`, () => { caseRun = null; });
    sh.querySelector('[data-a="again"]').addEventListener('click', () => { const k = r.k; caseRun = null; app.closeSheet(); startCase(k); });
  }

  // ---------- stature calculator ----------
  function calcSheet(cm){
    const S = F.stature;
    let v = cm || 45.0;
    const sh = app.openSheet(`<div class="sh"><h2>${esc(XI.t('fCalcTitle'))}</h2><button class="x" data-close aria-label="${esc(XI.t('close'))}">✕</button></div>
      <label style="display:block;font-size:13px;color:var(--dim);margin-bottom:4px" for="fLen">${esc(XI.t('fFemur'))}</label>
      <div style="display:flex;gap:10px;align-items:center"><input id="fLen" type="range" min="35" max="60" step="0.1" value="${v}" style="flex:1;accent-color:var(--accent)">
        <input id="fNum" type="number" min="35" max="60" step="0.1" value="${v}" style="width:84px;font:inherit;font-family:var(--mono);background:var(--surface-2);color:var(--ink);border:1px solid var(--line);border-radius:6px;padding:8px"></div>
      <div id="fOut" style="margin:14px 0;padding:12px;border:1px solid var(--line);border-radius:6px;background:var(--surface-2)"></div>
      <p style="font-family:var(--mono);font-size:12px;color:var(--dim);line-height:1.5;margin:0 0 8px">${esc(XI.t('fEquation'))}</p>
      <p style="font-size:13px;line-height:1.5;margin:0 0 6px">${esc(XI.t('fCalcWhy'))}</p>
      <p style="font-size:13px;line-height:1.5;margin:0;color:var(--accent)">${esc(XI.t('fCalcCaveat'))}</p>`, () => app.highlight(null));
    const out = sh.querySelector('#fOut'), rng = sh.querySelector('#fLen'), num = sh.querySelector('#fNum');
    const draw = () => {
      const h = S.a * v + S.b, lo = h - 2 * S.se, hi = h + 2 * S.se;
      out.innerHTML = `<div style="font-size:12px;color:var(--dim)">${esc(XI.t('fEstimate'))}</div>
        <div style="font-family:var(--mono);font-size:30px;color:var(--accent)">${h.toFixed(1)} cm</div>
        <div style="font-size:12px;color:var(--dim);margin-top:6px">${esc(XI.t('fRange'))}</div>
        <div style="font-family:var(--mono);font-size:18px">${lo.toFixed(1)} – ${hi.toFixed(1)} cm</div>
        <div style="position:relative;height:10px;margin-top:10px;background:var(--line);border-radius:5px">
          <div style="position:absolute;left:${(lo - 140) / 70 * 100}%;width:${(4 * S.se) / 70 * 100}%;top:0;bottom:0;background:var(--info);opacity:.6;border-radius:5px"></div>
          <div style="position:absolute;left:${(h - 140) / 70 * 100}%;top:-4px;width:2px;height:18px;background:var(--accent)"></div></div>
        <div style="display:flex;justify-content:space-between;font-family:var(--mono);font-size:10.5px;color:var(--dim);margin-top:3px"><span>140</span><span>175</span><span>210 cm</span></div>`;
    };
    rng.addEventListener('input', () => { v = +rng.value; num.value = v; draw(); });
    num.addEventListener('input', () => { const x = +num.value; if (x >= 20 && x <= 70){ v = x; rng.value = v; draw(); } });
    draw();
    app.highlight('femur');
  }

  // ---------- edition ----------
  XE.register({
    id: 'forensic',
    bodyClass: 'ed-forensic',
    look: 'solid',
    tabMode: 'single',
    defaultView: 'skel',
    panel: { look: false, names: true },
    renderStyle: {
      bone: { body: 1, solid: [0.93, 0.87, 0.74], edgeA: [0.25, 0.75, 0.85], edgeB: [0.25, 0.75, 0.85], outline: 0, hot: [0.95, 0.69, 0.2] },
    },
    labelStyle: { font: 'IBM Plex Mono, ui-monospace, monospace', weight: 500, size: 11, color: '#e6eef0', leader: 'rgba(79,209,224,.55)',
      sel: '#f2b134', halo: 'rgba(8,14,17,.92)', haloW: 3.5, dot: 2.4, upper: true },
    labelText: (id, side) => {
      const name = XI.part(id)[0].replace(/\s*\(.*\)$/, '');
      return side ? name + ' ' + (side === 'L' ? (XI.lang === 'ms' ? 'KI' : 'L') : (XI.lang === 'ms' ? 'KA' : 'R')) : name;
    },
    drawSettings: () => (drill ? { names: 0 } : {}),
    still: () => !!drill || !!caseRun,
    busy: () => !!drill || !!caseRun,
    card: (id) => ({ html: evidenceHtml(id) }),
    onTap(hit){
      if (drill){ drillTap(hit); return true; }
      if (hit.id){ XS.play('select'); app.select(hit.id); }
      return true;
    },
    mount(a){ app = a; idleDock(); },
    onStart(){ app.setPill(XI.t('fTraining'), 3500); },
    onView(){ app.closeCard(); },
    onLang(){
      if (drill) drillDock(); else idleDock();
      if (caseRun){ caseRun.switching = true; caseStep(); caseRun.switching = false; }
    },
    unmount(){ drill = null; caseRun = null; app.highlight(null); },
  });
})();
