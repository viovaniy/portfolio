// Independent iPad-style pointer: a spring-driven circle morphs into click targets.
(() => {
  const pointer = document.querySelector('.ios-pointer');
  if (!pointer) return;
  const finePointer = matchMedia('(any-hover: hover) and (any-pointer: fine)');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const root = document.documentElement;
  const targetSelector = 'a[href], button:not(:disabled), [role="button"], [data-magnetic]';
  const state = { x: 0, y: 0, width: 18, height: 18, radius: 9, opacity: 0.78 };
  const destination = { ...state };
  const velocity = Object.fromEntries(Object.keys(state).map(key => [key, 0]));
  const position = { x: 0, y: 0 };
  let active = false;
  let pressed = false;
  let target = null;
  let label = null;
  let frame = 0;
  let lastTime = 0;

  const allowed = () => finePointer.matches && !reducedMotion.matches;
  const clamp = (value, limit) => Math.max(-limit, Math.min(limit, value));

  function resetLabel() {
    if (!label) return;
    label.style.removeProperty('--pull-x');
    label.style.removeProperty('--pull-y');
    label.style.removeProperty('--press-scale');
  }

  function changeTarget(element) {
    const next = element instanceof Element ? element.closest(targetSelector) : null;
    const enabled = next && !next.hasAttribute('data-pointer-passive') && next.getAttribute('aria-disabled') !== 'true' && !next.closest('[inert]') ? next : null;
    if (enabled === target) return;
    resetLabel();
    target = enabled;
    label = target?.querySelector('.magnetic-label') || null;
    // Keep the pointer visible as it morphs into the dock surface.
    pointer.classList.toggle('on-nav-target', Boolean(target?.closest('.bottom-nav')));
  }

  function setDestination() {
    if (target && !target.isConnected) changeTarget(null);
    if (target) {
      // Read the stable hit area, never the moving label, to avoid hover jitter.
      const rect = target.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const dx = position.x - centerX;
      const dy = position.y - centerY;
      const scale = pressed ? 0.95 : 1;
      const isDockTarget = Boolean(target.closest('.bottom-nav'));
      destination.x = centerX + (isDockTarget ? 0 : clamp(dx * 0.1, 8));
      destination.y = centerY + (isDockTarget ? 0 : clamp(dy * 0.16, 5));
      destination.width = (isDockTarget ? rect.width : rect.width + 8) * scale;
      destination.height = (isDockTarget ? rect.width : rect.height + 6) * scale;
      destination.radius = isDockTarget ? destination.width / 2 : Math.min(14, destination.height / 2);
      destination.opacity = isDockTarget ? (pressed ? 0.18 : 0.10) : (pressed ? 0.23 : 0.14);
      if (label) {
        label.style.setProperty('--pull-x', `${clamp(dx * 0.08, 6)}px`);
        label.style.setProperty('--pull-y', `${clamp(dy * 0.13, 4)}px`);
        label.style.setProperty('--press-scale', pressed ? '.97' : '1');
      }
    } else {
      const size = pressed ? 14 : 18;
      Object.assign(destination, { x: position.x, y: position.y, width: size, height: size, radius: size / 2, opacity: 0.78 });
    }
    if (!frame && active) {
      lastTime = performance.now();
      frame = requestAnimationFrame(animate);
    }
  }

  function paint() {
    pointer.style.transform = `translate3d(${state.x - state.width / 2}px,${state.y - state.height / 2}px,0)`;
    pointer.style.width = `${state.width}px`;
    pointer.style.height = `${state.height}px`;
    pointer.style.borderRadius = `${state.radius}px`;
    pointer.style.opacity = state.opacity;
  }

  function animate(time) {
    frame = 0;
    if (!active) return;
    const dt = Math.min(Math.max((time - lastTime) / 1000, 0.001), 0.032);
    lastTime = time;
    let unsettled = false;
    // Small integration steps keep the spring stable on slower displays.
    const steps = Math.ceil(dt / 0.008);
    const step = dt / steps;
    for (const key of Object.keys(state)) {
      const stiffness = key === 'x' || key === 'y' ? 950 : 520;
      const damping = key === 'x' || key === 'y' ? 49 : 35;
      for (let i = 0; i < steps; i++) {
        velocity[key] += ((destination[key] - state[key]) * stiffness - velocity[key] * damping) * step;
        state[key] += velocity[key] * step;
      }
      const epsilon = key === 'opacity' ? 0.001 : 0.025;
      if (Math.abs(destination[key] - state[key]) > epsilon || Math.abs(velocity[key]) > epsilon) unsettled = true;
      else { state[key] = destination[key]; velocity[key] = 0; }
    }
    paint();
    if (unsettled) frame = requestAnimationFrame(animate);
  }

  function hide() {
    resetLabel();
    active = false;
    pressed = false;
    target = null;
    label = null;
    cancelAnimationFrame(frame);
    frame = 0;
    root.classList.remove('pointer-enabled');
    pointer.classList.remove('on-dark', 'on-nav-target');
    pointer.style.opacity = '0';
  }

  function move(event) {
    if (event.pointerType !== 'mouse' || !allowed()) { hide(); return; }
    if (event.target instanceof Element && event.target.closest('input, textarea, select, [contenteditable="true"]')) { hide(); return; }
    pointer.classList.toggle('on-dark', Boolean(event.target instanceof Element && event.target.closest('.bottom-nav')));
    position.x = event.clientX;
    position.y = event.clientY;
    if (!active) {
      active = true;
      Object.assign(state, { x: position.x, y: position.y, width: 18, height: 18, radius: 9, opacity: 0.78 });
      for (const key of Object.keys(velocity)) velocity[key] = 0;
      paint();
      root.classList.add('pointer-enabled');
    }
    changeTarget(event.target);
    setDestination();
  }

  document.addEventListener('pointermove', move, { passive: true });
  document.addEventListener('pointerdown', event => {
    move(event);
    if (!active) return;
    pressed = true;
    setDestination();
  }, { passive: true });
  document.addEventListener('pointerup', event => {
    if (event.pointerType !== 'mouse') return;
    pressed = false;
    if (active) setDestination();
  }, { passive: true });
  document.addEventListener('pointerout', event => { if (!event.relatedTarget) hide(); });
  document.addEventListener('pointercancel', hide);
  document.addEventListener('keydown', hide);
  document.addEventListener('visibilitychange', () => { if (document.hidden) hide(); });
  window.addEventListener('blur', hide);
  window.addEventListener('scroll', () => {
    if (!active) return;
    const element = document.elementFromPoint(position.x, position.y);
    if (element?.closest('input, textarea, select, [contenteditable="true"]')) { hide(); return; }
    pointer.classList.toggle('on-dark', Boolean(element?.closest('.bottom-nav')));
    changeTarget(element);
    setDestination();
  }, { passive: true, capture: true });
  window.addEventListener('resize', hide);
  finePointer.addEventListener('change', hide);
  reducedMotion.addEventListener('change', hide);
})();
