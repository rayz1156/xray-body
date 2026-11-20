// renderer.js: raw WebGL2 renderer for SKEL (bones) and SOFT (organs/vessels).
'use strict';
const XR = (() => {
  let gl = null, canvas = null;
  let progBones = null, progSoft = null;
  let selId = -1, selSoft = null;
  let softReady = false;
  const boneVBO = {}, softVBO = {};
  let boneIBO32 = null, softIBO32 = null;

  // ---- shader helpers ----
  const compile = (type, src) => {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src); gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS))
      throw new Error('shader: ' + gl.getShaderInfoLog(sh));
    return sh;
  };
  const link = (vs, fs) => {
    const p = gl.createProgram();
    gl.attachShader(p, compile(gl.VERTEX_SHADER, vs));
    gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS))
      throw new Error('link: ' + gl.getProgramInfoLog(p));
    return p;
  };
  const U = (p, n) => gl.getUniformLocation(p, n);

  // ---- shaders ----
  const VS_HEAD = `
    precision highp float;
    uniform mat4 uM;          // model(quantised) -> pixel space
    uniform mat3 uN;          // rotation for normals
    uniform vec2 uView;       // canvas px size
    uniform float uZScale;
    vec3 toPx(vec4 q){         // pixel-space -> clip
      float z = clamp(0.5 - q.z * uZScale, -0.95, 0.95);
      return vec3(q.x / uView.x * 2.0 - 1.0, 1.0 - q.y / uView.y * 2.0, z);
    }`;

  const VS_BONES = VS_HEAD + `
    attribute vec3 aPos; attribute vec3 aNrm; attribute vec2 aBone;
    uniform vec3 uQs, uQc;
    varying vec3 vN; varying float vSel; varying float vY;
    uniform float uSel;
    void main(){
      vec3 p = vec3(aPos) * uQs / 32767.0 + uQc;
      vec4 q = uM * vec4(p, 1.0);
      gl_Position = vec4(toPx(q), 1.0);
      vY = 0.5 - gl_Position.y * 0.5;       // 0 top of screen, 1 bottom
      vN = normalize(uN * aNrm);
      vSel = (uSel >= 0.0 && abs(float(aBone.x) - uSel) < 0.5) ? 1.0 : 0.0;
    }`;

  // Look: pearl bone core with a mint edge glow that turns violet lower down,
  // plus a slow light band sweeping down the body.
  const FS_BONES = `
    precision mediump float;
    varying vec3 vN; varying float vSel; varying float vY;
    uniform float uMode;     // 0 glow, 1 solid
    uniform float uBright, uTime;
    const vec3 PEARL = vec3(1.0, 0.94, 0.84);
    const vec3 MINT = vec3(0.36, 1.0, 0.78);
    const vec3 VIOLET = vec3(0.66, 0.52, 1.0);
    const vec3 CLAY = vec3(0.90, 0.84, 0.78);
    const vec3 HOT = vec3(1.0, 0.45, 0.55);
    void main(){
      vec3 n = normalize(vN);
      float nz = abs(n.z);
      vec3 edge = mix(MINT, VIOLET, smoothstep(0.15, 0.95, vY));
      float sweep = smoothstep(0.07, 0.0, abs(fract(vY - uTime * 0.11) - 0.5));
      vec3 col;
      if (uMode < 0.5){
        float fres = pow(1.0 - nz, 1.5);
        col = (PEARL * 0.13 + edge * 0.85 * fres + PEARL * 0.22 * fres * fres) * uBright;
        col += edge * sweep * 0.22 * (0.3 + fres);
      } else {
        vec3 L = normalize(vec3(-0.40, -0.50, 0.77));
        float d = max(dot(n, L), 0.0);
        float band = floor(d * 4.0 + 0.5) / 4.0;          // soft stepped shading
        float rim = pow(1.0 - nz, 2.2);
        col = CLAY * (0.30 + 0.70 * mix(d, band, 0.55)) + edge * rim * 0.45;
      }
      float hs = uMode < 0.5 ? (0.25 + 0.75 * (1.0 - nz)) : (0.4 + 0.6 * nz);
      col = mix(col, HOT * hs, vSel * 0.85);
      gl_FragColor = vec4(col, 1.0);
    }`;

  const VS_SOFT = VS_HEAD + `
    attribute vec3 aPos; attribute vec3 aNrm; attribute vec4 aMeta;
    uniform vec3 uQs, uQc;
    uniform mat4 uMain[17];
    varying vec3 vN; varying float vPal; varying vec3 vWpos;
    void main(){
      vec3 p = vec3(aPos) * uQs / 32767.0 + uQc;
      int ia = int(aMeta.y), ib = int(aMeta.z);
      float w = aMeta.w / 255.0;
      vec4 qa = uMain[ia] * vec4(p, 1.0);
      vec4 qb = uMain[ib] * vec4(p, 1.0);
      vec4 q = mix(qa, qb, w);
      // normal: approximate with slot A rotation
      vec3 na = normalize((uMain[ia] * vec4(aNrm, 0.0)).xyz);
      vN = na;
      vPal = aMeta.x;
      vWpos = p;
      gl_Position = vec4(toPx(q), 1.0);
    }`;

  const FS_SOFT = `
    precision mediump float;
    varying vec3 vN; varying float vPal; varying vec3 vWpos;
    uniform vec4 uPal[41];
    uniform float uMode, uBright, uTime;
    uniform vec3 uHeart;
    void main(){
      vec4 pc = vec4(0.0);
      for (int k = 0; k < 41; k++){           // ES1.00: fragment array index must be constant
        if (k == int(vPal + 0.5)) pc = uPal[k];
      }
      float kind = pc.w;
      vec3 n = normalize(vN);
      float nz = abs(n.z);
      vec3 col;
      if (uMode < 0.5){
        float fres = 0.18 + 0.9 * pow(1.0 - nz, 1.15);
        float d = distance(vWpos, uHeart);
        float pulse = 1.0;
        if (kind > 0.5 && kind < 1.5)       // artery
          pulse = 1.0 + 0.45 * sin(uTime * 6.0 - d * 22.0);
        else if (kind > 1.5 && kind < 2.5)  // vein
          pulse = 1.0 + 0.18 * sin(uTime * 3.0 - d * 10.0);
        else if (kind > 2.5)                 // heart
          pulse = 1.0 + 0.25 * pow(max(0.0, sin(uTime * 5.2)), 3.0)
                       + 0.18 * pow(max(0.0, sin(uTime * 5.2 + 0.4)), 3.0);
        col = pc.rgb * fres * pulse * uBright;
      } else {
        vec3 L = normalize(vec3(0.35, -0.45, 0.82));
        float dd = max(dot(n, L), 0.0);
        col = pc.rgb * (0.28 + 0.72 * dd);
      }
      gl_FragColor = vec4(col, 1.0);
    }`;

  // ---- buffer building ----
  function buildBones(){
    const d = XU.decode(window.SKEL.data);
    const vBytes = window.SKEL.vBytes;
    const nVerts = vBytes / 12;
    const idxLocal = new Uint16Array(d.buffer, vBytes, (d.length - vBytes) / 2);
    // indices are LOCAL to each segment range -> make absolute Uint32
    const idx32 = new Uint32Array(idxLocal.length);
    const segs = window.SKEL.segs;
    for (const name in segs){
      const [vs, vc, is, ic] = segs[name];
      for (let j = 0; j < ic; j++) idx32[is + j] = vs + idxLocal[is + j];
    }
    boneVBO.v = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, boneVBO.v);
    gl.bufferData(gl.ARRAY_BUFFER, d.subarray(0, vBytes), gl.STATIC_DRAW);
    boneIBO32 = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, boneIBO32);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx32, gl.STATIC_DRAW);
    boneVBO.nVerts = nVerts;
  }

  function buildSoft(){
    const d = XU.decode(window.SOFT.data);
    const vBytes = window.SOFT.vBytes;
    const idxLocal = new Uint16Array(d.buffer, vBytes, (d.length - vBytes) / 2);
    const idx32 = new Uint32Array(idxLocal.length);
    for (const ch of window.SOFT.chunks){
      const [g, vs, vc, is, ic] = ch;
      for (let j = 0; j < ic; j++) idx32[is + j] = vs + idxLocal[is + j];
    }
    softVBO.v = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, softVBO.v);
    gl.bufferData(gl.ARRAY_BUFFER, d.subarray(0, vBytes), gl.STATIC_DRAW);
    softIBO32 = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, softIBO32);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx32, gl.STATIC_DRAW);
    // palette flatten
    softVBO.palFlat = new Float32Array(41 * 4);
    for (let i = 0; i < window.SOFT.pal.length && i < 41; i++){
      const p = window.SOFT.pal[i];
      softVBO.palFlat.set([p[0], p[1], p[2], p[3]], i * 4);
    }
    softReady = true;
  }

  function attribsBones(p){
    const stride = 12;
    gl.bindBuffer(gl.ARRAY_BUFFER, boneVBO.v);
    const aP = gl.getAttribLocation(p, 'aPos');
    const aN = gl.getAttribLocation(p, 'aNrm');
    const aB = gl.getAttribLocation(p, 'aBone');
    gl.enableVertexAttribArray(aP);
    gl.vertexAttribPointer(aP, 3, gl.SHORT, false, stride, 0);
    gl.enableVertexAttribArray(aN);
    gl.vertexAttribPointer(aN, 3, gl.BYTE, true, stride, 6);
    gl.enableVertexAttribArray(aB);
    gl.vertexAttribPointer(aB, 2, gl.UNSIGNED_BYTE, false, stride, 9);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, boneIBO32);
  }

  function attribsSoft(p){
    const stride = 16;
    gl.bindBuffer(gl.ARRAY_BUFFER, softVBO.v);
    const aP = gl.getAttribLocation(p, 'aPos');
    const aN = gl.getAttribLocation(p, 'aNrm');
    const aM = gl.getAttribLocation(p, 'aMeta');
    gl.enableVertexAttribArray(aP);
    gl.vertexAttribPointer(aP, 3, gl.SHORT, false, stride, 0);
    gl.enableVertexAttribArray(aN);
    gl.vertexAttribPointer(aN, 3, gl.BYTE, true, stride, 6);
    gl.enableVertexAttribArray(aM);
    gl.vertexAttribPointer(aM, 4, gl.UNSIGNED_BYTE, false, stride, 9);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, softIBO32);
  }

  // ---- public API ----
  function init(cv){
    canvas = cv;
    gl = cv.getContext('webgl2', { antialias: true, alpha: true, premultipliedAlpha: false });
    if (!gl) throw new Error('WebGL2 not supported');
    progBones = link(VS_BONES, FS_BONES);
    progSoft = link(VS_SOFT, FS_SOFT);
    buildBones();
  }

  function loadSoft(){
    if (!softReady) buildSoft();
  }

  function resize(){
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.round(canvas.clientWidth * dpr), h = Math.round(canvas.clientHeight * dpr);
    if (canvas.width !== w || canvas.height !== h){ canvas.width = w; canvas.height = h; }
    gl.viewport(0, 0, w, h);
    return [w, h];
  }

  // pose: XP.Solve output; st: settings; t seconds
  function draw(pose, st, t){
    const [w, h] = resize();
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.disable(gl.CULL_FACE);
    const xray = st.look === 'xray';
    const bright = st.bright / 100;

    if (st.layerOrg || st.layerCirc){ drawSoft(pose, st, t, w, h, xray, bright); }
    if (st.layerSkel){ drawBones(pose, st, t, w, h, xray, bright); }
  }

  function drawBones(pose, st, t, w, h, xray, bright){
    gl.useProgram(progBones);
    gl.uniform2f(U(progBones, 'uView'), w, h);
    gl.uniform1f(U(progBones, 'uZScale'), 2.4 / Math.max(w, h));
    gl.uniform3fv(U(progBones, 'uQs'), new Float32Array([window.SKEL.qs, window.SKEL.qs, window.SKEL.qs]));
    gl.uniform3fv(U(progBones, 'uQc'), window.SKEL.qc);
    gl.uniform1f(U(progBones, 'uMode'), xray ? 0 : 1);
    gl.uniform1f(U(progBones, 'uBright'), bright);
    gl.uniform1f(U(progBones, 'uTime'), t);
    const selName = pose.selBoneName;   // e.g. 'femur' or null
    const selIdx = selName ? window.SKEL.ids.indexOf(selName) : -1;
    gl.uniform1f(U(progBones, 'uSel'), selIdx);
    attribsBones(progBones);
    if (xray){ gl.disable(gl.DEPTH_TEST); gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE); }
    else { gl.enable(gl.DEPTH_TEST); gl.disable(gl.BLEND); }
    const segs = window.SKEL.segs;
    for (const name in segs){
      if (pose.seg[name] === undefined || !pose.seg[name].visible) continue;
      if (/^f_[LR]_/.test(name) && !st.fingers) continue;
      gl.uniformMatrix4fv(U(progBones, 'uM'), false, pose.seg[name].m);
      gl.uniformMatrix3fv(U(progBones, 'uN'), false, pose.seg[name].n);
      const [vs, vc, is, ic] = segs[name];
      gl.drawElements(gl.TRIANGLES, ic, gl.UNSIGNED_INT, is * 4);
    }
    gl.disable(gl.BLEND);
  }

  function drawSoft(pose, st, t, w, h, xray, bright){
    if (!softReady || !pose.mainOK) return;
    gl.useProgram(progSoft);
    gl.uniform2f(U(progSoft, 'uView'), w, h);
    gl.uniform1f(U(progSoft, 'uZScale'), 2.4 / Math.max(w, h));
    gl.uniform3fv(U(progSoft, 'uQs'), new Float32Array([window.SOFT.qs, window.SOFT.qs, window.SOFT.qs]));
    gl.uniform3fv(U(progSoft, 'uQc'), window.SOFT.qc);
    gl.uniform1f(U(progSoft, 'uMode'), xray ? 0 : 1);
    gl.uniform1f(U(progSoft, 'uBright'), bright);
    gl.uniform1f(U(progSoft, 'uTime'), t);
    gl.uniform3fv(U(progSoft, 'uHeart'), window.SOFT.heart);
    gl.uniform4fv(U(progSoft, 'uPal[0]'), softVBO.palFlat);
    gl.uniformMatrix4fv(U(progSoft, 'uMain[0]'), false, pose.mainMats);
    attribsSoft(progSoft);
    if (xray){ gl.disable(gl.DEPTH_TEST); gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE); }
    else { gl.enable(gl.DEPTH_TEST); gl.disable(gl.BLEND); }
    const groups = [];
    if (st.layerOrg) groups.push('organs');
    if (st.layerCirc) groups.push('vessels');
    groups.push('heart');
    for (const ch of window.SOFT.chunks){
      if (groups.indexOf(ch[0]) < 0) continue;
      gl.drawElements(gl.TRIANGLES, ch[4], gl.UNSIGNED_INT, ch[3] * 4);
    }
    gl.disable(gl.BLEND);
  }

  return { init, loadSoft, draw, resize,
           isSoftReady: () => softReady };
})();