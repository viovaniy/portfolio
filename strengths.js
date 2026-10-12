(() => {
  const stage = document.querySelector('.strength-stage');
  if (!stage) return;
  const root = stage.closest('.strengths');
  const slots = [...stage.querySelectorAll('.strength-slot')];
  const cards = slots.map(slot => slot.querySelector('.strength-card'));
  const status = root.querySelector('.strength-status');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const angles = [-4.2, 2.6, -1.4, 3.8, 1.7];
  const horizon = 18 * Math.PI / 180;
  const periods = [4.7, 5.9, 6.7, 5.3, 7.1];
  const n = cards.length;
  const clamp = (v, low, high) => Math.min(high, Math.max(low, v));
  const wrapped = v => ((v % n) + n) % n;
  let turn = 0;
  let destination = 0;
  let orbit = 132;
  let pull = 140;
  let fit = 1;
  let frame = 0;
  let drag = null;
  let suppressClick = false;
  let suppressTimer = 0;
  const effects = new Map();

  slots.forEach((slot, i) => {
    slot.querySelector('.strength-float').style.animationDuration = `${periods[i]}s`;
  });

  // Unbounded turn preserves the direction when the ring passes its first card.
  function paint() {
    slots.forEach((slot, i) => {
      const angle = (i - turn) * Math.PI * 2 / n;
      const front = (Math.cos(angle) + 1) / 2;
      const scale = (.375 + .625 * front) * fit; // depth: 125
      const across = Math.sin(angle) * orbit;
      const depth = -(1 - front) * 38 * fit;
      // Rotate the orbit itself: its left edge rises and its right edge falls.
      const x = across * Math.cos(horizon) - depth * Math.sin(horizon);
      const y = across * Math.sin(horizon) + depth * Math.cos(horizon);
      slot.style.transform = `translate(-50%,-50%) translate(${x}px,${y}px) rotate(${18 + angles[i]}deg) scale(${scale})`;
      slot.style.zIndex = String(Math.round(front * 100));
    });
  }

  function announce() {
    const current = wrapped(Math.round(turn));
    stage.dataset.index = String(current);
    cards.forEach((card, i) => { card.tabIndex = i === current ? 0 : -1; });
    status.textContent = `${current + 1} of ${n}. ${cards[current].dataset.title}.`;
  }

  function glide(to) {
    cancelAnimationFrame(frame);
    destination = to;
    const from = turn;
    const start = performance.now();
    resetTilt();
    if (reduced.matches || Math.abs(from - to) < .001) {
      turn = to;
      paint();
      announce();
      return;
    }
    const duration = 620 * (1.6 - .4 * 1.2); // settle: 40
    function step(now) {
      const p = Math.min(1, (now - start) / duration);
      turn = from + (to - from) * (1 - (1 - p) ** 4);
      paint();
      if (p < 1) frame = requestAnimationFrame(step);
      else { frame = 0; announce(); }
    }
    frame = requestAnimationFrame(step);
  }

  function resize() {
    // Scale the entire ring to fit the available width, without masking its sides.
    const width = stage.clientWidth;
    fit = Math.min(1, width / 420);
    orbit = 132 * fit;
    pull = 140 * fit;
    paint();
  }

  stage.addEventListener('pointerdown', e => {
    if (!e.isPrimary || e.button !== 0) return;
    cancelAnimationFrame(frame);
    frame = 0;
    clearTimeout(suppressTimer);
    suppressClick = false;
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY, turn, last: e.clientX, time: e.timeStamp, velocity: 0, moved: false };
  });
  stage.addEventListener('pointermove', e => {
    const g = drag;
    if (!g || g.id !== e.pointerId) return;
    const dx = e.clientX - g.x;
    const dy = e.clientY - g.y;
    if (!g.moved) {
      if (Math.abs(dy) > 8 && Math.abs(dy) > Math.abs(dx)) {
        drag = null;
        glide(Math.round(turn));
        return;
      }
      if (Math.abs(dx) < 7) return;
      g.moved = true;
      stage.classList.add('is-dragging');
      resetTilt();
      try { stage.setPointerCapture(e.pointerId); } catch { /* Continue through bubbling. */ }
    }
    const dt = Math.max(1, e.timeStamp - g.time);
    g.velocity = (g.velocity + (e.clientX - g.last) / dt) / 2;
    g.last = e.clientX;
    g.time = e.timeStamp;
    turn = g.turn - dx / pull;
    paint();
  });
  function release(e, cancelled = false) {
    const g = drag;
    if (!g || g.id !== e.pointerId) return;
    drag = null;
    stage.classList.remove('is-dragging');
    if (stage.hasPointerCapture(e.pointerId)) stage.releasePointerCapture(e.pointerId);
    if (g.moved) {
      suppressClick = true;
      suppressTimer = setTimeout(() => { suppressClick = false; }, 350);
    }
    if (g.moved || cancelled) {
      const velocity = e.timeStamp - g.time > 100 || cancelled ? 0 : g.velocity;
      glide(Math.round(turn + clamp(-velocity * 150 / pull, -2, 2)));
    } else if (Math.abs(turn - Math.round(turn)) > .001) {
      glide(Math.round(turn));
    }
  }
  window.addEventListener('pointerup', e => release(e));
  window.addEventListener('pointercancel', e => release(e, true));
  stage.addEventListener('lostpointercapture', e => release(e, true));
  stage.addEventListener('dragstart', e => e.preventDefault());
  stage.addEventListener('click', e => {
    if (suppressClick) { e.preventDefault(); e.stopPropagation(); suppressClick = false; }
  }, true);
  root.querySelectorAll('[data-step]').forEach(button => {
    button.addEventListener('click', () => glide(Math.round(destination) + Number(button.dataset.step)));
  });
  stage.addEventListener('keydown', e => {
    const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    glide(Math.round(destination) + step);
  });

  function animateObject(card, i) {
    const object = card.querySelector('.strength-object');
    effects.get(card)?.forEach(effect => effect.cancel());
    card.dataset.playing = 'true';
    const small = reduced.matches;
    let frames;
    if (small) frames = [{ opacity: 1 }, { opacity: .55 }, { opacity: 1 }];
    else if (i === 0) frames = [
      { transform: 'translate(0,0) rotate(0deg) scale(1)', offset: 0 },
      { transform: 'translate(0,5px) rotate(-8deg) scale(1.07,.92)', offset: .08 },
      { transform: 'translate(46px,-143px) rotate(175deg) scale(.42)', opacity: 1, offset: .38 },
      { transform: 'translate(59px,-156px) rotate(230deg) scale(.2)', opacity: 0, offset: .5 },
      { transform: 'translate(-12px,-70px) rotate(320deg) scale(.8)', opacity: 0, offset: .58 },
      { transform: 'translate(0,0) rotate(360deg) scale(1.07,.93)', opacity: 1, offset: .8 },
      { transform: 'translate(0,-9px) rotate(360deg) scale(.97,1.03)', offset: .9 },
      { transform: 'translate(0,0) rotate(360deg) scale(1)', offset: 1 }
    ];
    else if (i === 3) frames = [{ transform: 'rotate(0) scale(1)' }, { transform: 'rotate(180deg) scale(1.3)', offset: .5 }, { transform: 'rotate(360deg) scale(1)' }];
    else frames = [{ transform: 'translateY(0) scale(1)' }, { transform: 'translateY(-23px) rotate(-8deg) scale(1.18)', offset: .4 }, { transform: 'translateY(5px) rotate(3deg) scale(.95)', offset: .75 }, { transform: 'translateY(0) scale(1)' }];
    const effect = object.animate(frames, { duration: small ? 200 : i === 0 ? 1250 : 750, easing: 'cubic-bezier(.25,.65,.4,1)' });
    const running = [effect];
    const shadow = card.querySelector('.ball-shadow');
    if (shadow && !small) running.push(shadow.animate([{ opacity: 1, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(.25)', offset: .4 }, { opacity: 0, offset: .6 }, { opacity: 1, transform: 'scale(1)' }], { duration: 1250 }));
    effects.set(card, running);
    effect.onfinish = () => {
      if (effects.get(card)?.[0] !== effect) return;
      card.dataset.playing = 'false';
      effects.delete(card);
    };
  }

  const tilt = cards.map(() => ({ x: 0, y: 0, light: 0, vx: 0, vy: 0, vl: 0, tx: 0, ty: 0, tl: 0 }));
  let tiltFrame = 0;
  let tiltTime = 0;
  function tiltStep(now) {
    const dt = tiltTime ? Math.min(2.5, (now - tiltTime) / (1000 / 60)) : 1;
    tiltTime = now;
    let moving = false;
    tilt.forEach((state, i) => {
      [['x', 'vx', 'tx'], ['y', 'vy', 'ty'], ['light', 'vl', 'tl']].forEach(([key, velocity, target]) => {
        state[velocity] = (state[velocity] + (state[target] - state[key]) * .16 * dt) * .72 ** dt;
        state[key] += state[velocity] * dt;
        if (Math.abs(state[target] - state[key]) + Math.abs(state[velocity]) > .002) moving = true;
        else { state[key] = state[target]; state[velocity] = 0; }
      });
      cards[i].style.transform = `translateZ(${-5.5 * state.light}px) rotateX(${-state.y * 7.15}deg) rotateY(${state.x * 7.15}deg)`;
      cards[i].querySelector('.strength-sheen').style.backgroundImage = `radial-gradient(44% 36% at ${(state.x + 1) * 50}% ${(state.y + 1) * 50}%,rgba(255,255,255,${state.light * .42}),transparent),radial-gradient(54% 44% at ${(1 - state.x) * 50}% ${(1 - state.y) * 50}%,rgba(255,255,255,${state.light * .12}),transparent)`;
    });
    if (moving) tiltFrame = requestAnimationFrame(tiltStep);
    else { tiltFrame = 0; tiltTime = 0; }
  }
  function startTilt() { if (!tiltFrame) tiltFrame = requestAnimationFrame(tiltStep); }
  function resetTilt() {
    tilt.forEach(state => { state.tx = state.ty = state.tl = 0; });
    startTilt();
  }
  cards.forEach((card, i) => {
    card.addEventListener('click', () => {
      const nearest = i + Math.round((turn - i) / n) * n;
      if (Math.abs(turn - nearest) > .04) glide(nearest);
      else animateObject(card, i);
    });
    card.addEventListener('pointermove', e => {
      if (e.pointerType !== 'mouse' || reduced.matches || drag?.moved || frame) return;
      const rect = slots[i].getBoundingClientRect();
      tilt[i].tx = clamp((e.clientX - rect.left) / rect.width * 2 - 1, -1, 1);
      tilt[i].ty = clamp((e.clientY - rect.top) / rect.height * 2 - 1, -1, 1);
      tilt[i].tl = 1;
      startTilt();
    });
    card.addEventListener('pointerleave', () => {
      tilt[i].tx = tilt[i].ty = tilt[i].tl = 0;
      startTilt();
    });
  });
  reduced.addEventListener('change', () => {
    if (reduced.matches) {
      effects.forEach((animations, card) => { animations.forEach(animation => animation.cancel()); card.dataset.playing = 'false'; });
      effects.clear();
      glide(Math.round(destination));
    }
  });
  new ResizeObserver(resize).observe(stage);
  new IntersectionObserver(entries => {
    const visible = entries[0].isIntersecting;
    root.querySelectorAll('.strength-float').forEach(floater => { floater.style.animationPlayState = visible ? 'running' : 'paused'; });
    if (!visible) resetTilt();
  }).observe(root);
  resize();
  announce();
})();
