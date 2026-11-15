STATUS: SIAP

## Yang berfungsi (disemak dengan Chromium headless)

- Demo mode (`?demo=1`) menjana pose sintetis (lengan melambai, bernafas, sedikit sway) dan menggerakkan seluruh kerangka melalui penyelesai pose yang sama dengan laluan kamera.
- Rupa X-ray (additive, fresnel, cyan pucat) dan rupa Solid (depth test, ivory + cahaya arah + rim) kedua-duanya merender tanpa ralat konsol. Disahkan dengan analisis piksel atas tangkapan skrin: cyan ~11% (x-ray), ivory ~5% (solid).
- Tab Organs / Circulation: `data/organs-data.js` di-load secara lazy (tag skrip dinamik) bila tab pertama dinyalakan; organ + jantung, vesel + jantung di-skinned dengan two-bone skinning (slot `SOFT.main`), denyut arteri keluar dari jantung, denyut jantung dalam shader.
- Label pada kanvas 2D dengan garis penunjuk, hindaran perlanggaran, tiga paras (Hidden / Main bones / All details), slider saiz teks; ketuk label memilih bahagian dan membuka kad info (nama, Latin, deskripsi bahasa Inggeris mudah) untuk setiap id dalam `SKEL.ids` dan `SOFT.ids` (jadual `PARTS` ditulis sendiri).
- Panel kawalan: kamera belakang, freeze, mirror vs real, rupa, kecerahan tulang, tulang jari terperinci, paras nama, saiz teks. Semua tetapan disimpan dalam localStorage (dibungkus try/catch).
- Tangkapan skrin: `docs/shot-demo-xray.png` (x-ray + label) dan `docs/shot-demo-organs.png` (organ + label) — kedua-duanya dari Chromium headless, 900x1400.
- Tiada ralat konsol dalam Chromium headless pada semua laluan yang diuji (`?demo=1`, `&organs=1`, `&look=solid`).
- Semua fail JS lulus `node --check`.

## Belum disahkan (tidak boleh diuji headless)

- Laluan kamera sebenar: `getUserMedia` + MediaPipe Tasks Vision (model di-load dari CDN semasa runtime). Kod ada (GPU delegate dengan fallback CPU), tetap kamera tidak boleh diuji dalam persekitaran headless; jika kebenaran ditolak, aplikasi menunjukkan mesej jelas dan menyarankan Demo.
- Kesantulan tangan kanan/kiri semasa tracking sebenar (hanya logik asosiasi wrist ikut jarak yang diuji secara statik).
- Ketepatan tracking dalam gerakan sebenar, dan padanan rasio video `object-fit: cover` dengan landmark (dilabel sebagai anggaran).

## Cara jalankan

    python -m http.server 8080
    # buka http://localhost:8080 (kamera perlu localhost/https)
    # atau terus: http://localhost:8080/?demo=1

## Struktur

`index.html` + `js/{util,parts,renderer,pose,labels,app}.js`; data seperti sediakan dalam `data/`. Komit per milestone di cabang `master` (M1..M6 + M7).

## Kredit data

BodyParts3D, (c) The Database Center for Life Science, CC BY-SA 2.1 Japan. Pose tracking: MediaPipe Tasks Vision dari CDN. Semua kod lain ditulis sendiri untuk projek ini.