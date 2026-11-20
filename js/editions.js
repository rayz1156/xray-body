// editions.js: edition registry. An edition restyles the app and can add its own activities.
// Edition object (all fields optional except id):
//   id, bodyClass, look ('xray'|'solid' forced look), renderStyle (XR.setStyle arg), labelStyle (XL.setStyle arg),
//   labelFilter(label, layer), labelText(id, side), names (forced label level 0..2),
//   tabMode 'toggle'|'single', defaultView 'skel'|'org'|'circ', panel: { look, names, fingers } (show those settings),
//   mount(app), unmount(), onTap(hit) -> true when handled, card(id) -> { name, latin, desc, html } or null,
//   onView(view), onLang(), onFrame(pose, t), busy() -> true while an activity must not be interrupted by a lesson.
'use strict';
const XE = (() => {
  const reg = {};
  const register = (ed) => { reg[ed.id] = ed; };
  const get = (id) => reg[id] || reg.explore;
  const has = (id) => !!reg[id];
  return { register, get, has, list: () => Object.keys(reg) };
})();

// The original experience, kept as it was (glow skeleton, all labels, layer toggles).
XE.register({
  id: 'explore',
  bodyClass: 'ed-explore',
  tabMode: 'toggle',
  panel: { look: true, names: true, fingers: true },
  labelText: (id, side) => XE.sided(XI.part(id)[0], side),
});

// "Thigh bone (femur)" + side -> "Left thigh bone (femur)" in English, "Tulang paha kiri (femur)" in Malay.
XE.sided = (name, side) => {
  if (!side) return name;
  const word = XI.t('side_' + side);
  if (XI.lang === 'ms'){
    const k = name.indexOf(' (');
    return k > 0 ? name.slice(0, k) + ' ' + word.toLowerCase() + name.slice(k) : name + ' ' + word.toLowerCase();
  }
  return word + ' ' + name.charAt(0).toLowerCase() + name.slice(1);
};
