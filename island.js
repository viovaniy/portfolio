// Dock "island" physics: a liquid selection pill, a hover ghost, one morphing
// label, a breathing bar and springy presses. Spring-driven, transform-first,
// and idle (no frames) whenever everything has settled.
(() => {
  const dock = document.querySelector('.bottom-nav');
  if (!dock) return;
  const links = [...dock.querySelectorAll(':scope > a')];
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)');

  const make = (cls, tag = 'span') => {
    const el = document.createElement(tag);
    el.className = cls;
    el.setAttribute('aria-hidden', 'true');
    return el;
  };
  const ghostEl = make('island-ghost');
  const pillEl = make('island-pill');
  const tipEl = make('island-tip');
  dock.prepend(ghostEl, pillEl);
  dock.append(tipEl);
  dock.classList.add('has-island');

  // ---------- springs ----------
  // Damping ratios ~0.7–0.85: momentum and a whisper of overshoot, never wobbly.
  const spring = (value = 0, stiffness = 420, damping = 34) => ({ value, velocity: 0, target: value, stiffness, damping });
  const settled = s => Math.abs(s.target - s.value) < .01 && Math.abs(s.velocity) < .01;
  const sel = { left: spring(0, 520, 40), right: spring(0, 520, 40) };
  const ghost = { left: spring(0, 600, 44), right: spring(0, 600, 44), alpha: spring(0, 520, 46) };
  const tip = { x: spring(0, 520, 42), w: spring(0, 520, 42), open: spring(0, 380, 30) };
  const bar = { press: spring(0, 600, 36), stretch: spring(0, 300, 30) };
  const icons = links.map(() => spring(0, 700, 30));
  const all = [sel.left, sel.right, ghost.left, ghost.right, ghost.alpha, tip.x, tip.w, tip.open, bar.press, bar.stretch, ...icons];

  let size = 54, top = 9;
  let active = -1;
  let leadingSide = 'right';
  let trailHoldUntil = 0;
  let arrivalPending = -1;
  let hovered = -1;
  let ghostVisible = false;
  let tipIndex = -1;
  let tipLabel = '';
  let frame = 0, last = 0;
  let pressed = null;
  let focused = null;
  const litCache = [];
  let boxes = [];
  const measureBoxes = () => { boxes = links.map(link => ({ left: link.offsetLeft, width: link.offsetWidth })); };

  const geometry = i => ({ left: links[i].offsetLeft, width: links[i].offsetWidth, top: links[i].offsetTop });
  const label = i => links[i].querySelector('.nav-tooltip')?.textContent.trim() || links[i].getAttribute('aria-label') || '';

  function paint() {
    // Selection: width follows the two edges; height thins as it stretches.
    const w = Math.max(size * .6, sel.right.value - sel.left.value);
    const stretch = Math.max(0, w / size - 1);
    const h = size * (1 - Math.min(.16, stretch * .13));
    pillEl.style.width = `${w}px`;
    pillEl.style.height = `${h}px`;
    pillEl.style.transform = `translate3d(${sel.left.value}px, ${top + (size - h) / 2}px, 0)`;

    const gw = Math.max(size * .6, ghost.right.value - ghost.left.value);
    const gh = size * (1 - Math.min(.12, Math.max(0, gw / size - 1) * .1));
    ghostEl.style.width = `${gw}px`;
    ghostEl.style.height = `${gh}px`;
    ghostEl.style.transform = `translate3d(${ghost.left.value}px, ${top + (size - gh) / 2}px, 0)`;
    const alpha = Math.max(0, Math.min(1, ghost.alpha.value));
    ghostEl.style.opacity = alpha.toFixed(3);

    // Icon colour follows the circles: how much of each icon the pill or the
    // ghost actually covers this frame decides how white it is.
    const pillL = sel.left.value, pillR = sel.left.value + w;
    const ghostL = ghost.left.value, ghostR = ghost.left.value + gw;
    links.forEach((link, i) => {
      const box = boxes[i];
      if (!box) return;
      const L = box.left, R = box.left + box.width, W = box.width;
      const cover = (a, b) => Math.max(0, Math.min(R, b) - Math.max(L, a)) / W;
      let lit = Math.max(cover(pillL, pillR), cover(ghostL, ghostR) * alpha, link === focused ? 1 : 0);
      lit = Math.min(1, Math.max(0, (lit - .2) / .55));
      lit = lit * lit * (3 - 2 * lit);
      if (Math.abs(lit - (litCache[i] ?? -1)) > .004) {
        litCache[i] = lit;
        const c = Math.round(169 + (255 - 169) * lit);
        link.style.color = `rgb(${c}, ${c}, ${Math.min(255, c + 1)})`;
      }
    });

    // The bar breathes with the travelling pill and gives under a press.
    bar.stretch.target = Math.min(1, stretch / 1.4);
    const s = bar.stretch.value, p = bar.press.value;
    dock.style.transform = `translateX(-50%) scale(${1 + s * .016 - p * .012}, ${1 - s * .03 - p * .045})`;

    icons.forEach((state, i) => {
      const v = state.value;
      links[i].querySelector('svg').style.transform = v ? `translateY(${v * 1.5}px) scale(${1 - v * .16})` : '';
    });

    // Label: grows out of the bar, glides and resizes between items.
    const o = Math.max(0, Math.min(1.08, tip.open.value));
    tipEl.style.width = `${Math.max(0, tip.w.value)}px`;
    tipEl.style.transform = `translate3d(${tip.x.value - tip.w.value / 2}px, ${(1 - o) * 10}px, 0) scale(${.72 + o * .28}, ${.6 + o * .4})`;
    tipEl.style.opacity = String(Math.min(1, o * 1.4));
    tipEl.style.visibility = o < .02 && tip.open.target === 0 ? 'hidden' : 'visible';
  }

  function step(state, dt) {
    const steps = Math.ceil(dt / .006), h = dt / steps;
    for (let i = 0; i < steps; i++) {
      state.velocity += ((state.target - state.value) * state.stiffness - state.velocity * state.damping) * h;
      state.value += state.velocity * h;
    }
    if (settled(state)) { state.value = state.target; state.velocity = 0; return false; }
    return true;
  }

  function tick(now) {
    const dt = Math.min(last ? (now - last) / 1000 : 1 / 60, .034);
    last = now;
    let moving = false;
    for (const state of all) {
      // The trailing edge of the selection waits a beat, so the pill pours.
      const trailing = state === sel[leadingSide === 'right' ? 'left' : 'right'];
      if (trailing && now < trailHoldUntil) { moving = true; continue; }
      if (step(state, dt)) moving = true;
    }
    // A soft "landing" pop on the destination icon as the pill arrives.
    if (arrivalPending >= 0) {
      const lead = sel[leadingSide];
      if (Math.abs(lead.target - lead.value) < 2) {
        icons[arrivalPending].velocity -= 3.2;
        arrivalPending = -1;
        moving = true;
      }
    }
    paint();
    frame = moving ? requestAnimationFrame(tick) : 0;
    if (!frame) last = 0;
  }
  function wake() {
    if (reduced.matches) { all.forEach(s => { s.value = s.target; s.velocity = 0; }); paint(); return; }
    if (!frame) frame = requestAnimationFrame(tick);
  }

  // ---------- selection ----------
  function syncSelection(animate) {
    measureBoxes();
    const i = links.findIndex(link => link.getAttribute('aria-current') === 'location');
    if (i < 0) return;
    const g = geometry(i);
    size = g.width; top = g.top;
    const changed = i !== active;
    const from = active;
    active = i;
    sel.left.target = g.left;
    sel.right.target = g.left + g.width;
    if (!animate || from < 0) {
      sel.left.value = sel.left.target; sel.right.value = sel.right.target;
      sel.left.velocity = sel.right.velocity = 0;
      paint();
      return;
    }
    if (changed) {
      leadingSide = i > from ? 'right' : 'left';
      trailHoldUntil = performance.now() + 90;
      arrivalPending = i;
    }
    wake();
  }

  // ---------- hover ghost ----------
  function setGhost(i) {
    if (i === hovered && ghostVisible) return;
    hovered = i;
    if (i < 0 || !finePointer.matches) {
      ghostVisible = false;
      ghost.alpha.target = 0;
      pillEl.classList.remove('is-hot');
      wake();
      return;
    }
    const g = geometry(i);
    ghost.left.target = g.left;
    ghost.right.target = g.left + g.width;
    if (!ghostVisible) {
      // Arrive in place from outside the bar; glide only between items.
      ghost.left.value = ghost.left.target; ghost.right.value = ghost.right.target;
      ghost.left.velocity = ghost.right.velocity = 0;
    }
    ghostVisible = true;
    ghost.alpha.target = 1;
    pillEl.classList.toggle('is-hot', i === active);
    wake();
  }

  // ---------- morphing label ----------
  function measure(text) {
    const probe = document.createElement('span');
    probe.className = 'island-tip-text';
    probe.style.visibility = 'hidden';
    probe.textContent = text;
    tipEl.append(probe);
    const width = probe.getBoundingClientRect().width;
    probe.remove();
    return Math.ceil(width) + 24;
  }
  function showTip(i) {
    if (i < 0) { hideTip(); return; }
    const text = label(i);
    const g = geometry(i);
    const width = measure(text);
    const opening = tip.open.value < .15;
    tip.x.target = g.left + g.width / 2;
    tip.w.target = width;
    tip.open.target = 1;
    if (opening) {
      tip.x.value = tip.x.target; tip.x.velocity = 0;
      tip.w.value = Math.max(30, width * .55); tip.w.velocity = 0;
    }
    if (text !== tipLabel) {
      const old = [...tipEl.querySelectorAll('.island-tip-text:not(.is-leaving)')];
      const next = document.createElement('span');
      next.className = 'island-tip-text';
      next.textContent = text;
      tipEl.append(next);
      if (!opening && !reduced.matches) {
        next.animate([{ opacity: 0, transform: 'translateY(5px)' }, { opacity: 1, transform: 'none' }],
          { duration: 260, delay: 40, easing: 'cubic-bezier(.22,1,.36,1)', fill: 'backwards' });
        old.forEach(el => {
          el.classList.add('is-leaving');
          el.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(-5px)' }],
            { duration: 160, easing: 'cubic-bezier(.4,0,1,1)', fill: 'forwards' }).onfinish = () => el.remove();
        });
      } else old.forEach(el => el.remove());
      tipLabel = text;
    }
    tipIndex = i;
    wake();
  }
  let hideTimer = 0;
  function hideTip(delay = 0) {
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => { tip.open.target = 0; tipIndex = -1; wake(); }, delay);
  }

  // ---------- press ----------
  function press(i, source) {
    if (pressed) return;
    pressed = { i, source, at: performance.now() };
    bar.press.target = 1;
    icons[i].target = 1;
    wake();
  }
  function release(source, cancelled = false) {
    if (!pressed || (source != null && pressed.source !== source)) return;
    const { i, at } = pressed;
    pressed = null;
    bar.press.target = 0;
    icons[i].target = 0;
    // A quick tap still gets a squish: give the springs an impulse.
    if (!cancelled && performance.now() - at < 120) {
      bar.press.velocity += 5;
      icons[i].velocity += 9;
    }
    wake();
  }

  links.forEach((link, i) => {
    link.addEventListener('pointerenter', event => {
      if (event.pointerType !== 'mouse') return;
      clearTimeout(hideTimer);
      setGhost(i);
      showTip(i);
    });
    link.addEventListener('focus', () => {
      if (link.matches(':focus-visible')) { focused = link; clearTimeout(hideTimer); showTip(i); wake(); }
    });
    link.addEventListener('blur', () => {
      if (focused === link) { focused = null; wake(); } if (tipIndex === i) hideTip(60); if (pressed?.i === i) release(null, true); });
    link.addEventListener('pointerdown', event => {
      if (event.button !== 0 || !event.isPrimary) return;
      // Suppress native mouse-down link handling (focus/drag cursor refresh);
      // the click still navigates. Touch and keyboard stay native.
      if (event.pointerType === 'mouse' && document.documentElement.classList.contains('pointer-mouse')) event.preventDefault();
      press(i, event.pointerId);
    });
    link.addEventListener('pointerleave', event => release(event.pointerId, true));
    link.addEventListener('keydown', event => { if (event.key === 'Enter' && !event.repeat) press(i, 'keyboard'); });
  });
  dock.addEventListener('pointerleave', event => {
    if (event.pointerType !== 'mouse') return;
    setGhost(-1);
    hideTip(70);
  });
  window.addEventListener('pointerup', event => release(event.pointerId));
  window.addEventListener('pointercancel', event => release(event.pointerId, true));
  window.addEventListener('keyup', event => { if (event.key === 'Enter') release('keyboard'); });

  // Touch: navigation.js marks a tapped item briefly; show its label then.
  new MutationObserver(records => {
    for (const record of records) {
      const link = record.target;
      if (record.attributeName === 'aria-current') continue;
      const i = links.indexOf(link);
      if (i < 0 || finePointer.matches) continue;
      if (link.classList.contains('is-tapped')) { clearTimeout(hideTimer); showTip(i); }
      else if (tipIndex === i) hideTip(80);
    }
    syncSelection(dock.dataset.revealed === 'true' && !document.hidden);
  }).observe(dock, { subtree: true, attributes: true, attributeFilter: ['aria-current', 'class', 'data-revealed'] });

  function reset() {
    pressed = null;
    bar.press.target = 0;
    icons.forEach(s => { s.target = 0; });
    setGhost(-1);
    hideTip();
    wake();
  }
  window.addEventListener('blur', reset);
  document.addEventListener('visibilitychange', () => { if (document.hidden) reset(); });
  new ResizeObserver(() => {
    syncSelection(false);
    if (tipIndex >= 0) showTip(tipIndex);
  }).observe(dock);
  reduced.addEventListener('change', () => { if (reduced.matches) { dock.style.removeProperty('transform'); wake(); } });
  syncSelection(false);
})();
