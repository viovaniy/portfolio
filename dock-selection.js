// One spring-driven selection surface, shared by all navigation items.
(() => {
  const dock = document.querySelector('.bottom-nav');
  if (!dock) return;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let x = 0, destination = 0, velocity = 0, frame = 0, last = 0;
  let initialized = false;
  function paint() {
    dock.style.setProperty('--selection-x', `${x}px`);
    dock.style.setProperty('--selection-stretch', String(1 + Math.min(Math.abs(velocity) / 2200, .24)));
  }
  function tick(time) {
    const dt = Math.min((time - last) / 1000 || 1 / 60, .032);
    last = time;
    const steps = Math.ceil(dt / .008), step = dt / steps;
    for (let i = 0; i < steps; i++) {
      velocity += ((destination - x) * 260 - velocity * 30) * step;
      x += velocity * step;
    }
    const moving = Math.abs(destination - x) > .02 || Math.abs(velocity) > .05;
    if (!moving) { x = destination; velocity = 0; }
    paint();
    frame = moving ? requestAnimationFrame(tick) : 0;
  }
  function update() {
    const link = dock.querySelector('a[aria-current="location"]');
    if (!link) return;
    destination = link.offsetLeft;
    dock.style.setProperty('--selection-y', `${link.offsetTop}px`);
    dock.style.setProperty('--selection-size', `${link.offsetWidth}px`);
    if (!initialized || reduced.matches || document.hidden) {
      cancelAnimationFrame(frame);
      frame = 0; x = destination; velocity = 0; paint();
    } else if (!frame) {
      last = performance.now(); frame = requestAnimationFrame(tick);
    }
    initialized = true;
    dock.classList.add('has-liquid-selection');
  }
  new MutationObserver(update).observe(dock, {subtree:true, attributes:true, attributeFilter:['aria-current']});
  new ResizeObserver(update).observe(dock);
  reduced.addEventListener('change', update);
  document.addEventListener('visibilitychange', update);
  update();
})();
