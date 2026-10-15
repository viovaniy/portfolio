// Two independently sprung edges let the selection pour into its next target.
(() => {
  const dock = document.querySelector('.bottom-nav');
  if (!dock) return;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const edges = { left: { value: 0, velocity: 0 }, right: { value: 0, velocity: 0 } };
  let destination = 0, size = 54, direction = 1, holdUntil = 0;
  let frame = 0, last = 0, initialized = false;
  function paint() {
    dock.style.setProperty('--selection-x', `${edges.left.value}px`);
    dock.style.setProperty('--selection-width', `${Math.max(size, edges.right.value - edges.left.value)}px`);
  }
  function snap() {
    cancelAnimationFrame(frame); frame = 0;
    edges.left.value = destination; edges.right.value = destination + size;
    edges.left.velocity = edges.right.velocity = 0;
    paint();
  }
  function tick(time) {
    const dt = Math.min((time - last) / 1000 || 1 / 60, .032);
    last = time;
    const steps = Math.ceil(dt / .008), step = dt / steps;
    let moving = time < holdUntil;
    for (const [name, edge] of Object.entries(edges)) {
      const leading = name === (direction > 0 ? 'right' : 'left');
      // The front reaches first; the back stays briefly, leaving a fluid bridge.
      if (!leading && time < holdUntil) continue;
      const target = destination + (name === 'right' ? size : 0);
      const stiffness = leading ? 480 : 290;
      const damping = leading ? 43 : 34;
      for (let i = 0; i < steps; i++) {
        edge.velocity += ((target - edge.value) * stiffness - edge.velocity * damping) * step;
        edge.value += edge.velocity * step;
      }
      if (Math.abs(target - edge.value) > .02 || Math.abs(edge.velocity) > .05) moving = true;
      else { edge.value = target; edge.velocity = 0; }
    }
    paint();
    frame = moving ? requestAnimationFrame(tick) : 0;
  }
  function update() {
    const link = dock.querySelector('a[aria-current="location"]');
    if (!link) return;
    const next = link.offsetLeft, nextSize = link.offsetWidth;
    const changed = next !== destination;
    const resized = nextSize !== size;
    if (changed) {
      direction = next >= (edges.left.value + edges.right.value - nextSize) / 2 ? 1 : -1;
      holdUntil = performance.now() + 110;
      // Retarget the existing shape, including when another item is clicked mid-flow.
      edges[direction > 0 ? 'left' : 'right'].velocity = 0;
    }
    destination = next; size = nextSize;
    dock.style.setProperty('--selection-y', `${link.offsetTop}px`);
    dock.style.setProperty('--selection-size', `${size}px`);
    if (!initialized || resized || reduced.matches || document.hidden || dock.dataset.revealed !== 'true') snap();
    else if (changed && !frame) {
      last = performance.now(); frame = requestAnimationFrame(tick);
    }
    initialized = true;
    dock.classList.add('has-liquid-selection');
  }
  new MutationObserver(update).observe(dock, {subtree:true, attributes:true, attributeFilter:['aria-current', 'data-revealed']});
  new ResizeObserver(update).observe(dock);
  reduced.addEventListener('change', update);
  document.addEventListener('visibilitychange', update);
  update();
})();
