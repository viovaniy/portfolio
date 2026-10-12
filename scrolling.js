(() => {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const fine = matchMedia('(pointer: fine)');
  let frame = 0;
  let mode = '';
  let target = scrollY;
  let last = 0;
  let wheelPosition = scrollY;
  const limit = () => Math.max(0, document.documentElement.scrollHeight - innerHeight);
  const clamp = value => Math.max(0, Math.min(limit(), value));

  function cancel() {
    cancelAnimationFrame(frame);
    frame = 0;
    mode = '';
    last = 0;
    target = wheelPosition = scrollY;
  }
  function position(top) { window.scrollTo({ top, behavior: 'instant' }); }

  function to(element, done = () => {}) {
    cancel();
    const margin = parseFloat(getComputedStyle(element).scrollMarginTop) || 0;
    const end = clamp(scrollY + element.getBoundingClientRect().top - margin);
    const start = scrollY;
    const distance = end - start;
    if (reduced.matches || Math.abs(distance) < 1) {
      position(end);
      done();
      return;
    }
    mode = 'section';
    const duration = Math.min(1250, 650 + Math.abs(distance) * .16);
    const started = performance.now();
    function step(now) {
      const t = Math.min(1, (now - started) / duration);
      // Smooth acceleration and a gentle arrival, even across distant sections.
      const ease = t < .5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
      position(start + distance * ease);
      if (t < 1) frame = requestAnimationFrame(step);
      else { cancel(); done(); }
    }
    frame = requestAnimationFrame(step);
  }
  window.siteScroll = { to, cancel };

  function nestedScroll(event) {
    let node = event.target instanceof Element ? event.target : null;
    while (node && node !== document.body) {
      if (node.matches('input,textarea,select,[contenteditable="true"]')) return true;
      const style = getComputedStyle(node);
      if (/(auto|scroll)/.test(style.overflowY) && node.scrollHeight > node.clientHeight + 1) {
        if ((event.deltaY > 0 && node.scrollTop + node.clientHeight < node.scrollHeight - 1) ||
            (event.deltaY < 0 && node.scrollTop > 0)) return true;
      }
      node = node.parentElement;
    }
    return false;
  }
  window.addEventListener('wheel', event => {
    if (event.defaultPrevented || !event.cancelable || reduced.matches || !fine.matches ||
        event.ctrlKey || event.metaKey || event.shiftKey || Math.abs(event.deltaX) > Math.abs(event.deltaY) ||
        !event.deltaY || nestedScroll(event)) return;
    const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? innerHeight : 1;
    if (mode !== 'wheel') { cancel(); mode = 'wheel'; }
    target = clamp(target + event.deltaY * unit);
    if (Math.abs(target - scrollY) < .5) return;
    event.preventDefault();
    if (frame) return;
    function step(now) {
      const dt = last ? Math.min(40, now - last) : 1000 / 60;
      last = now;
      // Integrate the unrounded value so small wheel deltas always settle.
      const next = wheelPosition + (target - wheelPosition) * (1 - Math.exp(-dt / 105));
      wheelPosition = next;
      if (Math.abs(target - next) < .8) { position(target); cancel(); return; }
      position(next);
      frame = requestAnimationFrame(step);
    }
    frame = requestAnimationFrame(step);
  }, { passive: false });

  // Preserve native touch momentum, keyboard scrolling, zoom and form controls.
  window.addEventListener('touchstart', cancel, { passive: true });
  window.addEventListener('pointerdown', cancel, { passive: true });
  window.addEventListener('keydown', event => {
    if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '].includes(event.key)) cancel();
  });
  window.addEventListener('resize', cancel);
  window.addEventListener('pagehide', cancel);
  reduced.addEventListener('change', cancel);
})();
