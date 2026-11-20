// lessons.js: short teaching videos. Each entry adds a row to the Lessons list
// and a "Watch the lesson" button on the info card of every part it names.
//   { title, about, src, poster, parts: [ids from parts.js] }
// src may be one file, or one per language: { en: 'videos/heart-en.mp4', ms: 'videos/heart-ms.mp4' }
// (optional titles: { en, ms }). The viewer picks the language in the player.
'use strict';
window.LESSONS = [
  { title: 'The heart', titles: { en: 'The heart', ms: 'Jantung' },
    about: 'What it is and how it pumps blood. 35 seconds, made with AI.',
    src: { en: 'videos/heart-en.mp4', ms: 'videos/heart-ms.mp4' }, poster: 'videos/heart.jpg',
    parts: ['heart', 'coronary', 'aorta', 'pulmArt', 'pulmVein'] },
];
