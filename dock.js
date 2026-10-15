(() => {
  const dock = document.querySelector('.bottom-nav');
  if (!dock) return;
  const links = [...dock.querySelectorAll('a')];
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const badge = dock.querySelector('.shop-badge');
  const counter = badge?.querySelector('.shop-count');
  let badgeStarted = false;
  let badgeAnimation;
  let counterAnimation;
  function finishBadge() {
    badgeAnimation?.cancel();
    counterAnimation?.cancel();
    if (!badge || !counter) return;
    badge.dataset.ready = 'true';
    counter.textContent = badge.dataset.count;
  }
  function showBadge() {
    if (badgeStarted || !badge || !counter) return;
    badgeStarted = true;
    if (reduced.matches) { finishBadge(); return; }
    badge.dataset.ready = 'true';
    const total = Number(badge.dataset.count);
    const column = document.createElement('span');
    column.className = 't-reel-col';
    const strip = document.createElement('span');
    strip.className = 't-reel-strip';
    // One continuous reel from 0 to the target, without extra 0–9 laps.
    for (let value = 0; value <= total; value++) {
      const cell = document.createElement('span');
      cell.className = 't-reel-digit';
      cell.textContent = String(value);
      strip.appendChild(cell);
    }
    column.appendChild(strip);
    counter.replaceChildren(column);
    badgeAnimation = badge.animate([
      { transform: 'scale(0)', opacity: 0 },
      { transform: 'scale(1.24)', opacity: 1, offset: .55 },
      { transform: 'scale(.92)', opacity: 1, offset: .78 },
      { transform: 'scale(1)', opacity: 1 }
    ], { duration: 320, easing: 'cubic-bezier(.2,.75,.3,1)' });
    const tokens = getComputedStyle(counter);
    const cellHeight = parseFloat(tokens.getPropertyValue('--reel-cell'));
    const duration = parseFloat(tokens.getPropertyValue('--reel-dur'));
    const destination = `translateY(-${total * cellHeight}px)`;
    strip.style.transform = destination;
    counterAnimation = strip.animate([
      { transform: 'translateY(0)' },
      { transform: destination }
    ], { duration, easing: tokens.getPropertyValue('--reel-ease').trim() });
  }
  let revealed = false;
  let revealTimer = 0;
  let previousScroll = scrollY;
  let intentUntil = 0;
  let touchY = null;
  let scrollReady = false;
  dock.inert = true;
  dock.setAttribute('aria-hidden', 'true');
  links.forEach((link, i) => link.style.setProperty('--nav-order', i));

  function finishReveal() {
    clearTimeout(revealTimer);
    dock.dataset.revealed = 'true';
    dock.inert = false;
    dock.removeAttribute('aria-hidden');
    showBadge();
  }
  function reveal() {
    if (revealed) return;
    revealed = true;
    window.removeEventListener('scroll', watchScroll);
    window.removeEventListener('wheel', wheelIntent);
    window.removeEventListener('touchstart', touchStart);
    window.removeEventListener('touchmove', touchMove);
    window.removeEventListener('keydown', keyIntent);
    window.removeEventListener('pointerdown', pointerIntent);
    if (reduced.matches) { finishReveal(); return; }
    dock.dataset.revealed = 'entering';
    revealTimer = setTimeout(finishReveal, 1000 + (links.length - 1) * 75);
  }
  function markIntent() { intentUntil = performance.now() + 1800; }
  function wheelIntent(event) {
    if (!event.ctrlKey && !event.metaKey && event.deltaY > Math.abs(event.deltaX)) markIntent();
  }
  function touchStart(event) { touchY = event.touches[0]?.clientY ?? null; }
  function touchMove(event) {
    const y = event.touches[0]?.clientY;
    if (touchY !== null && y != null && y < touchY - 3) markIntent();
  }
  function keyIntent(event) {
    if (event.target.closest?.('input,textarea,select,[contenteditable="true"]')) return;
    if (['ArrowDown', 'PageDown', 'End'].includes(event.key) || (event.key === ' ' && !event.shiftKey)) markIntent();
  }
  function pointerIntent() { markIntent(); } // Includes dragging the native scrollbar.
  function watchScroll() {
    const current = scrollY;
    if (current > previousScroll + .5 && (scrollReady || performance.now() <= intentUntil)) reveal();
    previousScroll = current;
  }
  dock.addEventListener('animationstart', event => {
    if (event.animationName === 'dock-icon-arrive' && event.target === badge?.closest('a')) showBadge();
  });
  dock.addEventListener('animationend', event => {
    if (event.animationName === 'dock-icon-arrive' && event.target === links[links.length - 1]) finishReveal();
  });
  window.addEventListener('scroll', watchScroll, { passive: true });
  window.addEventListener('wheel', wheelIntent, { passive: true });
  window.addEventListener('touchstart', touchStart, { passive: true });
  window.addEventListener('touchmove', touchMove, { passive: true });
  window.addEventListener('keydown', keyIntent);
  window.addEventListener('pointerdown', pointerIntent, { passive: true });
  // Scroll restoration and direct #section links alone do not reveal the dock.
  function readyForScroll() {
    previousScroll = scrollY;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      previousScroll = scrollY;
      scrollReady = true;
    }));
  }
  window.addEventListener('pageshow', readyForScroll);
  if (document.readyState === 'complete') readyForScroll();
  reduced.addEventListener('change', () => {
    if (revealed && reduced.matches) { finishReveal(); finishBadge(); }
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && badgeStarted) finishBadge();
  });
  window.addEventListener('pagehide', () => { if (badgeStarted) finishBadge(); });
  document.documentElement.setAttribute('data-dock-ready', '');

  const spring = () => ({ value: 0, velocity: 0, target: 0 });
  const sink = spring();
  const lean = spring();
  const icons = links.map(spring);
  const states = [sink, lean, ...icons];
  let held = null;
  let frame = 0;
  let last = 0;

  function paint() {
    // The pressed edge dips; the dock keeps its fixed position and pill shape.
    dock.style.transform = `translateX(-50%) translateY(${sink.value * 1.8}px) perspective(700px) rotateX(${sink.value * 3}deg) rotateY(${-lean.value * 3}deg) rotateZ(${lean.value * 1.25}deg) scale(${1 - sink.value * .01},${1 - sink.value * .035})`;
    icons.forEach((state, i) => {
      const side = i / (links.length - 1) * 2 - 1;
      links[i].querySelector('svg').style.transform = `translateY(${state.value * 2}px) rotate(${side * state.value * 8}deg) scale(${1 - state.value * .2})`;
    });
  }

  function tick(now) {
    const dt = Math.min(last ? (now - last) / 1000 : 1 / 60, .032);
    last = now;
    const steps = Math.ceil(dt / .008);
    const step = dt / steps;
    let moving = false;
    states.forEach((state, i) => {
      const stiffness = i < 2 ? 520 : 650;
      const damping = i < 2 ? 28 : 24;
      for (let j = 0; j < steps; j++) {
        state.velocity += ((state.target - state.value) * stiffness - state.velocity * damping) * step;
        state.value += state.velocity * step;
      }
      if (Math.abs(state.target - state.value) > .001 || Math.abs(state.velocity) > .005) moving = true;
      else { state.value = state.target; state.velocity = 0; }
    });
    paint();
    if (moving) frame = requestAnimationFrame(tick);
    else { frame = 0; last = 0; }
  }
  function animate() { if (!frame && !reduced.matches) frame = requestAnimationFrame(tick); }

  function press(i, source) {
    if (reduced.matches || held) return;
    held = { index: i, source, at: performance.now() };
    dock.dataset.pressed = String(i);
    sink.target = 1;
    lean.target = i / (links.length - 1) * 2 - 1;
    icons.forEach((state, index) => { state.target = index === i ? 1 : 0; });
    animate();
  }

  function release(source, cancelled = false) {
    if (!held || (source != null && held.source !== source)) return;
    const i = held.index;
    // A quick tap still gives the springs an impulse; navigation never waits.
    if (!cancelled && performance.now() - held.at < 110) {
      sink.velocity += 4;
      lean.velocity += (i / (links.length - 1) * 2 - 1) * 4;
      icons[i].velocity += 10;
    }
    held = null;
    delete dock.dataset.pressed;
    states.forEach(state => { state.target = 0; });
    animate();
  }

  links.forEach((link, i) => {
    link.addEventListener('pointerdown', event => {
      if (event.button !== 0 || !event.isPrimary) return;
      // Suppress native mouse-down link handling (focus/drag cursor refresh).
      // The click event still performs navigation; touch and keyboard stay native.
      if (event.pointerType === 'mouse' && document.documentElement.classList.contains('pointer-mouse')) event.preventDefault();
      press(i, event.pointerId);
    });
    link.addEventListener('pointerleave', event => release(event.pointerId, true));
    link.addEventListener('keydown', event => {
      if (event.key === 'Enter' && !event.repeat) press(i, 'keyboard');
    });
    link.addEventListener('blur', () => { if (held?.index === i) release(null, true); });
  });
  window.addEventListener('pointerup', event => release(event.pointerId));
  window.addEventListener('pointercancel', event => release(event.pointerId, true));
  window.addEventListener('keyup', event => { if (event.key === 'Enter') release('keyboard'); });
  function reset() {
    held = null;
    cancelAnimationFrame(frame);
    frame = last = 0;
    states.forEach(state => { state.value = state.velocity = state.target = 0; });
    delete dock.dataset.pressed;
    dock.style.removeProperty('transform');
    links.forEach(link => link.querySelector('svg').style.removeProperty('transform'));
  }
  window.addEventListener('blur', reset);
  window.addEventListener('pagehide', reset);
  document.addEventListener('visibilitychange', () => { if (document.hidden) reset(); });
  reduced.addEventListener('change', reset);
})();
