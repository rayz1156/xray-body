// lessons.js: short teaching videos, per edition. They play in the left panel.
//   { id, edition: 'explore'|'kids'|'forensic', tabs: ['skel'|'org'|'circ'] (tab that starts it),
//     parts: [ids that start it from the info card], title, titles: { en, ms }, about, abouts: { en, ms },
//     src: { en, ms }, poster }
'use strict';
window.LESSONS = [
  { id: 'heart', edition: 'explore', tabs: ['org', 'circ'], title: 'The heart', titles: { en: 'The heart', ms: 'Jantung' },
    about: 'What it is and how it pumps blood. 35 seconds, made with AI.',
    abouts: { en: 'What it is and how it pumps blood. 35 seconds, made with AI.', ms: 'Apakah jantung dan cara ia mengepam darah. 35 saat, dihasilkan dengan AI.' },
    src: { en: 'videos/heart-en.mp4', ms: 'videos/heart-ms.mp4' }, poster: 'videos/heart.jpg',
    parts: ['heart', 'coronary', 'aorta', 'pulmArt', 'pulmVein'] },

  { id: 'kids-skeleton', edition: 'kids', tabs: ['skel'], title: 'Your super skeleton', titles: { en: 'Your super skeleton', ms: 'Rangka hebat kamu' },
    abouts: { en: 'Sendi shows what bones do. 40 seconds, animated.', ms: 'Sendi tunjukkan apa tugas tulang. 40 saat, animasi.' },
    src: { en: 'videos/kids-skeleton-en.mp4', ms: 'videos/kids-skeleton-ms.mp4' }, poster: 'videos/kids-skeleton.jpg', parts: [] },
  { id: 'kids-blood', edition: 'kids', tabs: ['circ', 'org'], title: 'Your busy heart', titles: { en: 'Your busy heart', ms: 'Jantung yang rajin' },
    abouts: { en: 'How your heart and blood work. 45 seconds, animated.', ms: 'Cara jantung dan darah bekerja. 45 saat, animasi.' },
    src: { en: 'videos/kids-blood-en.mp4', ms: 'videos/kids-blood-ms.mp4' }, poster: 'videos/kids-blood.jpg', parts: ['heart', 'aorta', 'venacava', 'radial'] },

  { id: 'forensic-profile', edition: 'forensic', tabs: ['skel'], title: 'What bones can tell us', titles: { en: 'What bones can tell us', ms: 'Apa yang tulang beritahu kita' },
    abouts: { en: 'The biological profile: sex, age, stature and identity. 46 seconds.', ms: 'Profil biologi: jantina, umur, ketinggian dan identiti. 52 saat.' },
    src: { en: 'videos/forensic-profile-en.mp4', ms: 'videos/forensic-profile-ms.mp4' }, poster: 'videos/forensic-profile.jpg', parts: ['hipbone', 'teeth', 'sacrum'] },
  { id: 'forensic-stature', edition: 'forensic', tabs: [], title: 'Height from one bone', titles: { en: 'Height from one bone', ms: 'Ketinggian daripada satu tulang' },
    abouts: { en: 'Estimating stature from the femur, and its limits. 41 seconds.', ms: 'Menganggar ketinggian daripada femur, dan hadnya. 48 saat.' },
    src: { en: 'videos/forensic-stature-en.mp4', ms: 'videos/forensic-stature-ms.mp4' }, poster: 'videos/forensic-stature.jpg', parts: ['femur', 'tibia', 'fibula', 'humerus'] },
];
