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
  let inside = false;
  let knownMouse = false;

  const allowed = () => finePointer.matches;
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
    // The dock owns its highlight; never stack a second cursor disk over it.
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
      destination.opacity = isDockTarget ? 0 : (pressed ? 0.23 : 0.14);
      if (label) {
        label.style.setProperty('--pull-x', `${clamp(dx * 0.08, 6)}px`);
        label.style.setProperty('--pull-y', `${clamp(dy * 0.13, 4)}px`);
        label.style.setProperty('--press-scale', pressed ? '.97' : '1');
      }
    } else {
      const size = pressed ? 14 : 18;
      Object.assign(destination, { x: position.x, y: position.y, width: size, height: size, radius: size / 2, opacity: 0.78 });
    }
    // The entire dock surface absorbs the cursor, including gaps and padding.
    if (pointer.classList.contains('on-dark')) {
      // Absorb a small cursor at the entry point, never a second icon-sized disk.
      Object.assign(destination, { x: position.x, y: position.y, width: 6, height: 6, radius: 3, opacity: 0 });
    }
    if (reducedMotion.matches && active) {
      cancelAnimationFrame(frame); frame = 0;
      Object.assign(state, destination);
      for (const key of Object.keys(velocity)) velocity[key] = 0;
      paint();
      return;
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
    pointer.style.opacity = Math.max(0, state.opacity);
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

  function hitTarget() {
    // Pointer capture retargets events to the carousel; hit-test the real location.
    const element = document.elementFromPoint(position.x, position.y);
    const onDock = Boolean(element?.closest('.bottom-nav'));
    pointer.classList.toggle('on-dark', onDock);
    changeTarget(element);
  }

  function move(event) {
    if (event.pointerType !== 'mouse') {
      if (event.pointerType === 'touch' || event.pointerType === 'pen') {
        knownMouse = inside = false;
        root.classList.remove('pointer-mouse');
        hide();
      }
      return;
    }
    if (!allowed()) { root.classList.remove('pointer-mouse'); hide(); return; }
    knownMouse = true;
    // Mouse mode survives transient blur/capture events; only visibility may reset.
    root.classList.add('pointer-mouse');
    position.x = event.clientX;
    position.y = event.clientY;
    inside = position.x >= 0 && position.y >= 0 && position.x < innerWidth && position.y < innerHeight;
    if (!inside) { hide(); return; }
    if (!active) {
      active = true;
      Object.assign(state, { x: position.x, y: position.y, width: 18, height: 18, radius: 9, opacity: 0.78 });
      for (const key of Object.keys(velocity)) velocity[key] = 0;
      paint();
      root.classList.add('pointer-enabled');
    }
    hitTarget();
    setDestination();
  }

  function resume() {
    if (!knownMouse || !inside || document.hidden || !allowed()) return;
    move({pointerType:'mouse', clientX:position.x, clientY:position.y});
  }
  const observe = {passive:true, capture:true};
  document.addEventListener('pointermove', move, observe);
  document.addEventListener('pointerover', move, observe);
  document.addEventListener('pointerdown', event => {
    move(event);
    if (!active || event.pointerType !== 'mouse') return;
    pressed = true;
    setDestination();
  }, observe);
  function release(event) {
    if (event.pointerType !== 'mouse') return;
    pressed = false;
    // Cancellation/lost capture ends a gesture, not the mouse cursor itself.
    resume();
  }
  document.addEventListener('pointerup', event => {
    if (event.pointerType !== 'mouse') return;
    pressed = false; move(event);
  }, observe);
  document.addEventListener('pointercancel', release, observe);
  document.addEventListener('lostpointercapture', release, observe);
  document.addEventListener('pointerout', event => {
    if (event.pointerType !== 'mouse' || event.relatedTarget) return;
    // Ignore synthetic boundary events caused by capture or a moving DOM target.
    if (event.clientX <= 0 || event.clientY <= 0 || event.clientX >= innerWidth || event.clientY >= innerHeight) {
      inside = false; hide();
    }
  }, observe);
  document.documentElement.addEventListener('pointerleave', event => {
    if (event.pointerType === 'mouse' && !pressed &&
        (event.clientX <= 0 || event.clientY <= 0 || event.clientX >= innerWidth || event.clientY >= innerHeight)) {
      inside = false; hide();
    }
  });
  document.addEventListener('dragstart', event => {
    // Native HTML link/image dragging replaces CSS cursors with an OS drag cursor.
    if (active && event.target instanceof Element && event.target.closest('a, img')) event.preventDefault();
  }, true);
  document.addEventListener('dragend', () => { pressed = false; resume(); }, observe);
  document.addEventListener('visibilitychange', () => { if (document.hidden) hide(); else resume(); });
  window.addEventListener('blur', hide);
  window.addEventListener('focus', resume);
  window.addEventListener('pageshow', resume);
  window.addEventListener('scroll', () => { if (active) { hitTarget(); setDestination(); } }, observe);
  window.addEventListener('resize', resume);
  finePointer.addEventListener('change', () => { if (allowed()) resume(); else { root.classList.remove('pointer-mouse'); hide(); } });
  reducedMotion.addEventListener('change', resume);
})();
