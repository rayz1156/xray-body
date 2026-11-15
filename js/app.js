// app.js: wiring, camera + MediaPipe, main loop, status pill, settings UI.
'use strict';
window.XRAPP = (() => {
  const $ = (id) => document.getElementById(id);
  const video = $('video'), bonesCv = $('bones'), labelsCv = $('labels');
  const pill = $('pill'), overlay = $('overlay');
  const st = XU.get();

  let mode = null;            // null | 'demo' | 'camera'
  let poseLandmarker = null, handLandmarker = null;
  let lastFrame = null;       // last solved frame source (for freeze)
  let curPose = null;
  let t0 = performance.now();
  let noBodySince = 0, loading = true;
  let stream = null;
  let selId = null;

  // ---------- status pill ----------
  let pillMsg = '', pillTimer = 0;
  function setPill(msg, sticky){
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
    $('card').classList.add('open');
  }
  $('cardClose').addEventListener('click', () => {
    $('card').classList.remove('open'); selId = null; XL.setSelected(null);
  });

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
    video.style.display = (mode === 'camera' && (st.mirror || true)) ? '' : 'none';
    video.style.display = mode === 'camera' ? '' : 'none';
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

  async function startCamera(restart){
    overlay.classList.add('hide');
    mode = 'camera';
    XP.reset();
    applyVideoClass();
    try {
      if (stream) { stream.getTracks().forEach((tr) => tr.stop()); stream = null; }
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: st.rear ? 'environment' : 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      video.srcObject = stream;
      await video.play();
    } catch (err) {
      mode = null;
      overlay.classList.remove('hide');
      setPill('Camera unavailable: ' + (err && err.name ? err.name : 'permission denied') + '. Try Demo without camera.');
      return;
    }
    try { await loadModels(); } catch (e) {
      setPill('Could not load tracking models (offline?). Use Demo without camera.');
      mode = null;
      overlay.classList.remove('hide');
      return;
    }
    loading = false;
    setPill('', false);
  }

  function readCamera(){
    if (!poseLandmarker || video.readyState < 2) return null;
    const now = performance.now();
    const pose = poseLandmarker.detectForVideo(video, now);
    if (!pose.landmarks || !pose.landmarks.length) return null;
    const lm = pose.landmarks[0];
    const img = lm.map((p) => [p.x, p.y, p.visibility === undefined ? 1 : p.visibility]);
    const world = (pose.worldLandmarks && pose.worldLandmarks.length)
      ? pose.worldLandmarks[0].map((p) => [p.x, p.y, p.z]) : img.map(() => [0, 0, 0]);
    const hands = {};
    if (handLandmarker){
      const hres = handLandmarker.detectForVideo(video, now);
      for (const hl of (hres.landmarks || [])){
        const w0 = hl[0];
        // associate by x proximity to wrists (15 left, 16 right) in image coords
        const dL = Math.abs(w0.x - img[15][0]) + Math.abs(w0.y - img[15][1]);
        const dR = Math.abs(w0.x - img[16][0]) + Math.abs(w0.y - img[16][1]);
        const side = dL < dR ? 'L' : 'R';
        if (hands[side]) continue;
        hands[side] = {
          img: hl.map((p) => [p.x, p.y, p.visibility === undefined ? 1 : p.visibility]),
          world: hl.map((p) => [p.x, p.y, p.z]),
        };
      }
    }
    return { img, world, hands };
  }

  // ---------- main loop ----------
  function loop(){
    requestAnimationFrame(loop);
    try {
      const t = (performance.now() - t0) / 1000;
      if (mode === null) { if (!loading) setPill('', false); return; }
      let frame = null;
      if (st.freeze){ frame = lastFrame; }
      else if (mode === 'demo'){ frame = XP.demoFrame(t); }
      else if (mode === 'camera'){ frame = readCamera(); }
      if (frame) lastFrame = frame;

      const W = bonesCv.width, H = bonesCv.height;
      if (mode === 'camera' && !frame){
        if (!noBodySince) noBodySince = performance.now();
        else if (performance.now() - noBodySince > 800) setPill('No body found', false);
      } else {
        noBodySince = 0;
        // step-back hint: tracked body taller than 92% of frame
        if (frame){
          let y0 = 1, y1 = 0;
          for (const p of frame.img){ if (p[2] > 0.4){ y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); } }
          if (y1 - y0 > 0.92) setPill('Step back', false);
          else if (!loading) setPill('', false);
        }
      }
      if (frame){
        curPose = XP.solve(frame, W, H, st.mirror, selId);
        XR.draw(curPose, st, t);
        XL.draw(curPose, st, t);
      } else {
        XR.draw({ seg: {}, mainOK: false }, st, t);
      }
    } catch (e) {
      console.error(e);
    }
  }

  // ?demo=1 autostart
  begin();
  if (new URLSearchParams(location.search).get('demo') === '1'){
    startDemo();
  } else {
    loading = true;
  }

  return { select };
})();