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
## Editions (Nov 2026)

The start screen offers three editions, in English and Bahasa Melayu (switch at the top right):

- **Kids** (`js/ed-kids.js`, `js/kids-data.js`): cartoon skeleton, child-friendly names, Sendi the mascot, five find-the-part missions with stars, a sticker book, and two animated lessons.
- **Forensic Lab** (`js/ed-forensic.js`, `js/forensic-data.js`): specimen skeleton, an evidence card per bone, a locate drill, a fictional case file, a stature calculator (Trotter and Gleser 1952 femur equation), and two lessons.
- **Explore** (`js/editions.js`): the original X-ray mirror with the heart lesson.

Deep links: `?edition=kids|forensic|explore`, `&lang=en|ms`, `&demo=1`. Content facts come from sourced fact sheets kept outside the repo (xray-lessons/research).
Fonts: Fredoka, Nunito, IBM Plex Sans and IBM Plex Mono (SIL OFL 1.1, licences in `assets/fonts/`). Lesson videos are AI narrated (neural text to speech) and animated.
