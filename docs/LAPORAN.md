STATUS: SIAP

XR-002 (pusingan pembetulan selepas semakan CTO bagi XR-001). Semua kecacatan
dalam tiket telah dibetulkan, disahkan dengan ujian kendiri berangka
(index.html?selftest=1) dalam Chromium headless: SELFTEST PASS dan sifar
ralat konsol pada semua laluan yang diuji (?selftest=1, ?demo=1,
&organs=1, &circ=1, potret 900x1400 dan landskap 1400x900).

## Keputusan ujian kendiri (Chromium headless, 900x1400, ?selftest=1)

    SELFTEST canvas 900x1400 | segment rest->tracked distal, % of bone px length (limit 10%), fingers % of palm length (limit 15%), heart in thorax
    segment               worst t value%   limit%
    hum_L                 1.0     0.00     10
    fore_L                2.4     0.00     10
    palm_L                2.4     0.00     10
    fem_L                 2.4     0.00     10
    shin_L                2.4     0.00     10
    hum_R                 3.1     0.00     10
    fore_R                0.0     0.00     10
    palm_R                3.1     0.00     10
    fem_R                 2.4     0.00     10
    shin_R                1.0     0.00     10
    f_L_index_dist        0.0     0.00     15
    f_L_index_midd        0.0     0.00     15
    f_L_index_prox        0.0     0.00     15
    f_L_little_dist       0.0     0.00     15
    f_L_little_prox       0.0     0.00     15
    f_L_middle_dist       0.0     0.00     15
    f_L_middle_midd       0.0     0.00     15
    f_L_middle_prox       0.0     0.00     15
    f_L_ring_dist         0.0     0.00     15
    f_L_ring_prox         0.0     0.00     15
    f_L_thumb_dist        0.0     0.00     15
    f_L_thumb_prox       0.0     0.00     15
    mc1_L                 0.0     0.00     15
    f_R_index_dist        0.0     0.00     15
    f_R_index_midd        0.0     0.00     15
    f_R_index_prox        0.0     0.00     15
    f_R_little_dist       0.0     0.00     15
    f_R_little_prox       0.0     0.00     15
    f_R_middle_dist       0.0     0.00     15
    f_R_middle_midd       0.0     0.00     15
    f_R_middle_prox       0.0     0.00     15
    f_R_ring_dist         0.0     0.00     15
    f_R_ring_prox         0.0     0.00     15
    f_R_thumb_dist        0.0     0.00     15
    f_R_thumb_prox        0.0     0.00     15
    mc1_R                 0.0     0.00     15
    heart@thorax          0.0     0.00     100
    SELFTEST PASS

## Pembetulan XR-002

1. Tulang jari terapung ketika tiada data tangan: cabang tanpa tangan dalam
   penyelesai kini menggunakan matriks tapak tangan tanpa diubah untuk setiap
   segmen jari (rotasi, skala dan translasi yang sama menempatkan setiap
   titik rehat jari tepat di atas tapak tangan; sebelum ini x di-cerminkan
   dua kali dan jari hanyut ke kanan badan). Segmen metakarpal ibu jari
   (mc1_L/mc1_R) yang dahulunya tiada matriks dan tidak pernah dirender
   turut diperbaik.
2. Pembingkaian demo: skala penyelesai u dahulu dianggar daripada pasangan
   landmark yang tidak sepadan (bahu/pinggul px lawan jarak rehat
   c7t1/l5s1, ralat 14%), menjadikan jejaring lebih tinggi daripada kanvas
   (tengkorak terpotong). Pasangan rehat yang sepadan kini dipakai supaya u
   bersetuju dengan pemetaan landmark; keseluruhan badan (puncak kepala
   -1.64 hingga bawah kaki +0.05 unit model) berada dalam ~5-6% margin atas
   dan bawah kanvas, potret dan landskap (disahkan berangka pada t =
   0..3.0: atas 4.6-5.4%, bawah 93.6-94.6%). Pill "Step back" kini hanya
   muncul dalam mod kamera, tidak pernah dalam demo.
3. Panjang tulang pose demo: landmark demo kini dibina daripada titik rehat
   SKEL.joints dan anggota diputarkan secara kaku di sekeliling sendi
   (lambungan lengan, angkatan + lambungan lengan kanan, lenturan lutut,
   alun/bangun/sway), jadi panjang tulang padan dengan jejaring (dahulu
   hiris kanan ~125 px tersasar; kini semua jarak 0.00%, lihat jadual).
4. Label: paras lalai kekal "Main bones" (names=1). Tulang berpasangan
   dilabel "Left ..."/"Right ..." (cth. Left femur); id berulang pada
   segmen yang sama (hipbone pada pelvis) hanya dipaparkan sekali pada
   paras Main. Hindaran perlanggaran diperkukuh (dua arah, offset
   18/30/44 px, lima anjakan menegak, kotak mesti dalam kanvas, padding
   bertindih).
5. Ujian kendiri berangka index.html?selftest=1 (js/selftest.js):
   XP.solve ke atas XP.demoFrame pada t = 0, 0.5, 1.0, 1.7, 2.4, 3.1;
   setiap segmen anggota (hum/fore/fem/shin/palm kedua-dua sisi) mengukur
   jarak titik rehat distal tertransformasi ke landmark distal terjejak
   dalam px, lulus jika < 10% panjang piksel tulang; setiap asalan segmen
   jari (termasuk mc1) < 15% panjang tapak tangan daripada tapak tangan;
   pusat jantung mendarat dalam sempadan segmen thorax tertransformasi
   (laluan Circulation kekal melekat pada badan). Jadual dicetak ke konsol
   dan baris akhir SELFTEST PASS / SELFTEST FAIL.
6. Tab Circulation disahkan melalui semakan heart@thorax di atas dan
   tangkapan skrin docs/shot-demo-circulation.png (vesel + jantung
   di-skinned dengan matriks utama, mengikuti badan).

## Tangkapan skrin (Chromium headless, 900x1400)

- docs/shot-demo-xray.png (kerangka + label paras Main)
- docs/shot-demo-organs.png (organ + jantung + label)
- docs/shot-demo-circulation.png (vesel + jantung + label)

Konsol: sifar ralat pada semua laluan yang diuji. Semua fail JS lulus
`node --check`.

## Belum disahkan (tidak boleh diuji headless)

- Laluan kamera sebenar: getUserMedia + MediaPipe Tasks Vision (model dari
  CDN semasa runtime). GPU delegate dengan fallback CPU ada, tetapi kebenaran
  kamera dan ketepatan tracking sebenar tidak boleh disahkan headless; jika
  ditolak, aplikasi menunjukkan mesej jelas dan menyarankan Demo.
- Kesantulan tangan kanan/kiri semasa tracking sebenar (logik asosiasi wrist
  ikut jarak diuji secara statik sahaja).
- Ketepatan landmark MediaPipe sebenar terhadap titik rehat model (ujian
  kendiri hanya mengukur pose demo sintetis).
- Kompilasi/perf pada peranti sebenar (telefon) belum disahkan.

## Cara jalankan

    python -m http.server 8080
    # http://localhost:8080/?demo=1          demo tanpa kamera
    # http://localhost:8080/?selftest=1     ujian kendiri berangka (konsol)
    # http://localhost:8080/?demo=1&circ=1  tab Circulation

## Struktur

`index.html` + `js/{util,parts,renderer,pose,labels,app,selftest}.js`; data
seperti sediakan dalam `data/`. Komit per milestone di cabang `master`
(M1..M7 + XR-002, tanpa push).

## Kredit data

BodyParts3D, (c) The Database Center for Life Science, CC BY-SA 2.1 Japan.
Pose tracking: MediaPipe Tasks Vision dari CDN. Semua kod lain ditulis
sendiri untuk projek ini.