# X-Ray Body Mirror clone: build spec

Goal: a single-page, offline-capable web app that tracks the viewer's body with the camera and draws a labelled 3D skeleton (plus organs and blood vessels) that follows their pose live, like an x-ray mirror. Everything runs on the device. Nothing is uploaded.

Write ALL code yourself. Do not fetch or copy code from the reference site. The mesh data in `data/` may be used as-is (licence below).

## Files to produce
- `index.html`: markup, CSS and the app script (one file is fine; split into `js/*.js` modules if it passes ~1500 lines).
- Keep `data/skeleton-data.js` (loaded with a normal script tag) and `data/organs-data.js` (lazy-loaded with a dynamic script tag the first time Organs or Circulation is turned on).
- `README.md`: how to run locally (`python -m http.server 8080`, open http://localhost:8080; camera needs localhost or https), credits.
- `NOTES.md`: your progress notes. Update it after each milestone so a restarted run can resume.

## Stack (fixed)
- MediaPipe Tasks Vision 0.10.14 from `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14` via dynamic `import(base + '/vision_bundle.mjs')`, `FilesetResolver.forVisionTasks(base + '/wasm')`.
- Models: `https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/latest/pose_landmarker_full.task` and `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/latest/hand_landmarker.task`. runningMode VIDEO, GPU delegate with CPU fallback, numPoses 1, numHands 2.
- Raw WebGL2 (no Three.js) on `<canvas id="bones">`, plus a 2D `<canvas id="labels">` above it for text and tap hit-testing. `<video id="video" playsinline muted>` underneath. Handle devicePixelRatio.

## Data format (verified)
Both files set a global with JSON metadata, then `<GLOBAL>.data = "<base64>"`. Decode with atob into a Uint8Array. Bytes `[0, vBytes)` are the vertex buffer, the rest are Uint16 triangle indices (UNSIGNED_SHORT, local to each draw range). Full index of names, joints, labels, chunks and palette: `docs/data-index.md`.

### window.SKEL (bones), 12-byte vertex
- offset 0: int16 x3 position, dequantise `p = a/32767 * qs + qc`
- offset 6: int8 x3 normal (normalised)
- offset 9: uint8 x2 bone ids (index into `SKEL.ids`, used for highlighting the selected bone)
- `segs[name] = [vertStart, vertCount, idxStart, idxCount]`: each segment is a rigid body part (head, neck, thorax, lumbar, pelvis, hum_L, fore_L, palm_L, fem_L, shin_L, foot_L, right-side mirrors, clav_L/R, and per-finger phalanx segments f_<L|R>_<finger>_<prox|midd|dist>). Draw each with its own transform: set vertexAttribPointer offsets to `vertStart*12`, then `drawElements(TRIANGLES, idxCount, UNSIGNED_SHORT, idxStart*2)`.
- `joints[name] = [x,y,z]` rest-pose joint positions in model units (x right, y down, z toward viewer is negative). Use them to build each segment's rest frame.
- `labels[] = {id, lvl, seg, p}`: lvl 1 = main bones, lvl 2 = all details; `p` is a rest-pose anchor that moves with segment `seg`.

### window.SOFT (organs + vessels), 16-byte vertex
- offset 0: int16 x3 position (same dequantise with SOFT.qs/qc); offset 6: int8 x3 normal
- offset 9: uint8 x4 = [palette index, matrix slot A, matrix slot B, blend weight 0..255]. Slots index `SOFT.main` (segment names shared with SKEL). Vertex = mix(MA*p, MB*p, w/255) (two-bone skinning, so vessels bend at joints).
- `chunks[] = [group, vStart, vCount, iStart, iCount]`, group in organs | heart | vessels. Organs tab shows organs+heart; Circulation tab shows vessels+heart.
- `pal[i] = [r,g,b,kind]`, kind 0 organ, 1 artery, 2 vein, 3 heart. `SOFT.heart` = heart centre for a pulse effect.
- Licence: BodyParts3D, (c) The Database Center for Life Science, CC BY-SA 2.1 Japan. Show the credit line on the start screen and in README.

## Pose solving (the core)
1. Smooth landmarks (One-Euro or exponential, with visibility gating). Use world landmarks for depth and image landmarks for screen placement.
2. For each segment, compute a rigid transform (3x3 rotation*scale + translation) that maps its rest-pose bone axis (between two SKEL joints, e.g. shoulder_L to elbow_L for hum_L) onto the tracked axis (between the matching pose landmarks). Use a third point (e.g. the opposite shoulder, or wrist for the forearm) to fix twist. Uniform scale from torso size so the skeleton fits the person.
3. Children inherit/anchor to parent joint positions so bones never visibly detach.
4. Hands: when a hand is tracked, drive palm and each finger phalanx from the 21 hand landmarks; otherwise keep the rest pose relative to the wrist. "Detailed finger bones" toggles finger segments.
5. Project to screen in the shader: map model x,y to canvas pixels, z to depth. Mirror mode flips x.
6. If a part is not visible (low landmark visibility), hide that segment rather than guess.
7. Demo mode: synthesise a plausible animated pose (breathing, arm wave, slight sway) and feed the same solver, so the app works without a camera.

## Rendering looks
- X-ray (default): additive blending, no depth test, fresnel-style brightness (bright at silhouette edges, faint face-on), pale cyan bones; CSS drop-shadow glow on the canvas.
- Solid: depth test, opaque ivory bone with simple directional light and rim light.
- Selected part tinted warm yellow (#ffd166 family) in both looks.
- Organs coloured from `pal`. Arteries pulse outward from the heart, veins slower, heart beats.
- "Bone brightness" slider scales intensity.

## UI
Colours: bg #020a12, ink #dff1ff, dim #8fb2c9, line #17384d, accent #5ad1ff, hot #ffd166. System font. Mobile first, works portrait and landscape, no page scroll.
- Start overlay: title "X-Ray Body Mirror", one-line explanation, buttons "Start camera" (primary) and "Demo without camera", tip "Stand back so your whole body is in view", credit + "Video never leaves your device. Not a medical device."
- Status pill top centre (loading models, "Step back", "No body found").
- ☰ Controls button top right opening a panel: Camera (Use rear camera, Freeze, Mirror image vs Real image), Skeleton (X-ray look vs Solid, Bone brightness slider, Detailed finger bones), Part names (Hidden / Main bones / All details, Text size slider).
- Bottom tabs: Skeleton, Organs, Circulation (each toggles its layer; Skeleton on by default).
- Labels drawn on the 2D canvas with leader lines, collision-avoided; tap a label (or the bone) to select and open an info card with name, Latin/subtitle and 1 to 2 sentence plain-English description. Write descriptions for every id in SKEL.ids and SOFT.ids yourself in a `PARTS` table.
- Persist settings in localStorage (wrapped in try/catch).

## Done means
- Demo mode renders the full skeleton moving smoothly, both looks work, labels and info card work, Organs and Circulation tabs load and render.
- No console errors in Chromium. Runs from a static server.
- Camera path implemented (cannot be tested headless; make it fail gracefully with a clear message if permission is denied).
- Verify with headless Chromium: serve the folder, open `?demo=1` (auto-start demo), screenshot to `docs/shot-demo-xray.png` and `docs/shot-demo-organs.png`, and check the console has no errors.
