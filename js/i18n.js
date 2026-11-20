// i18n.js: English and Bahasa Melayu strings, the current language, and part names in both languages.
//   XI.t('key', { n: 3 })   XI.lang   XI.set('ms')   XI.on(fn)   XI.part(id) -> [name, latin, desc]
'use strict';
const XI = (() => {
  const STR = {
    en: {
      appName: 'X‑Ray Body Mirror',
      pickEdition: 'Choose how you want to play',
      edKids: 'Kids', edKidsSub: 'Find bones and organs with Sendi. Stars and stickers. Ages 6 to 10.',
      edForensic: 'Forensic Lab', edForensicSub: 'What bones tell an investigator. Drills, a case file and a height calculator.',
      edExplore: 'Explore', edExploreSub: 'The full X-ray mirror: skeleton, organs and blood vessels on you.',
      language: 'Language',
      startCam: 'Start camera', startPhoto: 'Use my photo', startDemo: 'Play without camera',
      tipBody: 'Stand back so your whole body is in view. For a photo, pick one that shows you head to toe.',
      kidsHelper: 'Grown-up helper: prop the phone up and stand about 2 metres away. Without a camera, Sendi shows a model skeleton instead.',
      forensicNote: 'All cases are fictional training scenarios. Not a substitute for professional training.',
      privacy: 'Your camera and photos never leave your device. Not a medical device.',
      credit: 'Anatomy meshes: BodyParts3D, © The Database Center for Life Science, CC BY-SA 2.1 Japan.',
      back: 'Back', home: 'Home', close: 'Close', lessons: 'Lessons', watch: 'Watch the lesson',
      skeleton: 'Skeleton', organs: 'Organs', circulation: 'Blood', circulationLong: 'Circulation',
      settings: 'Settings', picture: 'Picture', liveCam: 'Live camera', myPhoto: 'Use my photo', rearCam: 'Rear camera',
      freeze: 'Freeze', mirror: 'Mirror', real: 'Real view', look: 'Look', glow: 'Glow', solid: 'Solid',
      brightness: 'Brightness', fingers: 'Finger bones', names: 'Part names', namesOff: 'Hidden', namesMain: 'Main',
      namesAll: 'All', textSize: 'Text size', sound: 'Sound', on: 'On', off: 'Off', changeEdition: 'Change mode',
      zoom: 'Zoom', zoomBody: 'Body', zoomHead: 'Head', zoomChest: 'Chest', zoomHips: 'Hips', zoomLegs: 'Legs',
      loading: 'Loading models…', readingPhoto: 'Reading your photo…', stepBack: 'Step back', noBody: 'No body found',
      photoBad: 'That file could not be opened as a picture.',
      photoNoBody: 'No body found in this photo. Try one that shows you head to toe, in good light.',
      modelsFail: 'Could not load tracking models (offline?). Play without camera instead.',
      camFail: 'The camera could not start. Allow camera access, or play without camera.',
      organFail: 'Could not load organ data',
      side_L: 'Left', side_R: 'Right',
      // kids
      kHello: 'Hi! I am Sendi. Tap a part of the body to learn about it!',
      kPlay: 'Play', kStickers: 'Stickers', kMissions: 'Missions', kFree: 'Explore',
      kFind: 'Find the {name}!', kFindSub: 'Tap it on the body.', kYes: ['Yes! That is the {name}!', 'You found it!', 'Great job!', 'Super!'],
      kNotYet: 'That is the {name}. Try again!', kHint: 'Look where it is glowing!', kHint2: 'Here it is. Tap the glowing spot!',
      kDone: 'Mission complete!', kStarsGot: 'You got {n} stars!', kAgain: 'Play again', kNext: 'Next mission',
      kSticker: 'New sticker: {name}!', kStickerBook: 'Sticker book', kFound: '{n} of {m} found',
      kOnYou: 'Find it on you', kWow: 'Wow!', kJob: 'Its job', kMission_bones: 'Big bones', kMission_limbs: 'Arms and legs',
      kMission_organs: 'Inside team', kMission_blood: 'Blood highway', kMission_mix: 'Mix-up master',
      kLocked: 'Finish the mission before it to unlock this one.', kRest: 'Great playing! Time for a little rest?',
      kTapBody: 'Tap the body to find parts!', kQ: 'Question {i} of {n}', kStars: 'Stars',
      // forensic
      fTitle: 'Forensic Lab', fDrill: 'Bone drill', fCase: 'Case file', fStature: 'Height calc', fEvidence: 'What this bone can tell an investigator',
      fLocate: 'Locate: {name}', fLocateSub: 'Tap the bone. Labels are hidden.', fCorrect: 'Correct.', fWrongWas: 'That is the {name}.',
      fScore: 'Score {s} of {n}', fTime: 'Time {t} s', fScoreLbl: 'Score', fTimeLbl: 'Time', fRank: 'Rank', fRanks: ['Trainee', 'Technician', 'Analyst'],
      fDrillDone: 'Drill complete', fRetry: 'Try again', fTells: { sex: 'Sex', age: 'Age', stature: 'Stature', trauma: 'Trauma', identity: 'Identity', other: 'Other' },
      fCaveat: 'Limit', fNoEvidence: 'No evidence notes for this part. Tap a bone to see what it can tell an investigator.',
      fCalcTitle: 'Stature from the femur', fFemur: 'Femur length (cm)', fEstimate: 'Estimated height', fRange: 'Likely range (about 95%)',
      fEquation: 'Trotter and Gleser (1952), American White males: height = 2.38 × femur + 61.41 cm, standard error 3.27 cm.',
      fCalcCaveat: 'A formula only fits people like those it was built from (population, sex, time period), and the answer is a range, not an exact height.',
      fCalcWhy: 'Why the femur? Leg bones contribute most to standing height, so the femur is the preferred single bone.',
      fTraining: 'Training scenario. All cases are fictional.', fStep: 'Step {i} of {n}', fNextStep: 'Next', fFinish: 'Finish',
      fCaseScore: 'Case score: {s} / {n}', fReport: 'Case report', fCheck: 'Check',
    },
    ms: {
      appName: 'Cermin Badan X‑Ray',
      pickEdition: 'Pilih cara anda mahu bermain',
      edKids: 'Kanak-kanak', edKidsSub: 'Cari tulang dan organ bersama Sendi. Bintang dan pelekat. Umur 6 hingga 10 tahun.',
      edForensic: 'Makmal Forensik', edForensicSub: 'Apa yang tulang beritahu penyiasat. Latih tubi, fail kes dan kalkulator ketinggian.',
      edExplore: 'Jelajah', edExploreSub: 'Cermin X-ray penuh: rangka, organ dan salur darah pada badan anda.',
      language: 'Bahasa',
      startCam: 'Mula kamera', startPhoto: 'Guna foto saya', startDemo: 'Main tanpa kamera',
      tipBody: 'Berdiri jauh sedikit supaya seluruh badan kelihatan. Untuk foto, pilih yang menunjukkan anda dari kepala hingga kaki.',
      kidsHelper: 'Untuk orang dewasa: sandarkan telefon dan berdiri kira-kira 2 meter jauhnya. Tanpa kamera, Sendi tunjukkan model rangka.',
      forensicNote: 'Semua kes ialah senario latihan rekaan. Bukan pengganti latihan profesional.',
      privacy: 'Kamera dan foto anda tidak pernah meninggalkan peranti anda. Bukan alat perubatan.',
      credit: 'Model anatomi: BodyParts3D, © The Database Center for Life Science, CC BY-SA 2.1 Japan.',
      back: 'Kembali', home: 'Utama', close: 'Tutup', lessons: 'Pelajaran', watch: 'Tonton pelajaran',
      skeleton: 'Rangka', organs: 'Organ', circulation: 'Darah', circulationLong: 'Peredaran darah',
      settings: 'Tetapan', picture: 'Gambar', liveCam: 'Kamera langsung', myPhoto: 'Guna foto saya', rearCam: 'Kamera belakang',
      freeze: 'Beku', mirror: 'Cermin', real: 'Pandangan sebenar', look: 'Rupa', glow: 'Bercahaya', solid: 'Pepejal',
      brightness: 'Kecerahan', fingers: 'Tulang jari', names: 'Nama bahagian', namesOff: 'Sembunyi', namesMain: 'Utama',
      namesAll: 'Semua', textSize: 'Saiz teks', sound: 'Bunyi', on: 'Hidup', off: 'Mati', changeEdition: 'Tukar mod',
      zoom: 'Zum', zoomBody: 'Badan', zoomHead: 'Kepala', zoomChest: 'Dada', zoomHips: 'Pinggul', zoomLegs: 'Kaki',
      loading: 'Memuatkan model…', readingPhoto: 'Membaca foto anda…', stepBack: 'Berundur sedikit', noBody: 'Badan tidak dikesan',
      photoBad: 'Fail itu tidak dapat dibuka sebagai gambar.',
      photoNoBody: 'Tiada badan dikesan dalam foto ini. Cuba foto dari kepala hingga kaki, dalam cahaya yang baik.',
      modelsFail: 'Model penjejakan gagal dimuatkan (luar talian?). Main tanpa kamera.',
      camFail: 'Kamera tidak dapat dimulakan. Benarkan akses kamera, atau main tanpa kamera.',
      organFail: 'Data organ gagal dimuatkan',
      side_L: 'Kiri', side_R: 'Kanan',
      kHello: 'Hai! Saya Sendi. Ketik bahagian badan untuk belajar tentangnya!',
      kPlay: 'Main', kStickers: 'Pelekat', kMissions: 'Misi', kFree: 'Jelajah',
      kFind: 'Cari {name}!', kFindSub: 'Ketik pada badan.', kYes: ['Ya! Itulah {name}!', 'Kamu jumpa!', 'Bagus!', 'Hebat!'],
      kNotYet: 'Itu {name}. Cuba lagi!', kHint: 'Lihat bahagian yang bercahaya!', kHint2: 'Di sini. Ketik tempat yang bercahaya!',
      kDone: 'Misi selesai!', kStarsGot: 'Kamu dapat {n} bintang!', kAgain: 'Main lagi', kNext: 'Misi seterusnya',
      kSticker: 'Pelekat baharu: {name}!', kStickerBook: 'Buku pelekat', kFound: '{n} daripada {m} dijumpai',
      kOnYou: 'Cari pada badan kamu', kWow: 'Wah!', kJob: 'Tugasnya', kMission_bones: 'Tulang besar', kMission_limbs: 'Tangan dan kaki',
      kMission_organs: 'Pasukan dalam badan', kMission_blood: 'Lebuh raya darah', kMission_mix: 'Juara campur-campur',
      kLocked: 'Selesaikan misi sebelumnya untuk membuka misi ini.', kRest: 'Hebat! Masa untuk berehat sekejap?',
      kTapBody: 'Ketik badan untuk mencari bahagian!', kQ: 'Soalan {i} daripada {n}', kStars: 'Bintang',
      fTitle: 'Makmal Forensik', fDrill: 'Latih tubi tulang', fCase: 'Fail kes', fStature: 'Kira tinggi', fEvidence: 'Apa yang tulang ini boleh beritahu penyiasat',
      fLocate: 'Cari: {name}', fLocateSub: 'Ketik tulang itu. Label disembunyikan.', fCorrect: 'Betul.', fWrongWas: 'Itu {name}.',
      fScore: 'Markah {s} daripada {n}', fTime: 'Masa {t} s', fScoreLbl: 'Markah', fTimeLbl: 'Masa', fRank: 'Pangkat', fRanks: ['Pelatih', 'Juruteknik', 'Penganalisis'],
      fDrillDone: 'Latih tubi selesai', fRetry: 'Cuba lagi', fTells: { sex: 'Jantina', age: 'Umur', stature: 'Ketinggian', trauma: 'Trauma', identity: 'Identiti', other: 'Lain-lain' },
      fCaveat: 'Had', fNoEvidence: 'Tiada nota bukti untuk bahagian ini. Ketik tulang untuk melihat apa yang boleh diberitahunya kepada penyiasat.',
      fCalcTitle: 'Ketinggian daripada femur', fFemur: 'Panjang femur (cm)', fEstimate: 'Anggaran ketinggian', fRange: 'Julat munasabah (kira-kira 95%)',
      fEquation: 'Trotter dan Gleser (1952), lelaki kulit putih Amerika: tinggi = 2.38 × femur + 61.41 cm, ralat piawai 3.27 cm.',
      fCalcCaveat: 'Formula hanya sesuai untuk orang yang serupa dengan sampel asalnya (populasi, jantina, zaman), dan jawapannya ialah julat, bukan ketinggian tepat.',
      fCalcWhy: 'Mengapa femur? Tulang kaki paling banyak menyumbang kepada ketinggian berdiri, jadi femur ialah tulang tunggal pilihan.',
      fTraining: 'Senario latihan. Semua kes adalah rekaan.', fStep: 'Langkah {i} daripada {n}', fNextStep: 'Seterusnya', fFinish: 'Selesai',
      fCaseScore: 'Markah kes: {s} / {n}', fReport: 'Laporan kes', fCheck: 'Semak',
    },
  };

  const KEY = 'xray-lang';
  let lang = 'en';
  try {
    const q = new URLSearchParams(location.search).get('lang');
    const saved = localStorage.getItem(KEY);
    lang = q === 'ms' || q === 'en' ? q : (saved === 'ms' || saved === 'en' ? saved :
      ((navigator.language || '').toLowerCase().startsWith('ms') ? 'ms' : 'en'));
  } catch (e) {}
  const subs = [];

  function t(key, vars){
    let s = STR[lang][key];
    if (s === undefined) s = STR.en[key];
    if (s === undefined) return key;
    if (Array.isArray(s)) s = s[Math.floor(Math.random() * s.length)];
    if (typeof s !== 'string') return s;
    if (vars) s = s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] !== undefined ? vars[k] : m));
    return s;
  }
  function raw(key){ return STR[lang][key] !== undefined ? STR[lang][key] : STR.en[key]; }
  function set(l){
    if (l !== 'en' && l !== 'ms' || l === lang) return;
    lang = l;
    try { localStorage.setItem(KEY, l); } catch (e) {}
    document.documentElement.lang = l;
    apply();
    for (const f of subs) { try { f(l); } catch (e) { console.error(e); } }
  }
  const on = (f) => subs.push(f);
  // [name, latin, description] in the current language (English fallback)
  function part(id){
    const en = (window.PARTS || {})[id];
    const ms = (window.PARTS_MS || {})[id];
    return lang === 'ms' && ms ? ms : (en || [id, '', '']);
  }
  // fill every [data-i18n="key"] element (text) and [data-i18n-aria="key"] (aria-label)
  function apply(root){
    const r = root || document;
    r.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
    r.querySelectorAll('[data-i18n-aria]').forEach((el) => { el.setAttribute('aria-label', t(el.dataset.i18nAria)); });
  }
  if (typeof document !== 'undefined') document.documentElement.lang = lang;
  return { t, raw, set, on, part, apply, get lang(){ return lang; }, STR };
})();
