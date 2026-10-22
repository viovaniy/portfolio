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
    // films get a "Watch film" pill under the description
    if (s.querySelector('video')) {
      const watch = document.createElement('button');
      watch.type = 'button'; watch.className = 'cg-watch';
      watch.setAttribute('data-pointer-shape', 'pill');
      watch.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l11-6.5z"/></svg><span>${tr0('Watch film')}</span>`;
      watch.addEventListener('click', e => { e.stopPropagation(); openPlayer(s); });
      hud.querySelector('.cg-caption').append(watch);
    }
    s.querySelector('.cg-frame').append(hud);
  });

  // ---------- full-screen film player ----------
  // A white-framed Apple-style player over a frosted backdrop. It grows out of
  // the card you tapped (FLIP: one transform on one element), takes over the
  // film at the same second, and hands it back to the card when it closes.
  let fp = null, fpFrom = null, fpBusy = null, fpFocus = null, fpOpenedAt = 0, fpSoundOn = true;
  const fmt = t => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
  function buildPlayer() {
    const el = document.createElement('div');
    el.className = 'fp'; el.hidden = true; el.tabIndex = -1;
    el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true');
    el.innerHTML = `
      <div class="fp-backdrop" data-close></div>
      <div class="fp-card">
        <div class="fp-screen"><video playsinline muted loop preload="auto"></video></div>
        <div class="fp-bar">
          <button type="button" class="fp-btn fp-toggle" data-pointer-shape="circle">
            <svg class="i-pause" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5h2.6v13H8zM13.4 5.5H16v13h-2.6z"/></svg>
            <svg class="i-play" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l11-6.5z"/></svg>
          </button>
          <span class="fp-time">0:00</span>
          <div class="fp-rail" role="slider" tabindex="0" aria-valuemin="0" data-pointer-passive><span class="fp-track"><i class="fp-fill"></i><b class="fp-knob"></b></span></div>
          <span class="fp-left">-0:00</span>
          <button type="button" class="fp-btn fp-sound" data-pointer-shape="circle">
            <svg class="i-on" viewBox="0 0 24 24" aria-hidden="true"><path class="f" d="M4.5 9.5h3l4-3.5v12l-4-3.5h-3z"/><path d="M15 9.2a4 4 0 0 1 0 5.6M17.6 6.8a7.4 7.4 0 0 1 0 10.4"/></svg>
            <svg class="i-off" viewBox="0 0 24 24" aria-hidden="true"><path class="f" d="M4.5 9.5h3l4-3.5v12l-4-3.5h-3z"/><path d="M15.5 9.5l5 5M20.5 9.5l-5 5"/></svg>
          </button>
          <button type="button" class="fp-btn fp-full" data-pointer-shape="circle"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4.5 9V4.5H9M15 4.5h4.5V9M19.5 15v4.5H15M9 19.5H4.5V15"/></svg></button>
        </div>
      </div>
      <button type="button" class="fp-close" data-close data-pointer-shape="circle"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/></svg></button>`;
    document.body.append(el);
    const v = el.querySelector('video'), card = el.querySelector('.fp-card');
    const toggle = el.querySelector('.fp-toggle'), rail = el.querySelector('.fp-rail');
    const time = el.querySelector('.fp-time'), left = el.querySelector('.fp-left');
    el.querySelector('.fp-close').setAttribute('aria-label', tr0('Close'));
    el.querySelector('.fp-full').setAttribute('aria-label', tr0('Full screen'));
    rail.setAttribute('aria-label', tr0('Rewind'));
    let raf = 0, lastK = '', lastT = '';
    const paint = () => {
      const d = v.duration > 0 ? v.duration : 0, t = v.currentTime || 0;
      const k = d ? (t / d).toFixed(4) : '0';
      if (k !== lastK) { rail.style.setProperty('--k', k); lastK = k; }
      const tt = fmt(t);
      if (tt !== lastT) {
        lastT = tt; time.textContent = tt; left.textContent = '-' + fmt(Math.max(0, d - t));
        rail.setAttribute('aria-valuenow', Math.round(t)); rail.setAttribute('aria-valuemax', Math.round(d)); rail.setAttribute('aria-valuetext', tt);
      }
    };
    const loop = () => { paint(); raf = v.paused || el.hidden ? 0 : requestAnimationFrame(loop); };
    const setPaused = p => { el.classList.toggle('is-paused', p); toggle.setAttribute('aria-label', tr0(p ? 'Play' : 'Pause')); };
    v.addEventListener('play', () => { setPaused(false); if (!raf) raf = requestAnimationFrame(loop); });
    v.addEventListener('pause', () => { setPaused(true); paint(); });
    v.addEventListener('seeked', paint);
    v.addEventListener('loadedmetadata', paint);
    const flip = () => { if (v.paused) v.play().catch(() => {}); else v.pause(); };
    // sound: on by default in the player (it opens from a tap, so browsers allow it)
    const sound = el.querySelector('.fp-sound');
    const setSound = on => {
      v.muted = !on; fpSoundOn = on;
      el.classList.toggle('is-muted', !on);
      sound.setAttribute('aria-label', tr0(on ? 'Mute' : 'Unmute'));
    };
    sound.addEventListener('click', () => setSound(v.muted));
    el._setSound = setSound;
    toggle.addEventListener('click', flip);
    // ignore the tap that opened the player (on touch its click lands here)
    el.querySelector('.fp-screen').addEventListener('click', () => { if (performance.now() - fpOpenedAt > 450) flip(); });
    el.querySelector('.fp-full').addEventListener('click', () => {
      const scr = el.querySelector('.fp-screen');
      if (document.fullscreenElement) document.exitFullscreen?.();
      else if (scr.requestFullscreen) scr.requestFullscreen().catch(() => v.webkitEnterFullscreen?.());
      else v.webkitEnterFullscreen?.();
    });
    el.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', closePlayer));
    // seek: tap or drag anywhere on the rail
    const seekAt = x => { const r = rail.querySelector('.fp-track').getBoundingClientRect(); if (v.duration > 0) { v.currentTime = Math.min(1, Math.max(0, (x - r.left) / r.width)) * v.duration; paint(); } };
    let grab = null;
    rail.addEventListener('pointerdown', e => { grab = e.pointerId; rail.classList.add('is-grab'); try { rail.setPointerCapture(e.pointerId); } catch {} seekAt(e.clientX); });
    rail.addEventListener('pointermove', e => { if (grab === e.pointerId) seekAt(e.clientX); });
    const drop = () => { grab = null; rail.classList.remove('is-grab'); };
    rail.addEventListener('pointerup', drop); rail.addEventListener('pointercancel', drop);
    el.addEventListener('keydown', e => {
      if (e.key === 'Escape') { e.preventDefault(); closePlayer(); }
      else if (e.key === ' ' && !e.target.closest('button')) { e.preventDefault(); flip(); }
      else if ((e.key === 'ArrowRight' || e.key === 'ArrowLeft') && v.duration > 0) { e.preventDefault(); v.currentTime = Math.min(v.duration, Math.max(0, v.currentTime + (e.key === 'ArrowRight' ? 5 : -5))); }
      else if (e.key === 'Tab') {   // keep focus inside the dialog
        const f = [...el.querySelectorAll('button,[tabindex="0"]')].filter(n => n.offsetParent);
        const i = f.indexOf(document.activeElement);
        if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); }
        else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
      }
    });
    el.addEventListener('wheel', e => e.preventDefault(), { passive: false });
    el.addEventListener('touchmove', e => { if (!e.target.closest('.fp-rail')) e.preventDefault(); }, { passive: false });
    return { el, v, card, paint };
  }
  // the transform that puts the player's screen exactly over a source rect
  // (the card scales about its own centre, so solve for the translate that
  // lands the screen's centre on the source's centre)
  const fpOffset = (src, scr) => {
    const c = fp.card.getBoundingClientRect();
    const k = src.width / scr.width;
    const cx = c.left + c.width / 2, cy = c.top + c.height / 2;
    const sx = scr.left + scr.width / 2, sy = scr.top + scr.height / 2;
    const tx = (src.left + src.width / 2) - cx - k * (sx - cx);
    const ty = (src.top + src.height / 2) - cy - k * (sy - cy);
    return `translate(${tx.toFixed(1)}px,${ty.toFixed(1)}px) scale(${k.toFixed(4)})`;
  };
  const FP_EASE = 'cubic-bezier(.32,.72,0,1)';
  // The dock steps aside while the player is open and floats back up after.
  // (translate/scale are separate from the dock's own centring transform)
  let dockAnim = null;
  function dock(show) {
    const nav = document.querySelector('.bottom-nav');
    if (!nav) return;
    const from = dockAnim ? getComputedStyle(nav) : null;
    const now = from ? { opacity: from.opacity, translate: from.translate === 'none' ? '0 0' : from.translate, scale: from.scale === 'none' ? '1' : from.scale } : null;
    dockAnim?.cancel();
    if (reduced.matches) { dockAnim = show ? null : nav.animate([{ opacity: 0 }], { duration: 0, fill: 'forwards' }); return; }
    dockAnim = show
      ? nav.animate([now || { opacity: 0, translate: '0 26px', scale: .9 }, { opacity: 1, translate: '0 0', scale: 1 }],
          { duration: 700, delay: now ? 0 : 140, easing: 'cubic-bezier(.34,1.45,.5,1)', fill: 'backwards' })
      : nav.animate([now || { opacity: 1, translate: '0 0', scale: 1 }, { opacity: 0, translate: '0 22px', scale: .94 }],
          { duration: 280, easing: 'cubic-bezier(.4,0,1,1)', fill: 'forwards' });
    if (show) dockAnim.finished.then(() => { dockAnim = null; }).catch(() => {});
  }
  // build the (hidden) player ahead of time so the first tap opens instantly
  (window.requestIdleCallback || (f => setTimeout(f, 1500)))(() => { if (!fp && slides.some(x => x.querySelector('video'))) fp = buildPlayer(); });
  function openPlayer(s) {
    if (fpBusy) return;
    const src = s.querySelector('video');
    if (!src) return;
    fp = fp || buildPlayer();
    const { el, v, card } = fp;
    fpFrom = s; fpFocus = document.activeElement; fpOpenedAt = performance.now();
    el.setAttribute('aria-label', tr0(s.dataset.title) + ' — ' + tr0(s.dataset.kind || 'Film'));
    if (v.getAttribute('src') !== src.getAttribute('src')) { v.src = src.currentSrc || src.src; v.poster = src.poster; }
    const t = src.currentTime || 0;
    const start = () => { try { v.currentTime = t; } catch {} };
    v.readyState ? start() : v.addEventListener('loadedmetadata', start, { once: true });
    src.pause(); src.dataset.userPaused = '1';
    const sw = innerWidth - document.documentElement.clientWidth;
    document.documentElement.classList.add('fp-lock');
    dock(false);
    document.documentElement.style.setProperty('--fp-sw', sw + 'px');
    el.hidden = false;
    // try with sound; if the browser still says no, play silently with the
    // sound button showing "off" so one tap brings the music in
    el._setSound(fpSoundOn);
    v.play().catch(() => { el._setSound(false); v.play().catch(() => {}); });
    fp.paint();
    const scr = el.querySelector('.fp-screen').getBoundingClientRect();
    const from = s.querySelector('.cg-media').getBoundingClientRect();
    el.focus({ preventScroll: true });   // the dialog itself: no focus ring flashes on a button
    if (reduced.matches) { el.classList.add('is-open'); return; }
    el.classList.add('is-open');
    fpBusy = card.animate([{ transform: fpOffset(from, scr), borderRadius: '34px' }, { transform: 'none' }], { duration: 560, easing: FP_EASE });
    fpBusy.finished.catch(() => {}).finally(() => { fpBusy = null; });
  }
  function closePlayer() {
    if (!fp || fp.el.hidden || fpBusy) return;
    const { el, v, card } = fp;
    const s = fpFrom, src = s?.querySelector('video');
    const done = () => {
      el.hidden = true; el.classList.remove('is-open', 'is-closing');
      document.documentElement.classList.remove('fp-lock');
      v.pause(); v.muted = true;
      // hand the film back at the same second (and tell the timeline it's a
      // jump, not a loop — otherwise it would move on to the next case)
      if (src) { try { src.currentTime = v.currentTime; src._last = v.currentTime; } catch {} delete src.dataset.userPaused; if (s.classList.contains('is-active')) src.play().catch(() => {}); }
      fpBusy = null;
      fpFocus?.focus?.({ preventScroll: true });
    };
    if (reduced.matches) { done(); dock(true); return; }
    el.classList.add('is-closing');
    dock(true);
    const media = s?.querySelector('.cg-media');
    const to = media?.getBoundingClientRect();
    const scr = el.querySelector('.fp-screen').getBoundingClientRect();
    const visible = to && to.bottom > 0 && to.top < innerHeight && s.classList.contains('is-active');
    fpBusy = card.animate(visible
      ? [{ transform: 'none' }, { transform: fpOffset(to, scr), borderRadius: '34px' }]
      : [{ transform: 'none', opacity: 1 }, { transform: 'scale(.94)', opacity: 0 }],
      { duration: visible ? 460 : 300, easing: FP_EASE, fill: 'forwards' });
    fpBusy.finished.catch(() => {}).finally(() => { fpBusy?.cancel(); done(); });
  }

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
      updateScrub(s, v);
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
  // Touch screens have no hover: the seek bar opens on a tap and closes itself
  // a few seconds after the last touch (or on a tap anywhere else).
  const touchUI = matchMedia('(hover: none)');
  let scrubTimer = 0, openSlide = null;
  function closeScrub() {
    clearTimeout(scrubTimer);
    openSlide?.querySelector('.cg-scrub')?.classList.remove('is-open');
    openSlide = null;
  }
  function openScrub(sl) {
    if (openSlide && openSlide !== sl) closeScrub();
    const sc = sl.querySelector('.cg-scrub');
    if (!sc) return;
    const v = sl.querySelector('video');
    if (v) updateScrub(sl, v);
    sc.classList.add('is-open'); openSlide = sl;
    clearTimeout(scrubTimer);
    scrubTimer = setTimeout(() => { if (!sc.classList.contains('is-grab')) closeScrub(); else openScrub(sl); }, 3200);
  }
  document.addEventListener('pointerdown', e => {
    if (!openSlide) return;
    const sc = openSlide.querySelector('.cg-scrub');
    if (sc && sc.contains(e.target)) openScrub(openSlide);   // keep it open while rewinding
    else closeScrub();
  }, { capture: true, passive: true });
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

  // Per-slide cache: only write a style when its value really changes. The dim
  // goes straight onto the small .cg-dim layer (not as an inherited custom
  // property on the whole card), so a moving card no longer restyles every
  // element of its HUD on each frame — that was the swipe lag on phones.
  let gapW = 0;
  const cache = slides.map(s => ({ dim: s.querySelector('.cg-dim') }));
  const put = (c, el, key, prop, v) => { if (c[key] !== v) { c[key] = v; el.style[prop] = v; } };
  function place() {
    const g = gapW || (gapW = gap());
    const stretch = reduced.matches ? 0 : Math.min(.07, Math.abs(vel) * .028);
    // stacking order only matters relative to the neighbours, so rank the cards
    // by distance instead of writing a new z-index on every frame (each change
    // made the browser rebuild its layer tree while a card was moving)
    const dist = slides.map((_, i) => Math.abs(mod(i - pos + n / 2, n) - n / 2));
    const rank = dist.map((d, i) => dist.filter((e, j) => e < d || (e === d && j < i)).length);
    slides.forEach((s, i) => {
      const c = cache[i];
      let o = mod(i - pos + n / 2, n) - n / 2;          // offset from centre, wrapped for an endless loop
      const a = Math.abs(o);
      const hide = a > 2.4;
      put(c, s, 'vis', 'visibility', hide ? 'hidden' : '');
      const inert = Math.round(o) !== 0;
      if (c.inert !== inert) { c.inert = inert; s.inert = inert; }
      if (hide && c.parked) return;                     // far away and hidden: nothing visible to update
      c.parked = hide;
      const x = Math.sign(o) * (Math.min(a, 1) * g + Math.max(a - 1, 0) * g * .8);
      const sc = 1 - Math.min(a, 1.6) * .14;
      const near = Math.max(0, 1 - a);                  // 1 at the centre
      const sx = sc * (1 + stretch * near), sy = sc * (1 - stretch * .55 * near);
      put(c, s, 'tf', 'transform', `translate3d(${x.toFixed(2)}px,0,0) scale(${sx.toFixed(4)},${sy.toFixed(4)})`);
      put(c, s, 'op', 'opacity', a > 2.2 ? '0' : String(+Math.min(1, 1.2 - a * .3).toFixed(3)));
      const dim = String(+(Math.min(a, 1) * .35).toFixed(3));
      if (c.d !== dim) { c.d = dim; (c.dim || s).style.setProperty('--dim', dim); }
      put(c, s, 'z', 'zIndex', String(100 - rank[i]));
    });
  }

  function setActive(index) {
    if (index === active) return;
    if (openSlide) closeScrub();
    const prev = active;
    active = index;
    const s = slides[index];
    slides.forEach((x, i) => { x.classList.toggle('is-active', i === index); x.setAttribute('aria-hidden', String(i !== index)); });
    // only the incoming and outgoing cards show their timeline; the hidden ones
    // jump straight to the new state instead of animating segments nobody sees
    const quiet = segRows.map((row, k) => k !== index && k !== prev && row[0]?.parentElement);
    quiet.forEach(t => t && t.classList.add('no-trans'));
    requestAnimationFrame(() => requestAnimationFrame(() => quiet.forEach(t => t && t.classList.remove('no-trans'))));
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
      // the seek bar is hidden most of the time — refresh it only while it shows
      const sc = slides[active].querySelector('.cg-scrub');
      if (sc && (sc.matches('.is-open,.is-grab,:focus-visible,:hover') || sc.parentElement.matches(':hover'))) updateScrub(slides[active], v);
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
    if (e.button !== 0 || e.target.closest('.cg-arrow,.cg-seg,.cg-scrub,.cg-watch')) return;
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
      // a tap on the film in the centre opens it in the full-screen player
      else if (slides[active]?.querySelector('video') && !e?.target?.closest?.('a,button,.cg-scrub')) openPlayer(slides[active]);
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
    // touch: tapping the segment that is playing opens the seek bar for this film
    if (seg && touchUI.matches && seg.classList.contains('is-active')) {
      const sl = seg.closest('.cg-slide');
      if (sl?.classList.contains('has-film')) { openScrub(sl); return; }
    }
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
  addEventListener('resize', () => { gapW = 0; cache.forEach(c => { c.parked = false; }); place(); placedPos = pos; placedVel = vel; });

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
  // A file in the About folder with data-film="<title>" swipes Work to that film.
  document.addEventListener('click', e => {
    const file = e.target.closest('[data-film]');
    if (!file || root.contains(file)) return;
    e.preventDefault();
    open(file.dataset.film);
  });
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
