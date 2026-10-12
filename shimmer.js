(() => {
  const label = document.querySelector('.intro .cta-copy');
  if (!label || !CSS.supports('color', 'color-mix(in oklab, #fff 50%, #000)')) return;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const forced = matchMedia('(forced-colors: active)');
  const band = 2.2;
  const falloff = [[-1, 0], [-.5, .5], [-.2, .9], [0, 1], [.2, .9], [.5, .5], [1, 0]];
  const duration = 2200;
  const pause = 3000;
  let inView = false;
  let phase = -120;
  let frame = 0;
  let previous = 0;

  function paint(t) {
    const position = offset => `calc(${(t * 100).toFixed(2)}% + ${((2 * t - 1 + offset) * band).toFixed(3)}em)`;
    const stops = falloff.map(([offset, strength]) => `color-mix(in oklab, var(--ts-highlight) ${strength * 48}%, var(--ts-base)) ${position(offset)}`);
    const glow = falloff.map(([offset, strength]) => `rgb(163 220 255 / ${strength}) ${position(offset)}`);
    label.style.backgroundImage = `linear-gradient(90deg, var(--ts-base), ${stops.join(',')}, var(--ts-base))`;
    label.style.setProperty('--shimmer-glow', `linear-gradient(90deg, transparent, ${glow.join(',')}, transparent)`);
  }
  function tick(now) {
    const dt = previous ? Math.min(64, now - previous) : 0;
    previous = now;
    phase += dt;
    if (phase > duration) phase -= duration + pause;
    paint(Math.max(0, phase / duration));
    frame = requestAnimationFrame(tick);
  }
  function update() {
    const allowed = !reduced.matches && !forced.matches && inView && !document.hidden;
    label.dataset.shimmer = allowed ? 'running' : 'paused';
    if (allowed && !frame) frame = requestAnimationFrame(tick);
    else if (!allowed) {
      cancelAnimationFrame(frame);
      frame = previous = 0;
      if (reduced.matches || forced.matches) {
        label.style.removeProperty('background-image');
        label.style.removeProperty('--shimmer-glow');
      }
    }
  }
  new IntersectionObserver(entries => {
    inView = entries[0].isIntersecting;
    update();
  }, { rootMargin: '64px' }).observe(label);
  document.addEventListener('visibilitychange', update);
  reduced.addEventListener('change', update);
  forced.addEventListener('change', update);
  window.addEventListener('pagehide', () => { cancelAnimationFrame(frame); frame = previous = 0; });
  window.addEventListener('pageshow', update);
})();
