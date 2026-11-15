# XR-001 progress notes (work from this file, spec already read)

## Key facts pulled from SPEC.md / docs/data-index.md (do not re-read spec)

- Single offline page. `index.html` + `js/*.js` scripts (plain script tags, no build). Keep `data/skeleton-data.js` loaded with normal script tag; `data/organs-data.js` LAZY-loaded (dynamic script tag) first time Organs or Circulation tab is used.
- MediaPipe tasks-vision 0.10.14: dynamic `import('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs')`, `FilesetResolver.forVisionTasks(base+'/wasm')`, pose_landmarker_full.task + hand_landmarker.task (GPU delegate, CPU fallback), runningMode VIDEO, numPoses 1, numHands 2.
- Raw WebGL2 on `<canvas id="bones">`, 2D `<canvas id="labels">` above, `<video id="video" playsinline muted>` underneath. Handle devicePixelRatio. No Three.js.
- Decode: `atob(GLOBAL.data)` → Uint8Array. First `vBytes` bytes are vertex buffer, rest are Uint16 indices.
- SKEL vertex = 12 bytes: int16 x3 pos (dequant `p = a/32767*qs + qc`), int8 x3 normal, uint8 x2 bone ids (index into SKEL.ids; ids[0] is empty string). `segs[name]=[vStart,vCount,iStart,iCount]` per rigid segment. `joints[name]=[x,y,z]` rest pose, y down, z toward viewer negative. `labels[] = {id,lvl,seg,p}` lvl1 main / lvl2 details.
- SKEL qc=[1.05e-5,-0.7829,-0.1092] qs=0.85428, vBytes=1552512, verts=129376, indices=689379.
- SOFT vertex = 16 bytes: int16 x3 pos (dequant w/ SOFT qs/qc), int8 x3 normal, uint8 x4 = [palette idx, slotA, slotB, blend w 0..255]. Two-bone skinning: v = mix(MA*p, MB*p, w/255). Slots index `SOFT.main` = ['head','neck','thorax','lumbar','pelvis','hum_L','fore_L','palm_L','fem_L','shin_L','foot_L','hum_R','fore_R','palm_R','fem_R','shin_R','foot_R'] (same segment names as SKEL).
- SOFT chunks = [group,vStart,vCount,iStart,iCount], group in organs|heart|vessels. Organs tab shows organs+heart; Circulation shows vessels+heart. `pal[i]=[r,g,b,kind]` kind 0 organ 1 artery 2 vein 3 heart. `SOFT.heart` = heart centre for pulse. SOFT qc=[4.775e-5,-0.7791,-0.1068] qs=0.85265 vBytes=3845056.
- Rest-pose key joints (model units): shoulders y≈-1.32, hips y≈-0.81, knees y≈-0.38, ankles y≈0.017, head top≈-1.62, toes y≈0.066. x right ≈ ±0.17 shoulder.
- Looks: X-ray = additive, no depth, fresnel brightness, pale cyan; Solid = depth test, ivory + directional/rim light. Selected = #ffd166. Bone brightness slider. Organs from pal, artery pulse out from heart, veins slower, heart beats.
- UI: bg #020a12 ink #dff1ff dim #8fb2c9 line #17384d accent #5ad1ff hot #ffd166, system font, mobile-first, no page scroll. Start overlay ("Start camera" / "Demo without camera", tip + credit + privacy lines), status pill top-centre, ☰ panel (Camera: rear/freeze/mirror; Skeleton: look/brightness/finger bones; Part names: hidden/main/all + text size), bottom tabs Skeleton/Organs/Circulation. Info card on tap with name, Latin subtitle, 1-2 sentence description for EVERY id in SKEL.ids and SOFT.ids (PARTS table). Settings in localStorage (try/catch). `?demo=1` auto-starts demo.
- Done = demo renders full moving skeleton smoothly, both looks, labels + info card, organs/circulation load/render, no console errors in Chromium, screenshots docs/shot-demo-xray.png + docs/shot-demo-organs.png, camera path graceful when denied (not testable headless).
- Data licence: BodyParts3D, (c) The Database Center for Life Science, CC BY-SA 2.1 Japan. Credit on start screen + README.

## Pose-solver plan (from spec section "Pose solving")

- Model→screen: per segment matrix in PIXEL space. `u` = px per model unit = pxPerMeter * metersPerModel (metersPerModel from torso ratio tracked vs rest). Pivot joint per segment → screen px via image landmarks (mirror-aware); rotation from world landmarks axes (rest axis joints → tracked landmark axis) with twist fixed by a hint landmark; children anchored to parent joints. Visibility gating hides unseen parts. Demo synthesizes 33 pose landmarks (breathing/arm wave/sway) + hands off.

## Milestones

- M1 static page, UI shell, start overlay, panel, tabs, settings in localStorage — COMMITTED
- M2 WebGL2 decoder + renderer, SKEL rest pose, both looks — COMMITTED
- M3 pose solver + demo mode — COMMITTED
- M4 labels canvas, tap-to-select, info card, PARTS — COMMITTED
- M5 organs/circulation lazy load, skinning, pulse — COMMITTED
- M6 camera path MediaPipe pose+hands, rear, freeze, mirror/real — COMMITTED
- M7 headless Chromium ?demo=1, screenshots, zero console errors — COMMITTED

## XR-002 fix round (after CTO review of XR-001)

Root cause found by CTO (already fixed, commit "Fix rest-to-track rotation"):
frameMat indexed the rest frame Fr[c][k] instead of Fr[k][c]. Do not change.

- Fingers/palm matrix reuse when no hand data (was double-mirrored, drifted
  off the palm); mc1 thumb metacarpal segments now get a matrix too — COMMITTED
- Solver u now measured with the matching rest pair (shoulder-mid/hip-mid),
  demoFrame(t, W, H) rebuilt from SKEL.joints rest positions with rigid limb
  rotations; body framed ~5-6% margins top and bottom, both orientations;
  "Step back" gated to camera mode — COMMITTED
- Labels: Left/Right prefixes on paired bones, Main-level dedupe, harder
  collision avoidance; default level remains Main (names=1) — COMMITTED
- js/selftest.js numeric self-test (?selftest=1): limb distal joints vs
  tracked landmarks < 10% of bone px length, finger origins < 15% palm
  length from palm, heart centre inside transformed thorax bounds —
  COMMITTED, SELFTEST PASS, zero console errors
- Screenshots retaken: shot-demo-xray.png, shot-demo-organs.png, new
  shot-demo-circulation.png — COMMITTED
- docs/LAPORAN.md STATUS: SIAP — COMMITTED

(Update this file after each milestone.)