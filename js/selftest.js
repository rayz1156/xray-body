// selftest.js: numeric self-test, active at index.html?selftest=1.
// Solves XP.demoFrame at several times t and checks, in pixel space:
//   1. every limb segment maps its rest distal joint onto the tracked
//      distal landmark within 10% of that bone's pixel length;
//   2. every finger segment origin sits within 15% of the palm length
//      of its palm (i.e. fingers stay attached);
//   3. the heart centre lands inside the transformed thorax bounds
//      (circulation tab vessels/heart follow the body).
// Prints a table to the console and a final SELFTEST PASS / SELFTEST FAIL.
'use strict';
(() => {
  if (new URLSearchParams(location.search).get('selftest') !== '1') return;
  const pad = (s, n) => String(s).padEnd(n, ' ');

  function thoraxRestBounds(){
    const d = XU.decode(window.SKEL.data);
    const s16 = new Int16Array(d.buffer, 0, d.byteLength / 2);
    const [vs, vc] = window.SKEL.segs.thorax;
    const qs = window.SKEL.qs, qc = window.SKEL.qc;
    let mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
    for (let i = vs; i < vs + vc; i++){
      for (let c = 0; c < 3; c++){
        const v = s16[i * 6 + c] / 32767 * qs + qc[c];
        mn[c] = Math.min(mn[c], v); mx[c] = Math.max(mx[c], v);
      }
    }
    return { mn, mx };
  }

  function run(){
    const [W, H] = XR.resize();
    const J = window.SKEL.joints;
    const times = [0, 0.5, 1.0, 1.7, 2.4, 3.1];
    // [seg, rest proximal, rest distal, tracked distal landmark]
    const LIMBS = [
      ['hum_L', 'shoulder_L', 'elbow_L', 13], ['fore_L', 'elbow_L', 'wrist_L', 15],
      ['palm_L', 'wrist_L', 'mc2_L', 19],
      ['fem_L', 'hip_L', 'knee_L', 25], ['shin_L', 'knee_L', 'ankle_L', 27],
      ['hum_R', 'shoulder_R', 'elbow_R', 14], ['fore_R', 'elbow_R', 'wrist_R', 16],
      ['palm_R', 'wrist_R', 'mc2_R', 20],
      ['fem_R', 'hip_R', 'knee_R', 26], ['shin_R', 'knee_R', 'ankle_R', 28],
    ];
    const FINGERS = [];
    for (const side of ['L', 'R']){
      for (const nm in window.SKEL.segs){
        if (nm === 'mc1_' + side) FINGERS.push(nm);
        else if (nm.startsWith('f_' + side + '_')) FINGERS.push(nm);
      }
    }
    const rows = [];   // {name, worst t, value, limit, ok}
    const worst = (name, limit, fn) => {
      let bt = 0, bv = -1;
      for (const t of times){
        const v = fn(t);
        if (v > bv){ bv = v; bt = t; }
      }
      rows.push({ name, t: bt, value: bv, limit, ok: bv < limit });
    };

    const solveAt = (t) => {
      XP.reset();
      const frame = XP.demoFrame(t, W, H);
      const pose = XP.solve(frame, W, H, false, null);
      return { frame, pose };
    };

    for (const [seg, rProx, rDist, lm] of LIMBS){
      worst(seg, 10, (t) => {          // percent of bone pixel length
        const { frame, pose } = solveAt(t);
        const mapped = XP.applySeg(pose, seg, J[rDist]);
        const tr = [frame.img[lm][0] * W, frame.img[lm][1] * H,
                    frame.world[lm][2] * pose.pPerM];
        const dist = Math.hypot(mapped[0] - tr[0], mapped[1] - tr[1], mapped[2] - tr[2]);
        const bonePx = pose.u * XU.len(XU.sub(J[rDist], J[rProx]));
        return dist / bonePx * 100;
      });
    }
    for (const name of FINGERS){
      worst(name, 15, (t) => {          // percent of palm pixel length
        const { pose } = solveAt(t);
        const side = name.startsWith('mc1_') ? name.slice(-1) : name.charAt(2);
        const palm = 'palm_' + side;
        const fs = pose.seg[name], ps = pose.seg[palm];
        if (!fs || !fs.pivR || !ps) return 1e9;
        const a = XP.applySeg(pose, name, fs.pivR);
        const b = XP.applySeg(pose, palm, fs.pivR);
        const palmLen = pose.u * XU.len(XU.sub(J['mc2_' + palm.slice(-1)], J['wrist_' + palm.slice(-1)]));
        return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) / palmLen * 100;
      });
    }
    if (window.SOFT && window.SOFT.heart){
      worst('heart@thorax', 100, (t) => {   // % of thorax margin => 0 = inside
        const { pose } = solveAt(t);
        const th = pose.seg.thorax;
        if (!th) return 1e9;
        const b = thoraxRestBounds();
        const hc = XP.applySeg(pose, 'thorax', window.SOFT.heart);
        let mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
        for (let ix = 0; ix < 2; ix++) for (let iy = 0; iy < 2; iy++) for (let iz = 0; iz < 2; iz++){
          const c = XP.applySeg(pose, 'thorax',
            [ix ? b.mx[0] : b.mn[0], iy ? b.mx[1] : b.mn[1], iz ? b.mx[2] : b.mn[2]]);
          for (let k = 0; k < 3; k++){ mn[k] = Math.min(mn[k], c[k]); mx[k] = Math.max(mx[k], c[k]); }
        }
        let outside = 0;   // px outside the transformed thorax box
        for (let k = 0; k < 3; k++) outside += Math.max(mn[k] - hc[k], 0, hc[k] - mx[k]);
        return outside > 0 ? 100 : 0;
      });
    } else {
      rows.push({ name: 'heart@thorax', t: '-', value: NaN, limit: 0, ok: false });
    }

    console.log('SELFTEST canvas ' + W + 'x' + H +
      ' | segment rest->tracked distal, % of bone px length (limit 10%),' +
      ' fingers % of palm length (limit 15%), heart in thorax');
    console.log(pad('segment', 22) + pad('worst t', 8) + pad('value%', 9) + 'limit%');
    for (const r of rows){
      console.log(pad(r.name, 22) + pad(r.t.toFixed(1), 8) +
        pad(r.value.toFixed(2), 9) + r.limit);
    }
    const bad = rows.filter((r) => !r.ok);
    console.log(bad.length === 0 ? 'SELFTEST PASS' :
      'SELFTEST FAIL (' + bad.length + ' checks): ' + bad.map((r) => r.name).join(', '));
  }

  // wait for layout + (lazy) SOFT data before running
  let tries = 0;
  const wait = setInterval(() => {
    tries++;
    const cv = document.getElementById('bones');
    if (window.SOFT && typeof XR !== 'undefined' && cv && cv.width > 0 && cv.height > 0){
      clearInterval(wait); run();
    } else if (tries > 100){
      clearInterval(wait);
      console.log('SELFTEST FAIL (SOFT data or canvas not ready)');
    }
  }, 100);
})();