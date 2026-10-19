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
  const segs = [...root.querySelectorAll('.cg-seg')];
  const caption = root.querySelector('.cg-caption');
  const count = root.querySelector('.cg-count b');
  const n = slides.length;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const tr = s => (window.t ? window.t(s) : s);
  const STIFF = 190, DAMP = 17;           // spring: ~0.62 damping ratio → a soft bounce
  const PLAY = 6500;                      // ms per case when it has no video
  let pos = 0, target = 0, vel = 0, active = -1;
  let raf = 0, last = 0;
  let playStart = performance.now(), playHeld = 0, paused = false, visible = true, hovered = false, drag = null;

  const mod = (a, b) => ((a % b) + b) % b;
  const gap = () => parseFloat(getComputedStyle(root).getPropertyValue('--gap')) || track.clientWidth * .5;
  const pad = x => String(x).padStart(2, '0');
  root.querySelector('.cg-count span').textContent = `/ ${pad(n)}`;

  function place() {
    const g = gap();
    const stretch = reduced.matches ? 0 : Math.min(.07, Math.abs(vel) * .028);
    slides.forEach((s, i) => {
      let o = mod(i - pos + n / 2, n) - n / 2;          // offset from centre, wrapped for an endless loop
      const a = Math.abs(o);
      const x = Math.sign(o) * (Math.min(a, 1) * g + Math.max(a - 1, 0) * g * .42);
      const sc = 1 - Math.min(a, 1.6) * .26;
      const near = Math.max(0, 1 - a);                  // 1 at the centre
      const sx = sc * (1 + stretch * near), sy = sc * (1 - stretch * .55 * near);
      s.style.transform = `translate3d(${x}px,0,0) scale(${sx},${sy})`;
      s.style.opacity = a > 2.2 ? 0 : String(Math.min(1, 1.15 - a * .35));
      s.style.setProperty('--dim', Math.min(a, 1) * .5);
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
    ['--a', '--b', '--c'].forEach(v => root.style.setProperty(v, s.style.getPropertyValue(v)));
    caption.querySelector('.cg-kind').textContent = tr(s.dataset.kind);
    caption.querySelector('.cg-title').textContent = tr(s.dataset.title);
    caption.querySelector('.cg-desc').textContent = tr(s.dataset.desc);
    if (!reduced.matches) { caption.classList.remove('is-in'); void caption.offsetWidth; caption.classList.add('is-in'); }
    count.textContent = pad(index + 1);
    segs.forEach((g, i) => {
      g.classList.toggle('is-active', i === index);
      g.classList.toggle('is-done', i < index);
      g.setAttribute('aria-current', i === index ? 'true' : 'false');
      g.style.setProperty('--p', 0);
    });
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
    place();
    // autoplay progress on the active timeline segment
    const hold = paused || hovered || drag || !visible || document.hidden || reduced.matches;
    if (hold) { if (!playHeld) playHeld = now; }
    else if (playHeld) { playStart += now - playHeld; playHeld = 0; }
    const p = Math.min(1, ((playHeld || now) - playStart) / duration());
    segs[active]?.style.setProperty('--p', p.toFixed(4));
    if (p >= 1 && !hold) step(1);
    const moving = drag || pos !== target || vel !== 0;
    raf = (moving || visible) ? requestAnimationFrame(tick) : 0;
    if (!raf) last = 0;
  }
  function kick() { if (!raf) { last = 0; raf = requestAnimationFrame(tick); } }

  // Drag / swipe with velocity: a quick flick moves one (or two) cases.
  track.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
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
      const s = e?.target.closest?.('.cg-slide');
      if (s) { const i = slides.indexOf(s); const o = mod(i - pos + n / 2, n) - n / 2; if (Math.abs(o) > .5) go(Math.round(target + o)); }
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

  root.querySelectorAll('.cg-arrow').forEach(b => b.addEventListener('click', () => step(Number(b.dataset.step))));
  segs.forEach((g, i) => g.addEventListener('click', () => {
    let d = i - active; if (d > n / 2) d -= n; if (d < -n / 2) d += n;
    go(Math.round(target) + d);
  }));
  track.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') hovered = true; });
  track.addEventListener('pointerleave', () => { hovered = false; });

  document.addEventListener('keydown', e => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName)) return;
    const r = root.getBoundingClientRect();
    if (r.bottom < innerHeight * .35 || r.top > innerHeight * .65) return;
    e.preventDefault();
    step(e.key === 'ArrowRight' ? 1 : -1);
  });

  if ('IntersectionObserver' in window) new IntersectionObserver(([en]) => { visible = en.isIntersecting; if (visible) kick(); }, { threshold: .25 }).observe(root);
  addEventListener('resize', () => { place(); });

  setActive(0);
  place();
  kick();
})();
