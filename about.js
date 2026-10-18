// About: staggered reveal, a playable/scrubbable "how I work" timeline,
// and a macOS-style magnifying tool dock. Animates transforms/opacity only.
(() => {
  const section = document.querySelector('.about-section');
  if (!section) return;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)');

  // Full-bleed canvas width without horizontal overflow from scrollbars.
  const sizeCanvas = () => section.style.setProperty('--about-viewport', `${document.documentElement.clientWidth}px`);
  sizeCanvas();
  addEventListener('resize', sizeCanvas, { passive: true });

  // Entrance reveal (content stays visible without JS).
  const revealItems = [...section.querySelectorAll('.about-reveal')];
  revealItems.forEach((el, i) => el.style.setProperty('--i', i));
  if ('IntersectionObserver' in window && !reduced.matches) {
    section.setAttribute('data-reveal', '');
    new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) section.classList.add('is-revealed');
    }, { threshold: .18 }).observe(section);
  } else section.classList.add('is-revealed');

  /* ---------- Timeline ---------- */
  const figure = section.querySelector('.about-timeline');
  const area = section.querySelector('.tl-area');
  const playhead = section.querySelector('.tl-playhead');
  const timeLabel = section.querySelector('.tl-time');
  const playButton = section.querySelector('.tl-play');
  const stepNum = section.querySelector('.tl-step-num');
  const stepCopy = section.querySelector('.tl-step-copy');
  const stepTitle = section.querySelector('.tl-step-title');
  const stepText = section.querySelector('.tl-step-text');
  const markers = [...section.querySelectorAll('.tl-marker')];
  const steps = [
    ['Find the point.', 'What should someone understand or feel after watching?'],
    ['Find the direction.', 'Build the visual language and rhythm around that idea.'],
    ['Make the details count.', 'Refine the timing, transitions, and those last few frames.']
  ].map(([title, text], i) => ({ title, text, at: parseFloat(markers[i].style.getPropertyValue('--at')) / 100 }));
  const clips = [...section.querySelectorAll('.tl-clip')].map(el => {
    const from = parseFloat(el.style.getPropertyValue('--from')) / 100;
    const to = parseFloat(el.style.getPropertyValue('--to')) / 100;
    const keys = [...el.querySelectorAll('i')].map(k => ({ el: k, at: from + parseFloat(k.style.getPropertyValue('--k')) * (to - from), hit: false }));
    return { el, from, to, keys, live: false };
  });

  const DURATION = 13000;  // one pass, ms
  const HOLD = 1400;       // pause at the end before looping
  let t = reduced.matches ? steps[0].at + .02 : 0;
  let width = area.clientWidth;
  let step = -1;
  let userPaused = reduced.matches;
  let dragging = false;
  let holdUntil = 0;
  let resumeAt = 0;
  let tween = null;
  let frame = 0;
  let last = 0;
  let timelineVisible = false;
  let captionAnim;

  const clamp01 = v => Math.min(1, Math.max(0, v));
  const pad = n => String(n).padStart(2, '0');

  function setStep(index) {
    if (index === step) return;
    const first = step === -1;
    step = index;
    const s = steps[index];
    stepNum.textContent = pad(index + 1);
    stepTitle.textContent = s.title;
    stepText.textContent = s.text;
    playhead.setAttribute('aria-valuetext', `Step ${index + 1} of 3: ${s.title}`);
    if (!first && !reduced.matches) {
      captionAnim?.cancel();
      captionAnim = stepCopy.animate([
        { opacity: 0, transform: 'translateY(10px)' },
        { opacity: 1, transform: 'translateY(0)' }
      ], { duration: 520, easing: 'cubic-bezier(.16,1,.3,1)' });
      stepNum.animate([{ transform: 'scale(.8)' }, { transform: 'scale(1)' }], { duration: 420, easing: 'cubic-bezier(.34,1.56,.64,1)' });
    }
  }

  function render() {
    playhead.style.transform = `translateX(${t * width}px)`;
    const seconds = t * DURATION / 1000;
    timeLabel.textContent = `00:${pad(Math.floor(seconds))}:${pad(Math.floor((seconds % 1) * 24))}`;
    playhead.setAttribute('aria-valuenow', String(Math.round(t * 100)));
    let index = 0;
    steps.forEach((s, i) => { if (t >= s.at) index = i; });
    setStep(index);
    markers.forEach((m, i) => m.classList.toggle('is-reached', t >= steps[i].at));
    for (const clip of clips) {
      const live = t >= clip.from && t <= clip.to;
      if (live !== clip.live) { clip.live = live; clip.el.classList.toggle('is-live', live); }
      for (const key of clip.keys) {
        const hit = Math.abs(t - key.at) < .014;
        if (hit !== key.hit) { key.hit = hit; key.el.classList.toggle('is-hit', hit); }
      }
    }
  }

  const playing = () => !userPaused && !dragging && !tween && timelineVisible && !document.hidden;

  function tick(now) {
    frame = 0;
    const dt = last ? Math.min(now - last, 64) : 0;
    last = now;
    if (tween) {
      const p = clamp01((now - tween.start) / tween.duration);
      const eased = 1 - Math.pow(1 - p, 4);
      t = tween.from + (tween.to - tween.from) * eased;
      if (p >= 1) { tween = null; resumeAt = now + 2600; }
      render();
    } else if (playing() && now >= resumeAt) {
      if (holdUntil) {
        if (now >= holdUntil) { holdUntil = 0; t = 0; render(); }
      } else {
        t += dt / DURATION;
        if (t >= 1) { t = 1; holdUntil = now + HOLD; }
        render();
      }
    }
    if (tween || playing()) schedule();
  }
  function schedule() {
    if (!frame) { frame = requestAnimationFrame(tick); }
  }
  function wake() { last = 0; schedule(); }

  function seekTo(target, animate = true) {
    holdUntil = 0;
    target = clamp01(target);
    if (!animate || reduced.matches) { tween = null; t = target; render(); resumeAt = performance.now() + 2600; wake(); return; }
    tween = { from: t, to: target, start: performance.now(), duration: 700 };
    wake();
  }

  function setPaused(value) {
    userPaused = value;
    figure.classList.toggle('is-paused', value);
    playButton.setAttribute('aria-pressed', String(value));
    playButton.setAttribute('aria-label', value ? 'Play the timeline' : 'Pause the timeline');
    if (!value && t >= 1) t = 0;
    wake();
  }
  playButton.addEventListener('click', () => setPaused(!userPaused));

  // Scrubbing: drag anywhere on the tracks or the playhead.
  const fromPointer = event => {
    const rect = area.getBoundingClientRect();
    return clamp01((event.clientX - rect.left) / rect.width);
  };
  let lastPointer = 'mouse';
  area.addEventListener('pointerdown', event => {
    lastPointer = event.pointerType;
    if (event.button !== 0 || event.target.closest('.tl-marker')) return;
    const onHandle = event.target.closest('.tl-playhead');
    // On touch, only the handle starts a scrub so vertical page scroll still works on the tracks.
    if (event.pointerType !== 'mouse' && !onHandle) return;
    dragging = true;
    tween = null;
    holdUntil = 0;
    figure.classList.add('is-dragging');
    area.setPointerCapture(event.pointerId);
    t = fromPointer(event);
    render();
    event.preventDefault();
  });
  area.addEventListener('pointermove', event => {
    if (!dragging) return;
    t = fromPointer(event);
    render();
  });
  const endDrag = () => {
    if (!dragging) return;
    dragging = false;
    figure.classList.remove('is-dragging');
    resumeAt = performance.now() + 2600;
    wake();
  };
  area.addEventListener('pointerup', endDrag);
  area.addEventListener('pointercancel', endDrag);
  area.addEventListener('lostpointercapture', endDrag);

  markers.forEach((marker, i) => marker.addEventListener('click', () => seekTo(steps[i].at + .015)));
  // Tap a clip on touch to jump to its start.
  clips.forEach(clip => clip.el.addEventListener('click', () => { if (lastPointer !== 'mouse') seekTo(clip.from + .01); }));

  playhead.addEventListener('keydown', event => {
    const keys = { ArrowRight: .02, ArrowUp: .02, ArrowLeft: -.02, ArrowDown: -.02 };
    if (event.key in keys) { event.preventDefault(); seekTo(t + keys[event.key], false); return; }
    if (event.key === 'Home') { event.preventDefault(); seekTo(0, false); }
    if (event.key === 'End') { event.preventDefault(); seekTo(1, false); }
    if (event.key === 'PageDown' || event.key === 'PageUp') {
      event.preventDefault();
      const next = Math.min(2, Math.max(0, step + (event.key === 'PageDown' ? 1 : -1)));
      seekTo(steps[next].at + .015);
    }
  });

  new ResizeObserver(() => { width = area.clientWidth; render(); }).observe(area);
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([entry]) => { timelineVisible = entry.isIntersecting; wake(); }, { threshold: .25 }).observe(figure);
  } else timelineVisible = true;
  document.addEventListener('visibilitychange', wake);
  reduced.addEventListener('change', () => { if (reduced.matches) setPaused(true); });
  if (reduced.matches) setPaused(true);
  render();

  /* ---------- Tool dock magnification ---------- */
  const dock = section.querySelector('.about-dock');
  const tools = [...dock.querySelectorAll('.about-tool')];
  let dockFrame = 0;
  let pointerX = 0;
  function magnify() {
    dockFrame = 0;
    for (const tool of tools) {
      const rect = tool.getBoundingClientRect();
      const distance = Math.abs(pointerX - (rect.left + rect.width / 2));
      const mag = 1 + .26 * Math.max(0, 1 - distance / 120) ** 1.6;
      tool.style.setProperty('--mag', mag.toFixed(3));
    }
  }
  dock.addEventListener('pointermove', event => {
    if (!finePointer.matches || reduced.matches || event.pointerType !== 'mouse') return;
    pointerX = event.clientX;
    dock.classList.add('is-tracking');
    if (!dockFrame) dockFrame = requestAnimationFrame(magnify);
  });
  dock.addEventListener('pointerleave', () => {
    cancelAnimationFrame(dockFrame);
    dockFrame = 0;
    dock.classList.remove('is-tracking');
    tools.forEach(tool => tool.style.setProperty('--mag', '1'));
  });
})();
