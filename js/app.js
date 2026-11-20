// app.js: wiring, camera + MediaPipe, main loop, status pill, settings UI.
'use strict';
window.XRAPP = (() => {
  const $ = (id) => document.getElementById(id);
  const video = $('video'), photo = $('photo'), bonesCv = $('bones'), labelsCv = $('labels');
  const pill = $('pill'), overlay = $('overlay');
  const st = XU.get();

  let mode = null;            // null | 'demo' | 'camera' | 'photo'
  let photoRaw = null;        // landmarks found in the uploaded photo (photo-normalised)
  let runMode = 'VIDEO';
  let poseLandmarker = null, handLandmarker = null;
  let lastFrame = null;       // last solved frame source (for freeze)
  let curPose = null;
  let t0 = performance.now();
  let noBodySince = 0, loading = true;
  let stream = null;
  let selId = null;

  // ---------- status pill ----------
  let pillMsg = '', pillTimer = 0;
  let pillHold = 0;           // messages set with a hold time are not cleared by the loop until then
  function setPill(msg, hold){
    const now = performance.now();
    if (!msg && now < pillHold) return;
    pillHold = (msg && typeof hold === 'number') ? now + hold : 0;
    pillMsg = msg;
    pill.textContent = msg;
    pill.classList.toggle('show', !!msg);
  }

  // ---------- selection ----------
  function select(id){
    selId = id;
    XL.setSelected(id);
    const P = PARTS[id];
    if (!P) return;
    $('cardName').textContent = P[0];
    $('cardLatin').textContent = P[1];
    $('cardDesc').textContent = P[2];
    const les = lessonFor(id);
    $('cardWatch').classList.toggle('show', !!les);
    $('cardWatch').onclick = les ? () => playLesson(les) : null;
    $('card').classList.add('open');
  }
  $('cardClose').addEventListener('click', () => {
    $('card').classList.remove('open'); selId = null; XL.setSelected(null);
  });

  // ---------- lessons (short videos listed in js/lessons.js) ----------
  const LESSONS = window.LESSONS || [];
  const lessonFor = (id) => LESSONS.find((L) => (L.parts || []).indexOf(id) >= 0) || null;
  // L.src is either one file or one file per language: { en: '...', ms: '...' }
  const LANG_NAMES = { en: 'English', ms: 'Bahasa Melayu' };
  function playLesson(L, lang){
    $('lessons').classList.remove('open');
    const v = $('vPlayer'), bar = $('vLangs');
    const multi = L.src && typeof L.src === 'object';
    const langs = multi ? Object.keys(L.src) : [];
    if (multi && langs.indexOf(lang) < 0) lang = langs.indexOf(st.lessonLang) >= 0 ? st.lessonLang : langs[0];
    $('vTitle').textContent = (multi && L.titles && L.titles[lang]) || L.title;
    bar.textContent = '';
    if (langs.length > 1) for (const k of langs){
      const b = document.createElement('button');
      b.className = 'seg' + (k === lang ? ' on' : '');
      b.textContent = LANG_NAMES[k] || k;
      b.addEventListener('click', () => { XU.set({ lessonLang: k }); Object.assign(st, XU.get()); playLesson(L, k); });
      bar.appendChild(b);
    }
    v.src = multi ? L.src[lang] : L.src;
    if (L.poster) v.poster = L.poster; else v.removeAttribute('poster');
    $('vmodal').classList.add('open');
    v.play().catch(() => {});
  }
  function closeLesson(){
    const v = $('vPlayer');
    v.pause(); v.removeAttribute('src'); v.load();
    $('vmodal').classList.remove('open');
  }
  $('vClose').addEventListener('click', closeLesson);
  $('vmodal').addEventListener('click', (e) => { if (e.target === $('vmodal')) closeLesson(); });
  if (LESSONS.length){
    $('learnBtn').classList.add('show');
    for (const L of LESSONS){
      const b = document.createElement('button');
      b.textContent = L.title;
      if (L.about){ const s = document.createElement('small'); s.textContent = L.about; b.appendChild(s); }
      b.addEventListener('click', () => playLesson(L));
      $('lessons').appendChild(b);
    }
    $('learnBtn').addEventListener('click', () => $('lessons').classList.toggle('open'));
  }

  // ---------- layers ----------
  function ensureSoft(cb){
    if (window.SOFT){ XR.loadSoft(); if (cb) cb(); return; }
    const s = document.createElement('script');
    s.src = 'data/organs-data.js';
    s.onload = () => { XR.loadSoft(); if (cb) cb(); };
    s.onerror = () => setPill('Could not load organ data', false);
    document.head.appendChild(s);
  }
  function setLayer(key, btn){
    XU.set({ [key]: !st[key] });
    Object.assign(st, XU.get());
    if (key === 'layerSkel'){
      $('tabSkel').classList.toggle('on', st.layerSkel);
      if (!st.layerSkel && !st.layerOrg && !st.layerCirc){
        XU.set({ layerSkel: true }); Object.assign(st, XU.get());
        $('tabSkel').classList.add('on');
      }
    } else {
      if (st[key]){
        // mutually exclusive organs/circulation? spec: each toggles its layer
        ensureSoft(() => {});
      }
      $(key === 'layerOrg' ? 'tabOrg' : 'tabCirc').classList.toggle('on', st[key]);
    }
  }
  $('tabSkel').addEventListener('click', () => setLayer('layerSkel'));
  $('tabOrg').addEventListener('click', () => setLayer('layerOrg'));
  $('tabCirc').addEventListener('click', () => setLayer('layerCirc'));

  // ---------- settings panel ----------
  const panel = $('panel');
  $('menuBtn').addEventListener('click', () => panel.classList.toggle('open'));
  $('panelClose').addEventListener('click', () => panel.classList.remove('open'));

  function pairBtns(aId, bId, key, val){ // two mutually exclusive segs
    const a = $(aId), b = $(bId);
    const apply = () => { a.classList.toggle('on', st[key] === val[0]); b.classList.toggle('on', st[key] === val[1]); };
    a.addEventListener('click', () => { XU.set({ [key]: val[0] }); Object.assign(st, XU.get()); apply(); });
    b.addEventListener('click', () => { XU.set({ [key]: val[1] }); Object.assign(st, XU.get()); apply(); });
    apply();
  }
  pairBtns('mirrorBtn', 'realBtn', 'mirror', [true, false]);
  pairBtns('xrayBtn', 'solidBtn', 'look', ['xray', 'solid']);

  $('bright').value = st.bright;
  $('bright').addEventListener('input', (e) => { XU.set({ bright: +e.target.value }); Object.assign(st, XU.get()); });

  const toggles = [['rearBtn','rear'],['freezeBtn','freeze'],['fingersBtn','fingers']];
  for (const [id, key] of toggles){
    const el = $(id);
    el.classList.toggle('on', !!st[key]);
    el.addEventListener('click', () => {
      XU.set({ [key]: !st[key] }); Object.assign(st, XU.get());
      el.classList.toggle('on', !!st[key]);
      if (key === 'rear' && mode === 'camera') startCamera(true);
    });
  }

  // part names radio
  const nameBtns = { 0: $('names0'), 1: $('names1'), 2: $('names2') };
  for (const k of [0, 1, 2]){
    nameBtns[k].classList.toggle('on', st.names === +k);
    nameBtns[k].addEventListener('click', () => {
      XU.set({ names: +k }); Object.assign(st, XU.get());
      for (const j of [0, 1, 2]) nameBtns[j].classList.toggle('on', st.names === +j);
    });
  }
  $('textSize').value = st.textSize;
  $('textSize').addEventListener('input', (e) => { XU.set({ textSize: +e.target.value }); Object.assign(st, XU.get()); });

  // video mirroring (CSS)
  function applyVideoClass(){
    video.classList.toggle('real', !st.mirror);
    video.style.display = mode === 'camera' ? '' : 'none';
    photo.style.display = mode === 'photo' ? 'block' : 'none';
  }

  // ---------- start ----------
  function startDemo(){
    mode = 'demo'; loading = false;
    overlay.classList.add('hide');
    setPill('', false);
    XP.reset();
    applyVideoClass();
  }
  function begin(){
    XR.init(bonesCv);
    XL.init(labelsCv);
    applyVideoClass();
    requestAnimationFrame(loop);
  }
  $('startDemo').addEventListener('click', startDemo);
  $('startCam').addEventListener('click', () => startCamera(false));
  $('liveBtn').addEventListener('click', () => { panel.classList.remove('open'); startCamera(false); });
  for (const id of ['startPhoto', 'photoBtn'])
    $(id).addEventListener('click', () => { $('photoInput').value = ''; $('photoInput').click(); });
  $('photoInput').addEventListener('change', (e) => {
    const f = e.target.files && e.target.files[0];
    if (f){ panel.classList.remove('open'); usePhoto(URL.createObjectURL(f)); }
  });

  // ---------- camera + mediapipe ----------
  async function loadModels(){
    if (poseLandmarker) return;
    setPill('Loading models…', true);
    const base = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14';
    const vision = await import(base + '/vision_bundle.mjs');
    const fileset = await vision.FilesetResolver.forVisionTasks(base + '/wasm');
    const opts = (delegate) => ({
      baseOptions: {
        modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/latest/pose_landmarker_full.task',
        delegate },
      runningMode: 'VIDEO', numPoses: 1,
    });
    try {
      poseLandmarker = await vision.PoseLandmarker.createFromOptions(fileset, opts('GPU'));
    } catch (e) {
      poseLandmarker = await vision.PoseLandmarker.createFromOptions(fileset, opts('CPU'));
    }
    const hopts = (delegate) => ({
      baseOptions: {
        modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/latest/hand_landmarker.task',
        delegate },
      runningMode: 'VIDEO', numHands: 2,
    });
    try {
      handLandmarker = await vision.HandLandmarker.createFromOptions(fileset, hopts('GPU'));
    } catch (e) {
      handLandmarker = await vision.HandLandmarker.createFromOptions(fileset, hopts('CPU'));
    }
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

  // Landmarks come back relative to the source picture. The picture is drawn
  // with object-fit (cover for the camera, contain for a photo), so re-map them
  // onto the canvas, which fills the whole stage.
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

  // ---------- photo mode ----------
  async function usePhoto(url){
    const back = mode;
    overlay.classList.add('hide');
    setPill('Reading your photo\u2026');
    try {
      photo.crossOrigin = 'anonymous';
      photo.src = url;
      await photo.decode();
    } catch (e) {
      setPill('That file could not be opened as a picture.', 5000);
      if (back === null) overlay.classList.remove('hide');
      return;
    }
    try { await loadModels(); await setRunMode('IMAGE'); } catch (e) {
      setPill('Could not load tracking models (offline?). Use Demo without camera.', 5000);
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
    if (st.freeze){ XU.set({ freeze: false }); Object.assign(st, XU.get()); $('freezeBtn').classList.remove('on'); }
    XP.reset();
    applyVideoClass();
    setPill(photoRaw ? '' : 'No body found in this photo. Try one that shows you head to toe, in good light.');
  }

  async function startCamera(restart){
    overlay.classList.add('hide');
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
      mode = null;
      overlay.classList.remove('hide');
      const why = { NotAllowedError: 'Camera permission was blocked', NotFoundError: 'No camera was found',
        NotReadableError: 'The camera is busy in another app', OverconstrainedError: 'This camera is not supported',
        SecurityError: 'Camera needs https or localhost' }[err && err.name] || 'The camera could not start';
      setPill(why + '. Allow camera access, or try Demo without camera.');
      return;
    }
    try { await loadModels(); await setRunMode('VIDEO'); } catch (e) {
      setPill('Could not load tracking models (offline?). Use Demo without camera.');
      mode = null;
      overlay.classList.remove('hide');
      return;
    }
    loading = false;
    setPill('', false);
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
      if (mode === null) { if (!loading) setPill('', false); return; }
      const W = bonesCv.width, H = bonesCv.height;
      let frame = null;
      if (st.freeze && mode !== 'photo'){ frame = lastFrame; }
      else if (mode === 'demo'){ frame = XP.demoFrame(t, W, H); }
      else if (mode === 'camera'){ frame = readCamera(); }
      else if (mode === 'photo'){
        if (!photoRaw){ XR.draw({ seg: {}, mainOK: false }, st, t); return; }   // keep the hint on screen
        frame = fitFrame(photoRaw, photo.naturalWidth, photo.naturalHeight, false);
      }
      if (frame && mode !== 'photo') lastFrame = frame;
      if (mode === 'camera' && !frame){
        if (!noBodySince) noBodySince = performance.now();
        else if (performance.now() - noBodySince > 800) setPill('No body found', false);
      } else {
        noBodySince = 0;
        // step-back hint: tracked body taller than 92% of frame
        if (frame){
          let y0 = 1, y1 = 0;
          for (const p of frame.img){ if (p[2] > 0.4){ y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); } }
          // step-back hint: tracked body taller than 92% of frame (never demo)
          if (mode === 'camera' && y1 - y0 > 0.92) setPill('Step back', false);
          else if (!loading) setPill('', false);
        }
      }
      if (frame){
        curPose = XP.solve(frame, W, H, mode === 'photo' ? false : st.mirror, selId);
        XR.draw(curPose, st, t);
        XL.draw(curPose, st, t);
      } else {
        XR.draw({ seg: {}, mainOK: false }, st, t);
      }
    } catch (e) {
      console.error(e);
    }
  }

  // ?demo=1 autostart (extra params: organs / circ pre-enable layers for testing)
  begin();
  const params = new URLSearchParams(location.search);
  const selfTest = params.get('selftest') === '1';
  if (params.get('demo') === '1' || selfTest){
    if (params.get('organs')) { XU.set({ layerOrg: true, layerSkel: false }); Object.assign(st, XU.get()); $('tabOrg').classList.add('on'); $('tabSkel').classList.remove('on'); ensureSoft(); }
    if (params.get('circ')) { XU.set({ layerCirc: true, layerSkel: false }); Object.assign(st, XU.get()); $('tabCirc').classList.add('on'); $('tabSkel').classList.remove('on'); ensureSoft(); }
    if (selfTest && !params.get('organs') && !params.get('circ')) ensureSoft();  // heart/thorax check needs SOFT
    if (params.get('look')) { XU.set({ look: params.get('look') }); Object.assign(st, XU.get());
      $('xrayBtn').classList.toggle('on', st.look === 'xray'); $('solidBtn').classList.toggle('on', st.look === 'solid'); }
    startDemo();
  } else {
    loading = true;
  }

  return { select, usePhoto, playLesson };
})();