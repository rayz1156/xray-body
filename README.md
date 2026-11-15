# X-Ray Body Mirror

A single-page, offline-capable web app that tracks your body with the camera and draws a labelled 3D skeleton (plus organs and blood vessels) that follows your pose live, like an x-ray mirror. Everything runs on the device; nothing is uploaded. Not a medical device.

## Run locally

    python -m http.server 8080

Then open http://localhost:8080 (the camera needs `localhost` or HTTPS). Click "Start camera", or "Demo without camera" to try it without one. Add `?demo=1` to auto-start demo mode.

Controls: the &#9776; button opens the panel (rear camera, freeze, mirror vs real image, x-ray vs solid look, bone brightness, detailed finger bones, part-name levels, text size). Bottom tabs toggle Skeleton / Organs / Circulation layers. Tap a label to open an info card about that part.

## Structure

- `index.html` — markup, CSS, app shell
- `js/util.js` — settings (localStorage), base64 decode, vector/matrix helpers
- `js/parts.js` — name / Latin / plain-English description for every bone and organ id
- `js/renderer.js` — raw WebGL2 renderer (x-ray and solid looks, two-bone skinning, pulse)
- `js/pose.js` — pose solver (landmarks to per-segment transforms) + demo pose generator
- `js/labels.js` — 2D label canvas, collision avoidance, tap picking
- `js/app.js` — wiring, camera + MediaPipe, main loop
- `data/skeleton-data.js` — bone meshes (loaded normally)
- `data/organs-data.js` — organ/vessel meshes (lazy-loaded on first Organs/Circulation use)
- `docs/` — data index and verification report

## Credits

Anatomy meshes: BodyParts3D, (c) The Database Center for Life Science, licensed under CC Attribution-Share Alike 2.1 Japan.
Pose tracking: MediaPipe Tasks Vision (Google), loaded from CDN at runtime.
All other code written for this project.