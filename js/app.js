// app.js: wiring. Start flow and editions, camera + MediaPipe, main loop, status pill, settings, lessons, info card.
'use strict';
window.XRAPP = (() => {
  const $ = (id) => document.getElementById(id);
  const video = $('video'), photo = $('photo'), bonesCv = $('bones'), labelsCv = $('labels');
  const pill = $('pill'), overlay = $('overlay');
  const st = XU.get();
  const params = new URLSearchParams(location.search);
  const save = (patch) => { XU.set(patch); Object.assign(st, XU.get()); };

  let mode = null;            // null | 'demo' | 'camera' | 'photo'
  let photoRaw = null;        // landmarks found in the uploaded photo (photo-normalised)
  let runMode = 'VIDEO';
  let poseLandmarker = null, handLandmarker = null;
  let lastFrame = null, curPose = null, curFrame = null;
  const t0 = performance.now();
  let noBodySince = 0, loading = false;
  let stream = null;
  let selId = null;
  let ed = null;              // current edition object
  let view = 'skel';          // single-select view for editions with tabMode 'single'
  let hiId = null;            // bone tinted on request of an activity (hint)

  // ---------- status pill ----------
  let pillHold = 0;           // messages set with a hold time are not cleared by the loop until then
  function setPill(msg, hold){
    const now = performance.now();
    if (!msg && now < pillHold) return;
    pillHold = (msg && typeof hold === 'number') ? now + hold : 0;
    pill.textContent = msg || '';
    pill.classList.toggle('show', !!msg);
  }

  // ---------- popovers and the edition sheet ----------
  const pops = ['lessons', 'panel'];
  function closePops(except){ for (const p of pops) if (p !== except) $(p).classList.remove('open'); }
  function togglePop(id){ closePops(id); $(id).classList.toggle('open'); XS.play('tap'); }
  let sheetClose = null;
  function openSheet(html, onClose){
    const sh = $('sheet');
    sh.innerHTML = html;
    sh.classList.add('open'); $('scrim').classList.add('open');
    sheetClose = onClose || null;
    sh.querySelectorAll('[data-close]').forEach((x) => x.addEventListener('click', closeSheet));
    XS.play('open');
    return sh;
  }
  function closeSheet(){
    if (!$('sheet').classList.contains('open')) return;
    $('sheet').classList.remove('open'); $('scrim').classList.remove('open');
    const f = sheetClose; sheetClose = null;
    if (f) f();
  }
  $('scrim').addEventListener('click', () => { closeSheet(); XS.play('close'); });

  // ---------- selection and the info card ----------
  function select(id, opts){
    if (!id) return;
    selId = id;
    XL.setSelected(id);
    const c = (ed.card && ed.card(id)) || null;
    const P = XI.part(id);
    $('cardName').textContent = c && c.name !== undefined ? c.name : P[0];
    $('cardLatin').textContent = c && c.latin !== undefined ? c.latin : P[1];
    $('cardLatin').style.display = $('cardLatin').textContent ? '' : 'none';
    $('cardDesc').textContent = c && c.desc !== undefined ? c.desc : P[2];
    $('cardBody').innerHTML = c && c.html ? c.html : '';
    if (c && c.wire) c.wire($('cardBody'));
    const les = lessonFor(id);
    $('cardWatch').onclick = les ? () => playLesson(les) : null;
    $('card').classList.add('open');
    document.body.classList.add('card-on');
    // a part with its own lesson plays it in the left panel (never during an activity)
    if (!(opts && opts.quiet) && les && les !== curLesson && (les.parts || []).indexOf(id) >= 0 && !(ed.busy && ed.busy())) playLesson(les);
    syncWatch();
  }
  function closeCard(){
    $('card').classList.remove('open'); document.body.classList.remove('card-on');
    selId = null; XL.setSelected(null);
  }
  $('cardClose').addEventListener('click', () => { closeCard(); XS.play('close'); });

  // ---------- lessons (short videos listed in js/lessons.js) ----------
  // { id, edition, tabs: ['skel'|'org'|'circ'], parts: [...], title, titles: {en, ms}, about, abouts, src: {en, ms}, poster }
  const LESSONS = window.LESSONS || [];
  const edLessons = () => LESSONS.filter((L) => (L.edition || 'explore') === ed.id);
  const layerOf = (id) => {
    const s = window.SOFT && window.SOFT.labels.find((x) => x.id === id);
    return s ? (s.grp === 'vessels' ? 'circ' : 'org') : 'skel';
  };
  const lessonFor = (id) => {
    const mine = edLessons();
    return mine.find((x) => (x.parts || []).indexOf(id) >= 0) ||
           mine.find((x) => (x.tabs || []).indexOf(layerOf(id)) >= 0) || null;
  };
  const tabLesson = (tab) => edLessons().find((x) => (x.tabs || []).indexOf(tab) >= 0) || null;
  let curLesson = null;
  function syncWatch(){
    const les = selId ? lessonFor(selId) : null;
    $('cardWatch').classList.toggle('show', !!les && les !== curLesson);
  }
  const lessonTitle = (L) => (L.titles && L.titles[XI.lang]) || L.title;
  function playLesson(L, lang){
    curLesson = L;
    closePops();
    const v = $('vPlayer'), bar = $('vLangs');
    const multi = L.src && typeof L.src === 'object';
    const langs = multi ? Object.keys(L.src) : [];
    if (multi && langs.indexOf(lang) < 0) lang = langs.indexOf(XI.lang) >= 0 ? XI.lang : langs[0];
    $('vTitle').textContent = lessonTitle(L);
    bar.textContent = '';
    if (langs.length > 1) for (const k of langs){
      const b = document.createElement('button');
      b.className = 'seg' + (k === lang ? ' on' : '');
      b.textContent = k === 'ms' ? 'BM' : 'EN';
      b.addEventListener('click', () => {
        const at = v.currentTime; playLesson(L, k);
        v.addEventListener('loadedmetadata', () => { v.currentTime = at; }, { once: true });
      });
      bar.appendChild(b);
    }
    v.src = multi ? L.src[lang] : L.src;
    if (L.poster) v.poster = L.poster; else v.removeAttribute('poster');
    v.dataset.lang = lang || '';
    $('vdock').classList.add('open'); document.body.classList.add('vdock-on'); safeAt = 0;
    syncWatch();
    v.play().catch(() => {});
  }
  function closeLesson(){
    const v = $('vPlayer');
    v.pause(); v.removeAttribute('src'); v.load();
    $('vdock').classList.remove('open'); document.body.classList.remove('vdock-on'); safeAt = 0;
    curLesson = null;
    syncWatch();
  }
  $('vClose').addEventListener('click', () => { closeLesson(); XS.play('close'); });
  function buildLessonList(){
    const box = $('lessons'), mine = edLessons();
    box.textContent = '';
    $('learnBtn').classList.toggle('hidden', !mine.length);
    for (const L of mine){
      const b = document.createElement('button');
      if (L.poster){ const im = document.createElement('img'); im.src = L.poster; im.alt = ''; b.appendChild(im); }
      const d = document.createElement('div');
      const bt = document.createElement('b'); bt.textContent = lessonTitle(L); d.appendChild(bt);
      const ab = (L.abouts && L.abouts[XI.lang]) || L.about;
      if (ab){ const s = document.createElement('small'); s.textContent = ab; d.appendChild(s); }
      b.appendChild(d);
      b.addEventListener('click', () => playLesson(L));
      box.appendChild(b);
    }
  }
  $('learnBtn').addEventListener('click', () => togglePop('lessons'));

  // ---------- layers and views ----------
  const softQ = [];
  let softLoading = false;
  function ensureSoft(cb){
    if (window.SOFT){ XR.loadSoft(); if (cb) cb(); return; }
    if (cb) softQ.push(cb);
    if (softLoading) return;
    softLoading = true;
    const s = document.createElement('script');
    s.src = 'data/organs-data.js';
    s.onload = () => { XR.loadSoft(); while (softQ.length) softQ.shift()(); };
    s.onerror = () => { softLoading = false; setPill(XI.t('organFail'), 4000); };
    document.head.appendChild(s);
  }
  const TAB = { skel: 'tabSkel', org: 'tabOrg', circ: 'tabCirc' };
  function syncTabs(){
    if (ed.tabMode === 'single'){ for (const k in TAB) $(TAB[k]).classList.toggle('on', k === view); }
    else {
      $('tabSkel').classList.toggle('on', !!st.layerSkel);
      $('tabOrg').classList.toggle('on', !!st.layerOrg);
      $('tabCirc').classList.toggle('on', !!st.layerCirc);
    }
  }
  // single-select view (kids, forensic); quiet = do not start the tab lesson
  function setView(v, quiet){
    view = v;
    if (v !== 'skel') ensureSoft();
    syncTabs();
    if (ed.onView) ed.onView(v);
    if (!quiet) maybeTabLesson(v);
  }
  function maybeTabLesson(tab){
    if (ed.busy && ed.busy()) return;
    const L = tabLesson(tab);
    if (L && L !== curLesson) playLesson(L);
  }
  function toggleLayer(key, tab){
    save({ [key]: !st[key] });
    if (!st.layerSkel && !st.layerOrg && !st.layerCirc) save({ layerSkel: true });
    if (st[key] && key !== 'layerSkel') ensureSoft();
    syncTabs();
    if (st[key]) maybeTabLesson(tab);
  }
  function tab(tabKey){
    XS.play('tap');
    if (ed.tabMode === 'single') setView(tabKey);
    else toggleLayer({ skel: 'layerSkel', org: 'layerOrg', circ: 'layerCirc' }[tabKey], tabKey);
  }
  $('tabSkel').addEventListener('click', () => tab('skel'));
  $('tabOrg').addEventListener('click', () => tab('org'));
  $('tabCirc').addEventListener('click', () => tab('circ'));
  // settings used for drawing: the stored ones, with the view and the edition's overrides applied
  function drawSt(){
    const d = Object.assign({}, st);
    if (ed.tabMode === 'single'){
      d.layerSkel = view === 'skel' || view === 'circ';
      d.layerOrg = view === 'org';
      d.layerCirc = view === 'circ';
    }
    if (ed.look) d.look = ed.look;
    if (ed.names !== undefined) d.names = ed.names;
    if (ed.drawSettings) Object.assign(d, ed.drawSettings(d));
    return d;
  }

  // ---------- settings panel ----------
  $('menuBtn').addEventListener('click', () => togglePop('panel'));
  function pairBtns(aId, bId, key, val){ // two mutually exclusive segs
    const a = $(aId), b = $(bId);
    const apply = () => { a.classList.toggle('on', st[key] === val[0]); b.classList.toggle('on', st[key] === val[1]); };
    a.addEventListener('click', () => { save({ [key]: val[0] }); apply(); XS.play('tap'); });
    b.addEventListener('click', () => { save({ [key]: val[1] }); apply(); XS.play('tap'); });
    apply();
  }
  pairBtns('mirrorBtn', 'realBtn', 'mirror', [true, false]);
  pairBtns('xrayBtn', 'solidBtn', 'look', ['xray', 'solid']);
  $('bright').value = st.bright;
  $('bright').addEventListener('input', (e) => save({ bright: +e.target.value }));
  for (const [id, key] of [['rearBtn', 'rear'], ['freezeBtn', 'freeze'], ['fingersBtn', 'fingers']]){
    const el = $(id);
    el.classList.toggle('on', !!st[key]);
    el.addEventListener('click', () => {
      save({ [key]: !st[key] });
      el.classList.toggle('on', !!st[key]);
      XS.play('tap');
      if (key === 'rear' && mode === 'camera') startCamera();
    });
  }
  const nameBtns = [$('names0'), $('names1'), $('names2')];
  nameBtns.forEach((b, k) => {
    b.classList.toggle('on', st.names === k);
    b.addEventListener('click', () => { save({ names: k }); nameBtns.forEach((x, j) => x.classList.toggle('on', st.names === j)); XS.play('tap'); });
  });
  $('textSize').value = st.textSize;
  $('textSize').addEventListener('input', (e) => save({ textSize: +e.target.value }));
  // zoom (demo pose only): whole body, head, chest, hips, legs
  const ZOOMS = { body: { k: 1, cx: 0.5, cy: 0.5 }, head: { k: 2.8, cx: 0.5, cy: 0.17 }, chest: { k: 2.0, cx: 0.5, cy: 0.33 },
                  hips: { k: 2.2, cx: 0.5, cy: 0.52 }, legs: { k: 1.6, cx: 0.5, cy: 0.72 } };
  let zoom = 'body';
  function buildZoom(){
    const row = $('zoomRow'); row.textContent = '';
    for (const z of Object.keys(ZOOMS)){
      const b = document.createElement('button');
      b.className = 'seg' + (z === zoom ? ' on' : '');
      b.textContent = XI.t('zoom' + z.charAt(0).toUpperCase() + z.slice(1));
      b.addEventListener('click', () => { setZoom(z); XS.play('tap'); });
      row.appendChild(b);
    }
  }
  function setZoom(z){ zoom = ZOOMS[z] ? z : 'body'; buildZoom(); XP.reset(); }
  // keep the demo body inside the free area between the top bar and the bottom controls
  let safeT = 0, safeB = 1, safeAt = 0, safeX = 0.5, safeW = 1;
  function fitView(z){
    const now = performance.now();
    if (now - safeAt > 500){
      safeAt = now;
      const H = innerHeight || 1;
      const top = $('top').getBoundingClientRect().bottom + 6;
      let bot = $('tabs').getBoundingClientRect().top - 6;
      const dk = $('dock').firstElementChild;
      if (dk) bot = Math.min(bot, dk.getBoundingClientRect().top - 6);
      safeT = Math.max(0, top / H); safeB = Math.min(1, Math.max(safeT + 0.3, bot / H));
      // with the lesson panel open, centre the body in the space to its right
      const vd = $('vdock'), W = innerWidth || 1;
      const left = vd.classList.contains('open') ? vd.getBoundingClientRect().right + 4 : 0;
      safeX = (left + W) / 2 / W; safeW = (W - left) / W;
    }
    // the demo body spans 0.06..0.94 of the frame; scale it so 0..1 of the free band holds it
    const band = safeB - safeT, s = band / 0.9 * Math.min(1, safeW / 0.7);
    // the demo pose is drawn mirrored when the mirror setting is on, so the target x flips too
    return { k: z.k * s, cx: z.cx, cy: z.cy, tx: st.mirror ? 1 - safeX : safeX, ty: safeT + band * 0.5 };
  }
  $('edBtn').addEventListener('click', () => { closePops(); goHome(); });
  function syncPanel(){
    const p = ed.panel || {};
    $('lookBox').classList.toggle('hidden', !p.look);
    $('namesBox').classList.toggle('hidden', !p.names);
    $('zoomBox').classList.toggle('hidden', mode !== 'demo');
  }

  // ---------- language and sound ----------
  function syncLang(){
    XI.apply();
    $('langBtn').textContent = XI.lang === 'ms' ? 'BM' : 'EN';
    $('langBtn').setAttribute('aria-label', XI.t('language') + ': ' + (XI.lang === 'ms' ? 'Bahasa Melayu' : 'English'));
    document.title = XI.t('appName');
    $('ovTitle').textContent = XI.t('appName');
    document.querySelectorAll('#ovLang button').forEach((b) => b.classList.toggle('on', b.dataset.l === XI.lang));
    buildZoom();
    if (pendingEd) $('edNote').textContent = noteFor(pendingEd);
  }
  XI.on(() => {
    syncLang();
    buildLessonList();
    if (ed && ed.onLang) ed.onLang();
    if (selId) select(selId, { quiet: true });
    // a playing lesson follows the app language
    const v = $('vPlayer');
    if (curLesson && curLesson.src && curLesson.src[XI.lang] && v.dataset.lang !== XI.lang){
      const at = v.currentTime; playLesson(curLesson, XI.lang);
      v.addEventListener('loadedmetadata', () => { v.currentTime = at; }, { once: true });
    }
  });
  $('langBtn').addEventListener('click', () => { XS.play('tap'); XI.set(XI.lang === 'ms' ? 'en' : 'ms'); });
  document.querySelectorAll('#ovLang button').forEach((b) => b.addEventListener('click', () => XI.set(b.dataset.l)));
  function syncSound(){
    XS.setMuted(st.sound === false);
    $('soundBtn').querySelector('use').setAttribute('href', st.sound === false ? '#i-mute' : '#i-sound');
    $('soundBtn').setAttribute('aria-pressed', st.sound === false ? 'false' : 'true');
  }
  $('soundBtn').addEventListener('click', () => { save({ sound: st.sound === false }); syncSound(); XS.play('tap'); });

  // ---------- editions ----------
  function setEdition(id){
    const next = XE.get(id);
    if (ed && ed.unmount) ed.unmount();
    closeSheet(); closeCard(); closeLesson(); closePops();
    $('dock').textContent = ''; document.body.classList.remove('dock-on');
    hiId = null;
    ed = next;
    save({ edition: ed.id });
    document.body.className = ed.bodyClass || ('ed-' + ed.id);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = getComputedStyle(document.body).getPropertyValue('--bg').trim() || '#0b0a14';
    XR.setStyle(ed.renderStyle || null);
    XL.setStyle(ed.labelStyle || null);
    XL.setFilter(ed.labelFilter || null);
    XL.setText(ed.labelText || null);
    XL.onTap((hit) => {
      closePops();
      if (ed.onTap && ed.onTap(hit)) return;
      if (hit.id){ XS.play('select'); select(hit.id); }
    });
    view = ed.defaultView || 'skel';
    if (ed.tabMode === 'single' && view !== 'skel') ensureSoft();
    syncTabs(); syncPanel(); buildLessonList();
    if (ed.mount) ed.mount(api);
  }

  // ---------- start flow ----------
  let pendingEd = null;
  const noteFor = (id) => id === 'kids' ? XI.t('kidsHelper') : id === 'forensic' ? XI.t('forensicNote') : '';
  function showStep(n){
    $('step1').classList.toggle('hidden', n !== 1);
    $('step2').classList.toggle('hidden', n !== 2);
  }
  function goHome(){
    showStep(1);
    overlay.classList.remove('hide');
    document.querySelectorAll('.ed').forEach((b) => b.classList.toggle('sel', mode !== null && b.dataset.ed === ed.id));
  }
  function pickEdition(id){
    pendingEd = id;
    if (mode !== null){            // already running: switch edition and go straight back in
      setEdition(id);
      overlay.classList.add('hide');
      if (ed.onStart) ed.onStart(mode);
      return;
    }
    const card = document.querySelector(`.ed[data-ed="${id}"]`).cloneNode(true);
    card.classList.add('sel'); card.style.maxWidth = '420px'; card.style.pointerEvents = 'none'; card.removeAttribute('data-ed');
    $('edHead').textContent = ''; $('edHead').appendChild(card);
    $('edNote').textContent = noteFor(id);
    showStep(2);
  }
  document.querySelectorAll('.ed').forEach((b) => b.addEventListener('click', () => { XS.play('select'); pickEdition(b.dataset.ed); }));
  $('ovBack').addEventListener('click', () => showStep(1));
  $('homeBtn').addEventListener('click', () => { XS.play('tap'); closePops(); goHome(); });
  function enter(){ if (pendingEd && (!ed || pendingEd !== ed.id)) setEdition(pendingEd); }

  // video mirroring (CSS)
  function applyVideoClass(){
    video.classList.toggle('real', !st.mirror);
    video.style.display = mode === 'camera' ? '' : 'none';
    photo.style.display = mode === 'photo' ? 'block' : 'none';
    syncPanel();
  }

  function startDemo(){
    enter();
    stopStream();
    mode = 'demo'; loading = false;
    overlay.classList.add('hide');
    setPill('', false);
    XP.reset();
    applyVideoClass();
    if (ed.onStart) ed.onStart(mode);
  }
  $('startDemo').addEventListener('click', startDemo);
  $('startCam').addEventListener('click', () => { enter(); startCamera(); });
  $('liveBtn').addEventListener('click', () => { closePops(); startCamera(); });
  for (const id of ['startPhoto', 'photoBtn'])
    $(id).addEventListener('click', () => { enter(); $('photoInput').value = ''; $('photoInput').click(); });
  $('photoInput').addEventListener('change', (e) => {
    const f = e.target.files && e.target.files[0];
    if (f){ closePops(); usePhoto(URL.createObjectURL(f)); }
  });

  // ---------- camera + mediapipe ----------
  async function loadModels(){
    if (poseLandmarker) return;
    setPill(XI.t('loading'));
    loading = true;
    const base = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14';
    const vision = await import(base + '/vision_bundle.mjs');
    const fileset = await vision.FilesetResolver.forVisionTasks(base + '/wasm');
    const opts = (delegate) => ({
      baseOptions: {
        modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/latest/pose_landmarker_full.task',
        delegate },
      runningMode: 'VIDEO', numPoses: 1,
    });
    try { poseLandmarker = await vision.PoseLandmarker.createFromOptions(fileset, opts('GPU')); }
    catch (e) { poseLandmarker = await vision.PoseLandmarker.createFromOptions(fileset, opts('CPU')); }
    const hopts = (delegate) => ({
      baseOptions: {
        modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/latest/hand_landmarker.task',
        delegate },
      runningMode: 'VIDEO', numHands: 2,
    });
    try { handLandmarker = await vision.HandLandmarker.createFromOptions(fileset, hopts('GPU')); }
    catch (e) { handLandmarker = await vision.HandLandmarker.createFromOptions(fileset, hopts('CPU')); }
    loading = false;
  }
  async function setRunMode(m){
    if (runMode === m) return;
    await poseLandmarker.setOptions({ runningMode: m });
    await handLandmarker.setOptions({ runningMode: m });
    runMode = m;
  }
  function stopStream(){
    if (stream) { stream.getTracks().forEach((tr) => tr.stop()); stream = null; }
    video.srcObject = null;
  }

  // Landmarks come back relative to the source picture. The picture is drawn with object-fit
  // (cover for the camera, contain for a photo), so re-map them onto the canvas, which fills the stage.
  function fitFrame(raw, sw, sh, cover){
    const W = bonesCv.width, H = bonesCv.height;
    if (!sw || !sh || !W || !H) return raw;
    const s = cover ? Math.max(W / sw, H / sh) : Math.min(W / sw, H / sh);
    const kx = sw * s / W, ky = sh * s / H;
    const map = (pts) => pts.map((p) => [(p[0] - 0.5) * kx + 0.5, (p[1] - 0.5) * ky + 0.5, p[2]]);
    const hands = {};
    for (const side in raw.hands) hands[side] = { img: map(raw.hands[side].img), world: raw.hands[side].world };
    return { img: map(raw.img), world: raw.world, hands };
  }

  async function usePhoto(url){
    const back = mode;
    overlay.classList.add('hide');
    setPill(XI.t('readingPhoto'));
    try {
      photo.crossOrigin = 'anonymous';
      photo.src = url;
      await photo.decode();
    } catch (e) {
      setPill(XI.t('photoBad'), 5000);
      if (back === null) overlay.classList.remove('hide');
      return;
    }
    try { await loadModels(); await setRunMode('IMAGE'); } catch (e) {
      loading = false;
      setPill(XI.t('modelsFail'), 5000);
      if (back === null) overlay.classList.remove('hide');
      return;
    }
    stopStream();
    // detect on a copy no larger than 1600 px so huge phone photos stay within GPU limits
    const k = Math.min(1, 1600 / Math.max(photo.naturalWidth, photo.naturalHeight));
    const cv = document.createElement('canvas');
    cv.width = Math.round(photo.naturalWidth * k); cv.height = Math.round(photo.naturalHeight * k);
    cv.getContext('2d').drawImage(photo, 0, 0, cv.width, cv.height);
    photoRaw = toFrame(poseLandmarker.detect(cv), handLandmarker.detect(cv));
    mode = 'photo'; loading = false;
    lastFrame = null;
    if (st.freeze){ save({ freeze: false }); $('freezeBtn').classList.remove('on'); }
    XP.reset();
    applyVideoClass();
    if (photoRaw) setPill('', false); else setPill(XI.t('photoNoBody'), 6000);
    if (ed.onStart) ed.onStart(mode);
  }

  async function startCamera(){
    overlay.classList.add('hide');
    const prev = mode;
    mode = 'camera';
    XP.reset();
    applyVideoClass();
    try {
      stopStream();
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: st.rear ? 'environment' : 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      video.srcObject = stream;
      await video.play();
    } catch (err) {
      mode = prev === 'camera' ? null : prev;
      applyVideoClass();
      if (mode === null){ overlay.classList.remove('hide'); showStep(2); }
      setPill(XI.t('camFail'), 6000);
      return;
    }
    try { await loadModels(); await setRunMode('VIDEO'); } catch (e) {
      loading = false;
      setPill(XI.t('modelsFail'), 6000);
      stopStream();
      mode = null; applyVideoClass();
      overlay.classList.remove('hide'); showStep(2);
      return;
    }
    setPill('', false);
    if (ed.onStart) ed.onStart(mode);
  }

  // MediaPipe results -> { img, world, hands } in source-picture coordinates
  function toFrame(pose, hres){
    if (!pose.landmarks || !pose.landmarks.length) return null;
    const lm = pose.landmarks[0];
    const img = lm.map((p) => [p.x, p.y, p.visibility === undefined ? 1 : p.visibility]);
    const world = (pose.worldLandmarks && pose.worldLandmarks.length)
      ? pose.worldLandmarks[0].map((p) => [p.x, p.y, p.z]) : img.map(() => [0, 0, 0]);
    const hands = {};
    for (const hl of ((hres && hres.landmarks) || [])){
      const w0 = hl[0];
      // associate by proximity to wrists (15 left, 16 right) in image coords
      const dL = Math.abs(w0.x - img[15][0]) + Math.abs(w0.y - img[15][1]);
      const dR = Math.abs(w0.x - img[16][0]) + Math.abs(w0.y - img[16][1]);
      const side = dL < dR ? 'L' : 'R';
      if (hands[side]) continue;
      hands[side] = {
        img: hl.map((p) => [p.x, p.y, p.visibility === undefined ? 1 : p.visibility]),
        world: hl.map((p) => [p.x, p.y, p.z]),
      };
    }
    return { img, world, hands };
  }
  function readCamera(){
    if (!poseLandmarker || runMode !== 'VIDEO' || video.readyState < 2) return null;
    const now = performance.now();
    const raw = toFrame(poseLandmarker.detectForVideo(video, now),
                        handLandmarker ? handLandmarker.detectForVideo(video, now) : null);
    return raw && fitFrame(raw, video.videoWidth, video.videoHeight, true);
  }

  // ---------- main loop ----------
  function loop(){
    requestAnimationFrame(loop);
    try {
      const t = (performance.now() - t0) / 1000;
      if (mode === null) return;
      const W = bonesCv.width, H = bonesCv.height;
      const dst = drawSt();
      let frame = null;
      if (st.freeze && mode !== 'photo'){ frame = lastFrame; }
      else if (mode === 'demo'){ frame = XP.viewFrame(XP.demoFrame(t, W, H, !!(ed.still && ed.still())), fitView(ZOOMS[zoom])); }
      else if (mode === 'camera'){ frame = readCamera(); }
      else if (mode === 'photo'){
        if (!photoRaw){ XR.draw({ seg: {}, mainOK: false }, dst, t); XL.draw(null, dst, t); return; }
        frame = fitFrame(photoRaw, photo.naturalWidth, photo.naturalHeight, false);
      }
      if (frame && mode !== 'photo') lastFrame = frame;
      if (mode === 'camera' && !frame){
        if (!noBodySince) noBodySince = performance.now();
        else if (performance.now() - noBodySince > 800) setPill(XI.t('noBody'), false);
      } else {
        noBodySince = 0;
        if (frame){
          let y0 = 1, y1 = 0;
          for (const p of frame.img){ if (p[2] > 0.4){ y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); } }
          if (mode === 'camera' && y1 - y0 > 0.92) setPill(XI.t('stepBack'), false);
          else if (!loading) setPill('', false);
        }
      }
      curFrame = frame;
      if (frame){
        const tint = hiId || (selId && window.SKEL.ids.indexOf(selId) >= 0 ? selId : null);
        curPose = XP.solve(frame, W, H, mode === 'photo' ? false : st.mirror, tint);
        XR.draw(curPose, dst, t);
        XL.draw(curPose, dst, t);
        if (ed.onFrame) ed.onFrame(curPose, t);
      } else {
        curPose = null;
        XR.draw({ seg: {}, mainOK: false }, dst, t);
        XL.draw(null, dst, t);
      }
    } catch (e) {
      console.error(e);
    }
  }

  // ---------- API for edition modules ----------
  const api = {
    $, t: XI.t, setPill, select, closeCard, openSheet, closeSheet, playLesson, closeLesson, lessonFor,
    lessons: () => edLessons(), setView, view: () => view, ensureSoft,
    highlight: (id) => { hiId = id || null; },          // tint one bone (hints); null to clear
    setSelected: (id) => { selId = id; XL.setSelected(id); },
    mode: () => mode, pose: () => curPose, frame: () => curFrame,
    dock: (el) => { const d = $('dock'); d.textContent = ''; if (el) d.appendChild(el); document.body.classList.toggle('dock-on', !!el); },
    css: (name) => getComputedStyle(document.body).getPropertyValue(name).trim(),
    settings: () => st, save,
  };

  // ---------- boot ----------
  XR.init(bonesCv);
  XL.init(labelsCv);
  syncSound();
  setEdition(XE.has(params.get('edition')) ? params.get('edition') : (XE.has(st.edition) ? st.edition : 'explore'));
  syncLang();
  applyVideoClass();
  requestAnimationFrame(loop);

  // ?demo=1 autostart (extra params: edition, organs / circ pre-enable layers, look, zoom); ?selftest=1
  const selfTest = params.get('selftest') === '1';
  if (params.get('demo') === '1' || selfTest){
    if (ed.tabMode === 'single'){
      if (params.get('organs')) setView('org', true);
      if (params.get('circ')) setView('circ', true);
    } else {
      if (params.get('organs')) { save({ layerOrg: true, layerSkel: false }); ensureSoft(); }
      if (params.get('circ')) { save({ layerCirc: true, layerSkel: false }); ensureSoft(); }
      syncTabs();
    }
    if (selfTest && !params.get('organs') && !params.get('circ')) ensureSoft();  // heart/thorax check needs SOFT
    if (params.get('look')) { save({ look: params.get('look') });
      $('xrayBtn').classList.toggle('on', st.look === 'xray'); $('solidBtn').classList.toggle('on', st.look === 'solid'); }
    if (params.get('zoom')) setZoom(params.get('zoom'));
    pendingEd = ed.id;
    startDemo();
  } else {
    goHome();
    if (XE.has(params.get('edition'))) pickEdition(params.get('edition'));
  }

  return Object.assign({ usePhoto, debug: { drawSt, view: () => view } }, api);
})();
