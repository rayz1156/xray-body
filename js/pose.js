// pose.js: pose solver (landmarks -> per-segment pixel-space matrices) + demo generator.
'use strict';
const XP = (() => {
  const J = window.SKEL.joints;
  let prevPx = null;      // smoothed px-space joints 33
  let prevHand = { left: null, right: null };

  // ---------- tracked-pixel-space helpers ----------
  // frame.img: [x,y,vis] x33 normalised; frame.world: [x,y,z] x33 metres.
  // Jpx[i] = [imgX*W, imgY*H, worldZ*pPerM]  (NOT mirrored; mirror applied in matrices)
  function buildPx(frame, W, H){
    const sh = mid(frame.world, 11, 12), hp = mid(frame.world, 23, 24);
    const mTorso = XU.len(XU.sub(sh, hp)) || 0.45;
    const pxSh = midPx(frame.img, 11, 12, W, H);
    const pxHp = midPx(frame.img, 23, 24, W, H);
    const pPerM = (XU.len(XU.sub(pxSh, pxHp)) / mTorso) || (H * 0.9);
    const px = frame.img.map((p, i) => [p[0] * W, p[1] * H, frame.world[i][2] * pPerM]);
    return { px, pPerM };
  }
  const mid = (a, i, j) => [(a[i][0]+a[j][0])/2, (a[i][1]+a[j][1])/2, (a[i][2]+a[j][2])/2];
  const midPx = (a, i, j, W, H) => [ (a[i][0]+a[j][0])/2*W, (a[i][1]+a[j][1])/2*H,
    (( a[i][2]||0)+(a[j][2]||0))/2 ];

  // ---------- matrix compose ----------
  // px(p) = R*(p - pivR)*u + pivT ; then mirror x if needed.
  function segMat(Rm, u, pivR, pivT, mirror, W){
    const m = new Float32Array(16);
    const Rp = XU.apply3(Rm, [pivR[0]*u, pivR[1]*u, pivR[2]*u]);
    let tx = pivT[0] - Rp[0], ty = pivT[1] - Rp[1], tz = pivT[2] - Rp[2];
    if (mirror) tx = W - tx;
    for (let c = 0; c < 3; c++){
      m[c*4+0] = (mirror ? -Rm[c*3+0] : Rm[c*3+0]) * u;
      m[c*4+1] = Rm[c*3+1] * u;
      m[c*4+2] = Rm[c*3+2] * u;
      m[c*4+3] = 0;
    }
    m[12] = tx; m[13] = ty; m[14] = tz; m[15] = 1;
    return m;
  }
  const applyM = (m, p) => [
    m[0]*p[0]+m[4]*p[1]+m[8]*p[2]+m[12],
    m[1]*p[0]+m[5]*p[1]+m[9]*p[2]+m[13],
    m[2]*p[0]+m[6]*p[1]+m[10]*p[2]+m[14]];
  const norm3m = (m) => { const f = new Float32Array(9); for (let i=0;i<9;i++) f[i]=m[i]; return f; };

  // ---------- segment config ----------
  // helpers on tracked px joints P(i), plus derived points
  function cfgPoints(P){
    const shM = () => mid(P, 11, 12), hpM = () => mid(P, 23, 24);
    const earM = () => mid(P, 7, 8);
    const spine = (f) => { const s = shM(), h = hpM();
      return XU.add(h, XU.scale(XU.sub(s, h), f)); };
    return { shM, hpM, earM, spine };
  }
  const R = J; // rest joints
  const rMid = (a, b) => [(J[a][0]+J[b][0])/2, (J[a][1]+J[b][1])/2, (J[a][2]+J[b][2])/2];

  // each: pivR (rest point), axR [A,B] rest axis pts, hintR [A,B],
  //       pivT fn, axT fn pair, hintT fn pair, visIdx landmarks to gate on
  // note: axis/hint given as point pairs; frame built from (B-A).
  const SEGT = {}; // filled in setupSegTable()

  function setupSegTable(){
    const d = (a, b) => XU.sub(b, a);
    const mk = (pivR, pivT, axR, axT, hintR, hintT, vis, axRot) => ({
      pivR, pivT, axR, axT, hintR, hintT, vis: vis || [], axRot });
    const P = (i) => (Pj) => Pj[i]; // unused helper
    const S = {}; // helper object built per-frame in solve()
    // We define configs as functions taking helper object h (with P, shM...).
    const fns = {
      head: (h) => mk(rMid('ear_L','ear_R'), h.earM,
        [J.ear_L, J.ear_R], [h.P(7), h.P(8)],
        [rMid('ear_L','ear_R'), J.nose], [h.earM, h.P(0)],
        [7, 8, 0]),
      neck: (h) => mk(J.c7t1, h.shM,
        [J.c7t1, J.c1], [h.shM, h.earM],
        [J.shoulder_L, J.shoulder_R], [h.P(11), h.P(12)],
        [11, 12, 0]),
      thorax: (h) => mk(J.c7t1, h.shM,
        [J.c7t1, J.t12l1], [h.shM, h.spine(0.45)],
        [J.shoulder_L, J.shoulder_R], [h.P(11), h.P(12)],
        [11, 12, 23, 24]),
      lumbar: (h) => mk(J.t12l1, h.spine(0.45),
        [J.t12l1, J.l5s1], [h.spine(0.45), h.hpM],
        [J.shoulder_L, J.shoulder_R], [h.P(11), h.P(12)],
        [11, 12, 23, 24]),
      pelvis: (h) => mk(J.l5s1, h.hpM,
        [J.hip_L, J.hip_R], [h.P(23), h.P(24)],
        [J.l5s1, J.coccyx], [h.hpM, h.kneeM],
        [23, 24, 25, 26]),
      clav_L: (h) => mk(J.clavM_L, h.shM,
        [J.clavM_L, J.clavL_L], [h.shM, h.P(11)],
        [J.c7t1, J.c1], [h.shM, h.earM],
        [11]),
      clav_R: (h) => mk(J.clavM_R, h.shM,
        [J.clavM_R, J.clavL_R], [h.shM, h.P(12)],
        [J.c7t1, J.c1], [h.shM, h.earM],
        [12]),
      scap_L: (h) => mk(J.clavM_L, h.shM,
        [J.clavM_L, J.clavL_L], [h.shM, h.P(11)],
        [J.c7t1, J.c1], [h.shM, h.earM],
        [11]),
      scap_R: (h) => mk(J.clavM_R, h.shM,
        [J.clavM_R, J.clavL_R], [h.shM, h.P(12)],
        [J.c7t1, J.c1], [h.shM, h.earM],
        [12]),
    };
    // limb chains: [name, pivRest, axR pair, hintR pair, track idxs]
    const limb = (side, sIdx, eIdx, wIdx) => {
      const S2 = side === 'L' ? '_L' : '_R';
      const hI = (i) => i + (side === 'L' ? 0 : 1);
      fns['hum_' + side] = (h) => mk(J['shoulder' + S2], h.P(hI(11)),
        [J['shoulder'+S2], J['elbow'+S2]], [h.P(hI(11)), h.P(hI(13))],
        [J['shoulder'+S2], J['shoulder'+(side==='L'?'_R':'_L')]], [h.P(hI(11)), h.P(side==='L'?12:11)],
        [hI(11), hI(13)]);
      fns['fore_' + side] = (h) => mk(J['elbow'+S2], h.P(hI(13)),
        [J['elbow'+S2], J['wrist'+S2]], [h.P(hI(13)), h.P(hI(15))],
        [J['elbow'+S2], J['shoulder'+S2]], [h.P(hI(13)), h.P(hI(11))],
        [hI(13), hI(15)]);
      fns['palm_' + side] = (h) => mk(J['wrist'+S2], h.P(hI(15)),
        [J['wrist'+S2], J['mc2'+S2]], [h.P(hI(15)), h.P(hI(19))],
        [J['wrist'+S2], J['mc5'+S2]], [h.P(hI(15)), h.P(hI(17))],
        [hI(15)]);
      fns['fem_' + side] = (h) => mk(J['hip'+S2], h.P(hI(23)),
        [J['hip'+S2], J['knee'+S2]], [h.P(hI(23)), h.P(hI(25))],
        [J['hip'+S2], J['hip'+(side==='L'?'_R':'_L')]], [h.P(hI(23)), h.P(side==='L'?24:23)],
        [hI(23), hI(25)]);
      fns['shin_' + side] = (h) => mk(J['knee'+S2], h.P(hI(25)),
        [J['knee'+S2], J['ankle'+S2]], [h.P(hI(25)), h.P(hI(27))],
        [J['knee'+S2], J['hip'+S2]], [h.P(hI(25)), h.P(hI(23))],
        [hI(25), hI(27)]);
      fns['foot_' + side] = (h) => mk(J['ankle'+S2], h.P(hI(27)),
        [J['ankle'+S2], J['toe'+S2]], [h.P(hI(27)), h.P(hI(31))],
        [J['ankle'+S2], J['heel'+S2]], [h.P(hI(27)), h.P(hI(29))],
        [hI(27), hI(31)]);
    };
    limb('L'); limb('R');
    return fns;
  }
  const CFG = setupSegTable();

  // hand landmark map: finger -> [mcp, pip, dip, tip] indices
  const HAND = { thumb: [1, 2, 3, 4], index: [5, 6, 7, 8], middle: [9, 10, 11, 12],
                 ring: [13, 14, 15, 16], little: [17, 18, 19, 20] };
  // finger phalanx segments per finger: prox, midd, dist rest joint pairs
  const PHAL = {
    thumb: { prox: ['mc1_L_a', 'mc1_L_b'], dist: ['f_L_thumb_dist_a', 'f_L_thumb_dist_b'] },
    index: { prox: ['f_L_index_prox_a', 'f_L_index_prox_b'],
             midd: ['f_L_index_midd_a', 'f_L_index_midd_b'],
             dist: ['f_L_index_dist_a', 'f_L_index_dist_b'] },
    middle: { prox: ['f_L_middle_prox_a', 'f_L_middle_prox_b'],
              midd: ['f_L_middle_midd_a', 'f_L_middle_midd_b'],
              dist: ['f_L_middle_dist_a', 'f_L_middle_dist_b'] },
    ring: { prox: ['f_L_ring_prox_a', 'f_L_ring_prox_b'],
            midd: ['f_L_ring_midd_a', 'f_L_ring_midd_b'],
            dist: ['f_L_ring_dist_a', 'f_L_ring_dist_b'] },
    little: { prox: ['f_L_little_prox_a', 'f_L_little_prox_b'],
              midd: ['f_L_little_midd_a', 'f_L_little_midd_b'],
              dist: ['f_L_little_dist_a', 'f_L_little_dist_b'] },
  };

  // ---------- main solve ----------
  function solve(frame, W, H, mirror, selBoneName){
    if (!frame) return null;
    const { px, pPerM } = buildPx(frame, W, H);
    // smoothing
    if (prevPx){
      for (let i = 0; i < px.length; i++){
        const v = frame.img[i][2] !== undefined ? frame.img[i][2] : 1;
        if (v > 0.25) px[i] = px[i].map((c, k) => XU.lerp(prevPx[i][k], c, 0.4));
      }
    }
    prevPx = px.map((p) => p.slice());

    const P = (i) => px[i];
    const h = { P,
      shM: () => mid(px, 11, 12), hpM: () => mid(px, 23, 24),
      earM: () => mid(px, 7, 8),
      kneeM: () => mid(px, 25, 26),
      spine: (f) => { const s = mid(px, 11, 12), g = mid(px, 23, 24);
        return XU.add(g, XU.scale(XU.sub(s, g), f)); } };

    // torso scale: px per model unit
    const restTorso = XU.len(XU.sub(J.c7t1, J.l5s1));
    const pxTorso = XU.len(XU.sub(h.shM(), h.hpM()));
    const u = pxTorso / restTorso;

    const seg = {}; const vis = (idxs) => {
      let m = 1;
      for (const i of idxs) m = Math.min(m, frame.img[i][2] === undefined ? 1 : frame.img[i][2]);
      return m >= 0.35;
    };
    const core = vis([11, 12, 23, 24]);

    for (const name in CFG){
      const c = CFG[name](h);
      const val = (x) => (typeof x === 'function' ? x() : x);
      const show = core && vis(c.vis);
      const Rm = XU.frameMat(
        XU.frame(XU.sub(c.axR[1], c.axR[0]), XU.sub(c.hintR[1], c.hintR[0])),
        XU.frame(XU.sub(val(c.axT[1]), val(c.axT[0])), XU.sub(val(c.hintT[1]), val(c.hintT[0]))));
      seg[name] = { m: segMat(Rm, u, c.pivR, val(c.pivT), mirror, W),
                    n: norm3m(Rm), visible: show, R: Rm, pivR: c.pivR, u };
    }

    // ----- hands -----
    const hands = frame.hands || {};
    for (const side of ['L', 'R']){
      const wIdx = side === 'L' ? 15 : 16;
      const hd = hands[side];
      const palmName = 'palm_' + side;
      if (hd){
        // hand px-space joints
        const hp = hd.img.map((p, i) => [p[0]*W, p[1]*H, hd.world[i][2]*pPerM]);
        if (prevHand[side]) for (let i = 0; i < 21; i++)
          hp[i] = hp[i].map((c, k) => XU.lerp(prevHand[side][i][k], c, 0.45));
        prevHand[side] = hp.map((p) => p.slice());
        const HP = (i) => hp[i];
        // palm: pivot wrist, axis wrist->index mcp, hint wrist->pinky mcp
        const Rm = XU.frameMat(
          XU.frame(XU.sub(J['wrist_'+side], J['mc2_'+side]), XU.sub(J['wrist_'+side], J['mc5_'+side])),
          XU.frame(XU.sub(HP(5), HP(0)), XU.sub(HP(17), HP(0))));
        seg[palmName] = { m: segMat(Rm, u, J['wrist_'+side], HP(0), mirror, W),
                          n: norm3m(Rm), visible: true, R: Rm, pivR: J['wrist_'+side], u };
        // phalanges
        for (const fing in HAND){
          const [mcp, pip, dip, tip] = HAND[fing];
          const defs = PHAL[fing];
          const stages = [['prox', mcp, pip], ['midd', pip, dip], ['dist', dip, tip]];
          for (const [stg, a, b] of stages){
            if (!defs[stg]) continue;
            const name2 = `f_${side}_${fing}_${stg}`;
            const rA = J[defs[stg][0]], rB = J[defs[stg][1]];
            const Rf = XU.frameMat(
              XU.frame(XU.sub(rB, rA), XU.sub(h.shM(), rA)),
              XU.frame(XU.sub(HP(b), HP(a)), XU.sub(mid(px, 11, 12), HP(a))));
            seg[name2] = { m: segMat(Rf, u, rA, HP(a), mirror, W),
                           n: norm3m(Rf), visible: true };
          }
        }
      } else {
        prevHand[side] = null;
        // no hand data: every finger segment (incl. thumb metacarpal) reuses
        // the palm matrix unchanged, so fingers stay attached in rest pose.
        const pm = seg[palmName];
        if (pm && pm.visible){
          const extras = { mc1: J['mc1_' + side + '_a'] };
          for (const fing in PHAL){
            const defs = PHAL[fing];
            for (const stg in defs){
              extras[`${fing}_${stg}`] = J[defs[stg][0]];
            }
          }
          for (const key in extras){
            const name2 = key === 'mc1' ? 'mc1_' + side : `f_${side}_${key}`;
            if (!window.SKEL.segs[name2]) continue;
            seg[name2] = { m: pm.m, n: norm3m(pm.R), visible: true, pivR: extras[key] };
          }
        }
      }
    }

    // ----- main slot mats for SOFT skinning -----
    const mainNames = window.SOFT ? window.SOFT.main : [];
    let mainMats = null, mainOK = false;
    if (window.SOFT && mainNames.length === 17){
      mainMats = new Float32Array(17 * 16); mainOK = true;
      for (let i = 0; i < 17; i++){
        const s = seg[mainNames[i]];
        if (s) mainMats.set(s.m, i * 16);
      }
    }

    return { seg, mainMats, mainOK, selBoneName, u, W, H };
  }

  function applySeg(pose, name, p){
    const s = pose.seg[name];
    if (!s) return null;
    return applyM(s.m, p);
  }
  function applyMain(pose, slotIdx, p){
    if (!pose.mainMats) return null;
    return applyM(Array.from(pose.mainMats.subarray(slotIdx*16, slotIdx*16+16)), p);
  }
  function reset(){ prevPx = null; prevHand = { left: null, right: null }; }

  // ---------- demo pose generator ----------
  // Works in model units treated as metres (model is ~1.7 units tall), then
  // maps to normalised image coords so it feeds the same solver.
  function demoFrame(t){
    const world = []; const img = [];
    const Y0 = -1.60, HH = 1.72; // imgY = (y - Y0)/HH
    const P3 = (x, y, z) => [x, y, z];
    const sway = 0.018 * Math.sin(t * 0.6);
    const bob = 0.008 * Math.sin(t * 2.1);
    const breathe = 0.012 * (0.5 + 0.5 * Math.sin(t * 2.1));
    const push = (x, y, z, idx) => { world[idx] = P3(x + sway, y + bob, z); };
    // head / ears / nose
    push(0.071, -1.509, -0.087 - breathe, 7);
    push(-0.073, -1.509, -0.087 - breathe, 8);
    push(0.0, -1.477, -0.214 - breathe * 2, 0);
    // shoulders / chest
    const shL = [0.166, -1.317, -0.08 - breathe], shR = [-0.165, -1.315, -0.08 - breathe];
    push(shL[0], shL[1], shL[2], 11); push(shR[0], shR[1], shR[2], 12);
    // hips
    push(0.081, -0.811, -0.078, 23); push(-0.083, -0.811, -0.078, 24);
    // left arm relaxed with slight swing
    const sw = 0.06 * Math.sin(t * 1.9);
    const elL = [shL[0] + 0.035, shL[1] + 0.28, -0.06];
    const wrL = [elL[0] + sw, elL[1] + 0.24, -0.03];
    push(elL[0], elL[1], elL[2], 13); push(wrL[0], wrL[1], wrL[2], 15);
    push(wrL[0] + 0.02 + sw, wrL[1] + 0.05, wrL[2], 19); // index
    push(wrL[0] - 0.02, wrL[1] + 0.05, wrL[2], 17); // pinky
    push(wrL[0], wrL[1] + 0.06, wrL[2] - 0.02, 21); // thumb
    // right arm waves
    const elR = [shR[0] - 0.20, shR[1] + 0.14, -0.05];
    const a = 0.7 + 0.5 * Math.sin(t * 2.6);
    const wrR = [elR[0] - 0.10, elR[1] - 0.26 * Math.cos(a) + 0.06, -0.04];
    push(elR[0], elR[1], elR[2], 14); push(wrR[0], wrR[1], wrR[2], 16);
    push(wrR[0] - 0.02, wrR[1] + 0.05, wrR[2], 20);
    push(wrR[0] + 0.02, wrR[1] + 0.05, wrR[2], 18);
    push(wrR[0], wrR[1] + 0.06, wrR[2] - 0.02, 22);
    // legs with tiny knee flex
    const kf = 0.02 * Math.sin(t * 1.9);
    const knL = [0.075, -0.38 - kf, -0.076], anL = [0.071, 0.017 - kf * 0.5, -0.079];
    push(knL[0], knL[1], knL[2], 25); push(anL[0], anL[1], anL[2], 27);
    push(anL[0], anL[1] + 0.03, -0.035, 29); push(anL[0] + 0.045, anL[1] + 0.05, -0.22, 31);
    const knR = [-0.075, -0.38 - kf, -0.076], anR = [-0.071, 0.017 - kf * 0.5, -0.079];
    push(knR[0], knR[1], knR[2], 26); push(anR[0], anR[1], anR[2], 28);
    push(anR[0], anR[1] + 0.03, -0.035, 30); push(anR[0] - 0.045, anR[1] + 0.05, -0.22, 32);
    // fill any gaps with rest-ish copies
    for (let i = 0; i < 33; i++) if (!world[i]) world[i] = [sway, Y0 + 0.4, -0.05];
    for (let i = 0; i < 33; i++){
      const w2 = world[i];
      img[i] = [0.5 + w2[0] * 0.27, (w2[1] - Y0) / HH, 1.0];
    }
    return { img, world, hands: {} };
  }

  return { solve, applySeg, applyMain, reset, demoFrame };
})();