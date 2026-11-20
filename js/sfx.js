// sfx.js: tiny synthesised sound effects and haptics. No audio files.
// XS.play('good'), XS.setMuted(true), XS.haptic(20). The audio context starts on the first
// user gesture (browsers block it before that), so calls made earlier are silently skipped.
'use strict';
const XS = (() => {
  let ac = null, master = null, muted = false, unlocked = false;

  function ctx(){
    if (!unlocked) return null;
    if (!ac){
      const C = window.AudioContext || window.webkitAudioContext;
      if (!C) return null;
      ac = new C();
      master = ac.createGain();
      master.gain.value = 0.42;
      master.connect(ac.destination);
    }
    if (ac.state === 'suspended') ac.resume();
    return ac;
  }
  // unlock on the first real gesture
  const unlock = () => { unlocked = true; ctx(); };
  if (typeof window !== 'undefined'){
    window.addEventListener('pointerdown', unlock, { once: true, capture: true });
    window.addEventListener('keydown', unlock, { once: true, capture: true });
  }

  // one voice: frequency glide f -> f2 over dur seconds with a fast attack and an exponential tail
  function tone(o){
    const a = ctx(); if (!a) return;
    const t0 = a.currentTime + (o.at || 0);
    const osc = a.createOscillator(), g = a.createGain();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(o.f, t0);
    if (o.f2) osc.frequency.exponentialRampToValueAtTime(o.f2, t0 + o.dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(o.vol || 0.5, t0 + (o.attack || 0.008));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur);
    osc.connect(g); g.connect(master);
    osc.start(t0); osc.stop(t0 + o.dur + 0.03);
  }
  // filtered noise burst (whoosh, shutter)
  function noise(o){
    const a = ctx(); if (!a) return;
    const t0 = a.currentTime + (o.at || 0);
    const n = Math.floor(a.sampleRate * o.dur);
    const buf = a.createBuffer(1, n, a.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    const src = a.createBufferSource(); src.buffer = buf;
    const f = a.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = o.q || 1.2;
    f.frequency.setValueAtTime(o.f, t0);
    if (o.f2) f.frequency.exponentialRampToValueAtTime(o.f2, t0 + o.dur);
    const g = a.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(o.vol || 0.3, t0 + o.dur * 0.3);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur);
    src.connect(f); f.connect(g); g.connect(master);
    src.start(t0); src.stop(t0 + o.dur + 0.03);
  }
  const N = (n) => 440 * Math.pow(2, (n - 69) / 12);   // MIDI note -> Hz

  const SOUNDS = {
    tap:     () => tone({ f: 620, f2: 480, dur: 0.07, vol: 0.25, type: 'triangle' }),
    select:  () => { tone({ f: N(76), dur: 0.12, vol: 0.3, type: 'triangle' }); tone({ f: N(81), dur: 0.16, vol: 0.22, at: 0.05 }); },
    open:    () => tone({ f: 380, f2: 620, dur: 0.14, vol: 0.22, type: 'triangle' }),
    close:   () => tone({ f: 620, f2: 380, dur: 0.12, vol: 0.2, type: 'triangle' }),
    pop:     () => tone({ f: 300, f2: 900, dur: 0.09, vol: 0.4 }),
    tick:    () => tone({ f: 1400, dur: 0.03, vol: 0.14, type: 'square' }),
    good:    () => { tone({ f: N(72), dur: 0.16, vol: 0.35, type: 'triangle' }); tone({ f: N(79), dur: 0.26, vol: 0.35, type: 'triangle', at: 0.11 }); },
    great:   () => [72, 76, 79, 84].forEach((n, i) => tone({ f: N(n), dur: 0.22, vol: 0.32, type: 'triangle', at: i * 0.085 })),
    star:    () => { tone({ f: N(88), dur: 0.35, vol: 0.28, at: 0 }); tone({ f: N(93), dur: 0.45, vol: 0.24, at: 0.07 }); tone({ f: N(100), dur: 0.5, vol: 0.14, at: 0.14 }); },
    oops:    () => { tone({ f: N(64), f2: N(60), dur: 0.22, vol: 0.26, type: 'sine' }); },
    hint:    () => { tone({ f: N(79), dur: 0.12, vol: 0.2 }); tone({ f: N(79), dur: 0.12, vol: 0.2, at: 0.16 }); },
    whoosh:  () => noise({ f: 500, f2: 2600, dur: 0.28, vol: 0.22 }),
    shutter: () => { noise({ f: 3200, dur: 0.05, vol: 0.3, q: 0.7 }); noise({ f: 1800, dur: 0.06, vol: 0.25, q: 0.7, at: 0.07 }); },
    stamp:   () => { tone({ f: 120, f2: 60, dur: 0.16, vol: 0.5 }); noise({ f: 900, dur: 0.06, vol: 0.2 }); },
    confirm: () => { tone({ f: N(69), dur: 0.1, vol: 0.25, type: 'square' }); tone({ f: N(76), dur: 0.16, vol: 0.22, type: 'square', at: 0.09 }); },
    deny:    () => tone({ f: 180, f2: 140, dur: 0.2, vol: 0.28, type: 'square' }),
    win:     () => [60, 64, 67, 72, 76, 79, 84].forEach((n, i) => tone({ f: N(n), dur: 0.3, vol: 0.3, type: 'triangle', at: i * 0.075 })),
  };

  function play(name){
    if (muted) return;
    const f = SOUNDS[name];
    if (f) { try { f(); } catch (e) { /* audio not available */ } }
  }
  function haptic(pattern){
    if (muted) return;
    try { if (navigator.vibrate) navigator.vibrate(pattern || 15); } catch (e) {}
  }
  const setMuted = (m) => { muted = !!m; };
  const isMuted = () => muted;

  return { play, haptic, setMuted, isMuted, names: () => Object.keys(SOUNDS) };
})();
