// util.js: settings store, base64 decode, small vector helpers.
'use strict';
const XU = (() => {

  // ---------- settings (localStorage, wrapped in try/catch) ----------
  const KEY = 'xray-mirror-settings-v1';
  const defaults = {
    rear: false, mirror: true, freeze: false,
    look: 'xray', bright: 100, fingers: true,
    names: 1, textSize: 100,
    layerSkel: true, layerOrg: false, layerCirc: false,
  };
  let s = Object.assign({}, defaults);
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) s = Object.assign(s, JSON.parse(raw));
  } catch (e) { /* storage unavailable: keep defaults */ }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {} };
  const get = () => s;
  const set = (patch) => { Object.assign(s, patch); save(); };

  // ---------- base64 -> typed buffers ----------
  const decode = (b64) => {
    const bin = atob(b64);
    const n = bin.length, u8 = new Uint8Array(n);
    for (let i = 0; i < n; i++) u8[i] = bin.charCodeAt(i);
    return u8;
  };

  // ---------- tiny vec3 / mat3 ----------
  const sub = (a, b) => [a[0]-b[0], a[1]-b[1], a[2]-b[2]];
  const add = (a, b) => [a[0]+b[0], a[1]+b[1], a[2]+b[2]];
  const scale = (a, k) => [a[0]*k, a[1]*k, a[2]*k];
  const dot = (a, b) => a[0]*b[0] + a[1]*b[1] + a[2]*b[2];
  const cross = (a, b) => [
    a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
  const len = (a) => Math.hypot(a[0], a[1], a[2]);
  const norm = (a) => { const l = len(a) || 1; return [a[0]/l, a[1]/l, a[2]/l]; };
  // orthonormal frame from primary axis a and twist hint h (Gram-Schmidt)
  const frame = (a, h) => {
    const ax = norm(a);
    let u = sub(h, scale(ax, dot(h, ax)));
    if (len(u) < 1e-4) { // hint parallel: pick any perpendicular
      const t = Math.abs(ax[0]) < .9 ? [1,0,0] : [0,1,0];
      u = sub(t, scale(ax, dot(t, ax)));
    }
    u = norm(u);
    return [ax, u, cross(ax, u)];
  };
  // mat3 as 9-array (row-major); R = F_track * F_rest^T maps rest->track
  const frameMat = (Fr, Ft) => { // both [ax,u,w]
    // M = Ft * Fr^T (columns of Fr are the axes)
    const m = new Float32Array(9);
    for (let c = 0; c < 3; c++)
      for (let r = 0; r < 3; r++)
        m[c*3+r] = Ft[0][r]*Fr[0][c] + Ft[1][r]*Fr[1][c] + Ft[2][r]*Fr[2][c];
    return m;
  };
  const id3 = () => new Float32Array([1,0,0, 0,1,0, 0,0,1]);
  const apply3 = (m, p) => [
    m[0]*p[0]+m[3]*p[1]+m[6]*p[2],
    m[1]*p[0]+m[4]*p[1]+m[7]*p[2],
    m[2]*p[0]+m[5]*p[1]+m[8]*p[2]];

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;

  return { KEY, defaults, get, set, save, decode, sub, add, scale, dot, cross,
           len, norm, frame, frameMat, id3, apply3, clamp, lerp };
})();