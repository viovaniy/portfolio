// Work — cinema gallery. Slides ride a spring (a little underdamped, so they
// overshoot and settle like liquid) and stretch slightly with their speed.
// Drag/swipe, arrows, ← → keys or the timeline switch cases; the timeline
// fills while a case plays and moves on by itself.
// Real films later: put <video src="…" muted loop playsinline> in a slide's
// .cg-media instead of its .loop — the timeline then follows the video length.
(() => {
  const root = document.querySelector('.cg');
  if (!root) return;
  const track = root.querySelector('.cg-track');
  const slides = [...root.querySelectorAll('.cg-slide')];
  // Every card carries its own title, counter, arrows and timeline, so they
  // travel with the film instead of staying fixed in the middle.
  const template = root.querySelector('.cg-hud');
  template.remove();
  const tr0 = x => (window.t ? window.t(x) : x);
  slides.forEach((s, i) => {
    const hud = template.cloneNode(true);
    hud.querySelector('.cg-kind').textContent = tr0(s.dataset.kind);
    hud.querySelector('.cg-title').textContent = tr0(s.dataset.title);
    hud.querySelector('.cg-desc').textContent = tr0(s.dataset.desc);
    hud.querySelector('.cg-count b').textContent = String(i + 1).padStart(2, '0');
    hud.querySelector('.cg-caption').removeAttribute('aria-live');
    s.querySelector('.cg-frame').append(hud);
  });
  const segRows = slides.map(s => [...s.querySelectorAll('.cg-seg')]);
  // macOS-style scrubber: hovering the timeline of a film opens a Liquid Glass
  // seek bar with the elapsed time; click or drag to rewind.
  let scrubbing = null;
  const mmss = t => `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
  slides.forEach(s => {
    const v = s.querySelector('video');
    if (!v) return;
    s.classList.add('has-film');
    const bar = s.querySelector('.cg-timeline');
    const scrub = document.createElement('div');
    scrub.className = 'cg-scrub';
    scrub.innerHTML = '<span class="cg-time">00:00</span><span class="cg-rail"><i class="cg-fill"></i><b class="cg-knob"></b></span><span class="cg-left">-00:00</span>';
    scrub.setAttribute('role', 'slider');
    scrub.setAttribute('aria-label', tr0('Rewind'));
    scrub.tabIndex = 0;
    bar.append(scrub);
    // The seek bar sits exactly over the segment that is playing, and only
    // opens when the pointer reaches that segment — the others stay clickable.
    const fit = () => {
      const seg = bar.querySelector('.cg-seg.is-active');
      if (!seg) return;
      scrub.style.setProperty('--sl', seg.offsetLeft + 'px');
      scrub.style.setProperty('--sw', seg.offsetWidth + 'px');
    };
    bar.addEventListener('pointerover', e => { if (e.target.closest('.cg-seg.is-active')) fit(); });
    scrub._fit = fit;
    const rail = scrub.querySelector('.cg-rail');
    const seek = x => {
      const r = rail.getBoundingClientRect();
      const k = Math.min(1, Math.max(0, (x - r.left) / r.width));
      if (v.duration > 0) { v.currentTime = k * v.duration; v._last = v.currentTime; updateScrub(s, v); }
    };
    scrub.addEventListener('pointerdown', e => {
      e.preventDefault(); e.stopPropagation();
      scrubbing = s; scrub.classList.add('is-grab');
      try { scrub.setPointerCapture(e.pointerId); } catch {}
      seek(e.clientX);
    });
    scrub.addEventListener('pointermove', e => { if (scrubbing === s) seek(e.clientX); });
    const end = () => { if (scrubbing === s) { scrubbing = null; scrub.classList.remove('is-grab'); } };
    scrub.addEventListener('pointerup', end);
    scrub.addEventListener('pointercancel', end);
    scrub.addEventListener('keydown', e => {
      if (!(v.duration > 0)) return;
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        e.preventDefault(); e.stopPropagation();
        v.currentTime = Math.min(v.duration, Math.max(0, v.currentTime + (e.key === 'ArrowRight' ? 5 : -5)));
        v._last = v.currentTime; updateScrub(s, v);
      }
    });
  });
  function updateScrub(s, v) {
    const scrub = s.querySelector('.cg-scrub');
    if (!scrub || !(v.duration > 0)) return;
    const k = (v.currentTime / v.duration).toFixed(4);
    const st = scrub._st || (scrub._st = { time: scrub.querySelector('.cg-time'), left: scrub.querySelector('.cg-left') });
    if (st.k !== k) { scrub.style.setProperty('--k', k); st.k = k; }
    // the clock and ARIA values change once a second — touch the DOM only then
    const now = mmss(v.currentTime), left = '-' + mmss(Math.max(0, v.duration - v.currentTime));
    if (st.now !== now || st.left2 !== left) {
      st.now = now; st.left2 = left;
      st.time.textContent = now;
      st.left.textContent = left;
      scrub.setAttribute('aria-valuenow', Math.round(v.currentTime));
      scrub.setAttribute('aria-valuemax', Math.round(v.duration));
      scrub.setAttribute('aria-valuetext', now);
    }
  }

  // Real films get a progressive blur under the text (stronger towards the bottom).
  slides.forEach(s => {
    const media = s.querySelector('.cg-media');
    if (!media.querySelector('video')) return;
    const blur = document.createElement('span');
    blur.className = 'cg-pblur'; blur.setAttribute('aria-hidden', 'true');
    blur.innerHTML = '<i></i><i></i><i></i><i></i>';
    media.append(blur);
  });
  const n = slides.length;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const tr = s => (window.t ? window.t(s) : s);
  const STIFF = 190, DAMP = 17;           // spring: ~0.62 damping ratio → a soft bounce
  const PLAY = 6500;                      // ms per case when it has no video
  let pos = 0, target = 0, vel = 0, active = -1;
  let raf = 0, last = 0, placedPos = NaN, placedVel = NaN, lastP = '';
  let playStart = performance.now(), playHeld = 0, paused = false, visible = true, hovered = false, drag = null;

  const mod = (a, b) => ((a % b) + b) % b;
  // side cards (scaled to .86) sit 30px (16px on phones) away from the active one
  const gap = () => { const w = slides[0].offsetWidth; const narrow = innerWidth <= 650; return narrow ? w + 14 : w * .93 + 30; };
  const pad = x => String(x).padStart(2, '0');
  slides.forEach(sl => { sl.querySelector('.cg-count span').textContent = `/ ${pad(n)}`; });

  function place() {
    const g = gap();
    const stretch = reduced.matches ? 0 : Math.min(.07, Math.abs(vel) * .028);
    slides.forEach((s, i) => {
      let o = mod(i - pos + n / 2, n) - n / 2;          // offset from centre, wrapped for an endless loop
      const a = Math.abs(o);
      const x = Math.sign(o) * (Math.min(a, 1) * g + Math.max(a - 1, 0) * g * .8);
      const sc = 1 - Math.min(a, 1.6) * .14;
      const near = Math.max(0, 1 - a);                  // 1 at the centre
      const sx = sc * (1 + stretch * near), sy = sc * (1 - stretch * .55 * near);
      s.style.transform = `translate3d(${x}px,0,0) scale(${sx},${sy})`;
      s.style.opacity = a > 2.2 ? 0 : String(Math.min(1, 1.2 - a * .3));
      s.style.setProperty('--dim', Math.min(a, 1) * .35);
      s.style.zIndex = String(100 - Math.round(a * 10));
      s.style.visibility = a > 2.4 ? 'hidden' : '';
      s.inert = Math.round(o) !== 0;
    });
  }

  function setActive(index) {
    if (index === active) return;
    active = index;
    const s = slides[index];
    slides.forEach((x, i) => { x.classList.toggle('is-active', i === index); x.setAttribute('aria-hidden', String(i !== index)); });
    segRows.forEach(row => row.forEach((g, i) => {
      g.classList.toggle('is-active', i === index);
      g.classList.toggle('is-done', i < index);
      g.setAttribute('aria-current', i === index ? 'true' : 'false');
      g.style.setProperty('--p', 0);
    }));
    lastP = '';
    const cap = s.querySelector('.cg-caption');
    if (!reduced.matches) { cap.classList.remove('is-in'); void cap.offsetWidth; cap.classList.add('is-in'); }
    slides.forEach((x, i) => x.querySelectorAll('video').forEach(v => { if (i === index) { v.currentTime = 0; v.play().catch(() => {}); } else v.pause(); }));
    playStart = performance.now(); playHeld = 0;
  }

  function go(to) {
    target = to;
    setActive(mod(Math.round(target), n));
    if (reduced.matches) { pos = target; vel = 0; place(); }
    kick();
  }
  const step = d => go(Math.round(target) + d);

  function duration() {
    const v = slides[active]?.querySelector('video');
    return v && isFinite(v.duration) && v.duration > 0 ? v.duration * 1000 : PLAY;
  }

  function tick(now) {
    const dt = Math.min(.034, last ? (now - last) / 1000 : 1 / 60);
    last = now;
    if (!drag) {
      // semi-implicit Euler, two sub-steps for stability
      for (let k = 0; k < 2; k++) {
        const h = dt / 2;
        vel += (STIFF * (target - pos) - DAMP * vel) * h;
        pos += vel * h;
      }
      if (Math.abs(target - pos) < .0005 && Math.abs(vel) < .0005) { pos = target; vel = 0; }
    }
    // only re-place the cards while they actually move (or after a stop),
    // instead of rewriting every slide's style on every idle frame
    if (pos !== placedPos || vel !== placedVel) { place(); placedPos = pos; placedVel = vel; }
    // autoplay progress on the active timeline segment
    const hold = paused || hovered || drag || !visible || document.hidden || reduced.matches;
    if (hold) { if (!playHeld) playHeld = now; }
    else if (playHeld) { playStart += now - playHeld; playHeld = 0; }
    const v = slides[active]?.querySelector('video');
    let p;
    if (v && v.duration > 0 && isFinite(v.duration)) {
      // films drive the timeline themselves; when one wraps around, move on
      p = v.currentTime / v.duration;
      if (v._last != null && v.currentTime + .5 < v._last && !hold && !scrubbing) { v._last = null; step(1); }
      else v._last = v.currentTime;
      updateScrub(slides[active], v);
    } else {
      p = Math.min(1, ((playHeld || now) - playStart) / duration());
      if (p >= 1 && !hold) step(1);
    }
    const pv = p.toFixed(4);
    if (pv !== lastP) { segRows[active]?.[active]?.style.setProperty('--p', pv); lastP = pv; }
    const moving = drag || pos !== target || vel !== 0;
    // keep ticking only while something can change: the cards move, a film
    // plays, or a still case's timeline fills. Held still → sleep until
    // hover ends, the film plays or the gallery comes back into view.
    const film = v && v.duration > 0 && isFinite(v.duration);
    const filmRuns = film && !v.paused;
    const fills = !film && !hold;
    raf = (moving || (visible && (filmRuns || fills))) ? requestAnimationFrame(tick) : 0;
    if (!raf) last = 0;
  }
  function kick() { if (!raf) { last = 0; raf = requestAnimationFrame(tick); } }

  // Drag / swipe with velocity: a quick flick moves one (or two) cases.
  track.addEventListener('pointerdown', e => {
    if (e.button !== 0 || e.target.closest('.cg-arrow,.cg-seg,.cg-scrub')) return;
    drag = { x: e.clientX, y: e.clientY, pos, t: performance.now(), vx: 0, lx: e.clientX, lt: performance.now(), moved: false, id: e.pointerId };
    kick();
  });
  addEventListener('pointermove', e => {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x;
    if (!drag.moved) {
      if (Math.abs(dx) < 6) return;
      if (Math.abs(e.clientY - drag.y) > Math.abs(dx)) { drag = null; return; }
      drag.moved = true; track.classList.add('is-drag');
      try { track.setPointerCapture(e.pointerId); } catch {}
    }
    const now = performance.now();
    drag.vx = (e.clientX - drag.lx) / Math.max(1, now - drag.lt) * 1000;
    drag.lx = e.clientX; drag.lt = now;
    const before = pos;
    pos = drag.pos - dx / gap();
    vel = (pos - before) * 60;
  });
  const release = e => {
    if (!drag || (e && e.pointerId !== drag.id)) return;
    const d = drag; drag = null; track.classList.remove('is-drag');
    if (!d.moved) {
      // a tap on a side slide brings it to the centre
      // Side cards are inert (not clickable themselves), so decide by position:
      // a tap left or right of the centre card brings that neighbour in.
      const r = track.getBoundingClientRect();
      const half = slides[0].offsetWidth / 2;
      const x = (e ? e.clientX : d.x) - (r.left + r.width / 2);
      if (Math.abs(x) > half + 4) step(x > 0 ? 1 : -1);
      return;
    }
    const flick = -d.vx / gap() * .22;
    let to = Math.round(pos + Math.max(-1.4, Math.min(1.4, flick)));
    const reach = Math.abs(d.vx) > 2200 ? 2 : 1;   // a normal swipe moves one case, a hard flick two
    to = Math.max(Math.round(d.pos) - reach, Math.min(Math.round(d.pos) + reach, to));
    vel = -d.vx / gap();
    go(to);
  };
  addEventListener('pointerup', release);
  addEventListener('pointercancel', release);
  track.addEventListener('click', e => { if (track.classList.contains('is-drag')) e.preventDefault(); });

  // Trackpad: one horizontal two-finger swipe = one case. After a flip the
  // gesture is "used up" until the trackpad goes quiet, or its inertia has
  // clearly died down (below 35% of its peak) and then clearly rises again
  // (a real new swipe) — and never sooner than 380ms after the last flip.
  let wheelAcc = 0, locked = false, quiet = 0, lockedAt = 0, peak = 0, low = Infinity, decayed = false;
  track.addEventListener('wheel', e => {
    if (Math.abs(e.deltaX) <= Math.abs(e.deltaY) || e.ctrlKey) return;
    e.preventDefault();
    const dx = e.deltaMode === 1 ? e.deltaX * 16 : e.deltaX;
    const ad = Math.abs(dx), now = performance.now();
    clearTimeout(quiet);
    quiet = setTimeout(() => { wheelAcc = 0; locked = false; }, 180);
    if (locked) {
      peak = Math.max(peak, ad);
      if (ad < peak * .35) decayed = true;
      if (decayed) low = Math.min(low, ad);
      const fresh = decayed && ad > Math.max(12, low * 3) && now - lockedAt > 380;
      if (!fresh) return;
      locked = false; wheelAcc = 0;
    }
    if (wheelAcc && Math.sign(wheelAcc) !== Math.sign(dx)) wheelAcc = 0;
    wheelAcc += dx;
    if (Math.abs(wheelAcc) > 70) {
      step(wheelAcc > 0 ? 1 : -1);
      locked = true; wheelAcc = 0; lockedAt = now; peak = ad; low = Infinity; decayed = false;
    }
  }, { passive: false });

  root.addEventListener('click', e => {
    const arrow = e.target.closest('.cg-arrow');
    if (arrow) { step(Number(arrow.dataset.step)); return; }
    const seg = e.target.closest('.cg-seg');
    if (seg) {
      let d = Number(seg.dataset.go) - active; if (d > n / 2) d -= n; if (d < -n / 2) d += n;
      go(Math.round(target) + d);
    }
  });
  track.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') hovered = true; });
  // glow on the film under the pointer (class, so it works with the custom cursor everywhere)
  slides.forEach(sl => {
    sl.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') sl.classList.add('is-hover'); });
    sl.addEventListener('pointerleave', () => sl.classList.remove('is-hover'));
  });
  track.addEventListener('pointerleave', () => { hovered = false; kick(); });
  slides.forEach(sl => sl.querySelectorAll('video').forEach(v => v.addEventListener('play', kick)));
  document.addEventListener('visibilitychange', () => { if (!document.hidden) kick(); });

  document.addEventListener('keydown', e => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName)) return;
    const r = root.getBoundingClientRect();
    if (r.bottom < innerHeight * .35 || r.top > innerHeight * .65) return;
    e.preventDefault();
    step(e.key === 'ArrowRight' ? 1 : -1);
  });

  if ('IntersectionObserver' in window) new IntersectionObserver(([en]) => { visible = en.isIntersecting; if (visible) kick(); }, { threshold: .25 }).observe(root);

  // Entrance, once, when the gallery first scrolls into view: the centre film
  // rises and settles, the neighbours glide in from the sides, then its title,
  // counter and timeline arrive.
  if (!reduced.matches && 'IntersectionObserver' in window) {
    root.classList.add('is-waiting');
    const io = new IntersectionObserver(([en]) => {
      if (!en.isIntersecting) return;
      io.disconnect();
      slides.forEach((sl, i) => {
        const o = Math.round(mod(i - pos + n / 2, n) - n / 2);
        sl.style.setProperty('--edir', Math.sign(o));
        sl.style.setProperty('--edelay', `${Math.min(Math.abs(o), 2) * 110}ms`);
      });
      root.classList.remove('is-waiting');
      root.classList.add('is-entering');
      playStart = performance.now(); playHeld = 0; kick();
      setTimeout(() => root.classList.remove('is-entering'), 1700);
    }, { threshold: .3 });
    io.observe(root);
  }
  addEventListener('resize', () => { place(); placedPos = pos; placedVel = vel; });

  // Anything with data-case="<title>" (e.g. the Fliq tag on a client card)
  // jumps down to Work and brings that case to the centre.
  function open(title) {
    const i = slides.findIndex(sl => sl.dataset.title === title);
    if (i < 0) return;
    let d = i - active; if (d > n / 2) d -= n; if (d < -n / 2) d += n;
    const section = document.getElementById('work');
    const bring = () => { if (d) go(Math.round(target) + d); };
    if (window.siteScroll && section) window.siteScroll.to(section, () => setTimeout(bring, 120));
    else { section?.scrollIntoView({ behavior: reduced.matches ? 'auto' : 'smooth' }); setTimeout(bring, 700); }
  }
  window.workGallery = { open };
  document.addEventListener('click', e => {
    const link = e.target.closest('[data-case]:not(.pj-sheet)');
    if (!link || root.contains(link)) return;
    e.preventDefault();
    setTimeout(() => open(link.dataset.case), 260); // let the tag finish its little wobble
  });

  // Progressive blur on both sides of the gallery: the neighbours sink back
  // into depth, the film in the centre stays sharp.
  ['l', 'r'].forEach(side => {
    const edge = document.createElement('div');
    edge.className = `cg-edge cg-edge-${side}`;
    edge.setAttribute('aria-hidden', 'true');
    edge.innerHTML = '<i></i><i></i><i></i><i></i>';
    track.after(edge);
  });

  setActive(0);
  place();
  kick();
})();
