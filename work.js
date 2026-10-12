(() => {
  const track = document.querySelector('.work-track');
  if (!track) return;
  const items = [...track.children];
  const cards = [...track.querySelectorAll('.project-file')];
  const controls = [...document.querySelectorAll('.gallery-control')];
  const position = document.querySelector('.gallery-position');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const rows = 2;
  const viewport = track.closest('.work-window');
  let geometry = {width:0, max:0, step:0, items:[]};
  let followPosition = 0;
  let followTime = 0;
  let following = false;
  let drag = null;
  let suppressUntil = 0;
  let frame = 0;
  let updateFrame = 0;
  let scrollTimer = 0;
  let scrolling = false;
  let destination = null;
  const maxScroll = () => geometry.max;
  const clamp = value => Math.max(0, Math.min(value, maxScroll()));
  const stride = () => geometry.step;
  function measure() {
    const bounds = track.getBoundingClientRect();
    const left = track.scrollLeft;
    const measured = items.map(item => {
      const rect = item.getBoundingClientRect();
      return {left:rect.left - bounds.left + left, width:rect.width};
    });
    geometry = {width:track.clientWidth,max:Math.max(0,track.scrollWidth-track.clientWidth),step:measured[rows] ? measured[rows].left-measured[0].left : 0,items:measured};
    viewport.style.setProperty('--edge-fade', `${Math.min(80,Math.max(28,geometry.width*.08))}px`);
    schedulePosition();
  }
  function stops() {
    const step = stride();
    const values = [0];
    for (let column = 1; column < Math.ceil(items.length / rows); column++) {
      const value = clamp(column * step);
      if (value - values[values.length - 1] > 1) values.push(value);
    }
    if (maxScroll() - values[values.length - 1] > 1) values.push(maxScroll());
    return values;
  }
  function cancelMotion() {
    cancelAnimationFrame(frame);
    frame = 0;
    destination = null;
    following = false;
    followTime = 0;
  }
  function revealCard(card) {
    cards.forEach(item => {
      const expanded = String(item === card);
      if (item.getAttribute('aria-expanded') !== expanded) item.setAttribute('aria-expanded', expanded);
    });
  }
  function moveTo(left, released = false) {
    cancelMotion();
    revealCard(null);
    const start = track.scrollLeft;
    const end = clamp(left);
    const distance = end - start;
    if (reduced.matches || Math.abs(distance) < .5) {
      track.scrollLeft = end;
      schedulePosition();
      return;
    }
    destination = end;
    const duration = Math.min(700, 380 + Math.abs(distance) * .4);
    const started = performance.now();
    function step(now) {
      const t = Math.min(1, (now - started) / duration);
      // A released drag eases out; arrow navigation accelerates and settles softly.
      const ease = released ? 1 - (1 - t) ** 3 : t * t * t * (t * (t * 6 - 15) + 10);
      track.scrollLeft = start + distance * ease;
      if (t < 1) frame = requestAnimationFrame(step);
      else { frame = 0; destination = null; schedulePosition(); }
    }
    frame = requestAnimationFrame(step);
  }
  function updatePosition() {
    updateFrame = 0;
    const left = clamp(track.scrollLeft);
    const fade = Math.min(80,Math.max(28,geometry.width*.08));
    viewport.style.setProperty('--edge-left', Math.min(1,left/fade).toFixed(3));
    viewport.style.setProperty('--edge-right', Math.min(1,(maxScroll()-left)/fade).toFixed(3));
    const visible = [];
    geometry.items.forEach((item,index) => {
      const x = item.left-left;
      const width = Math.max(0,Math.min(x+item.width,geometry.width)-Math.max(x,0));
      if (width/item.width > .35) visible.push(index+1);
    });
    if (visible.length) {
      const text = `${String(visible[0]).padStart(2,'0')}–${String(visible[visible.length-1]).padStart(2,'0')} / ${String(cards.length).padStart(2,'0')}`;
      if (position.textContent !== text) position.textContent = text;
    }
    const current = destination ?? track.scrollLeft;
    controls[0].disabled = current < 1;
    controls[1].disabled = current >= maxScroll() - 1;
  }
  function schedulePosition() {
    if (!updateFrame) updateFrame = requestAnimationFrame(updatePosition);
  }
  track.addEventListener('scroll', () => {
    if (!scrolling) revealCard(null);
    scrolling = true;
    clearTimeout(scrollTimer);
    scrollTimer = setTimeout(() => { scrolling = false; }, 120);
    schedulePosition();
  }, {passive: true});
  controls.forEach(control => control.addEventListener('click', () => {
    const current = destination ?? track.scrollLeft;
    const points = stops();
    const next = Number(control.dataset.direction) > 0
      ? points.find(value => value > current + 1) ?? maxScroll()
      : [...points].reverse().find(value => value < current - 1) ?? 0;
    moveTo(next);
    schedulePosition();
  }));
  cards.forEach(card => {
    const hover = event => {
      if (event.pointerType === 'mouse' && !drag && !frame && !scrolling) revealCard(card);
    };
    card.addEventListener('pointerenter', hover);
    card.addEventListener('pointermove', hover);
    card.addEventListener('pointerleave', event => {
      if (event.pointerType === 'mouse' && !card.matches(':focus-visible')) card.setAttribute('aria-expanded', 'false');
    });
    card.addEventListener('focus', () => { if (card.matches(':focus-visible')) revealCard(card); });
    card.addEventListener('blur', () => card.setAttribute('aria-expanded', 'false'));
    card.addEventListener('click', event => {
      const show = event.pointerType === 'mouse' || card.getAttribute('aria-expanded') !== 'true';
      revealCard(show ? card : null);
    });
  });
  track.addEventListener('keydown', event => {
    const index = cards.indexOf(event.target.closest('.project-file'));
    if (index < 0) return;
    let next;
    if (event.key === 'ArrowRight') next = index + rows < cards.length ? index + rows : index;
    else if (event.key === 'ArrowLeft') next = Math.max(index % rows, index - rows);
    else if (event.key === 'ArrowDown') next = index % rows === 0 && index + 1 < cards.length ? index + 1 : index;
    else if (event.key === 'ArrowUp') next = index % rows === 1 ? index - 1 : index;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = cards.length - 1;
    else return;
    event.preventDefault();
    cards[next].focus({preventScroll: true});
    const rect = cards[next].getBoundingClientRect();
    const bounds = track.getBoundingClientRect();
    if (rect.left < bounds.left || rect.right > bounds.right) moveTo(Math.floor(next / rows) * stride());
  });
  // Vertical wheel input belongs to the page. Sideways touch/trackpad swipes stay native.
  function followTo(left) {
    destination = clamp(left);
    if (reduced.matches) { track.scrollLeft = destination; schedulePosition(); return; }
    if (!following) { followPosition = track.scrollLeft; followTime = 0; following = true; }
    if (frame) return;
    function glide(now) {
      const dt = followTime ? Math.min(40, now - followTime) : 16.67;
      followTime = now;
      followPosition += (destination - followPosition) * (1 - Math.exp(-dt / 110));
      track.scrollLeft = followPosition;
      if (Math.abs(destination - followPosition) < .3) {
        track.scrollLeft = destination;
        cancelMotion();
        schedulePosition();
      } else frame = requestAnimationFrame(glide);
    }
    frame = requestAnimationFrame(glide);
  }
  track.addEventListener('pointerdown', event => {
    cancelMotion();
    suppressUntil = 0;
    if (event.pointerType !== 'mouse' || event.button !== 0 || !event.isPrimary) return;
    drag = {id:event.pointerId, x:event.clientX, scroll:track.scrollLeft, target:track.scrollLeft, moved:false, lastX:event.clientX, lastAt:performance.now(), velocity:0};
  });
  track.addEventListener('pointermove', event => {
    if (!drag || event.pointerId !== drag.id) return;
    const delta = event.clientX - drag.x;
    if (!drag.moved && Math.abs(delta) > 6) {
      drag.moved = true;
      revealCard(null);
      track.classList.add('is-dragging');
      try { track.setPointerCapture(event.pointerId); } catch { /* Window release still completes the gesture. */ }
    }
    if (!drag.moved) return;
    event.preventDefault();
    const now = performance.now();
    const elapsed = Math.max(1, now - drag.lastAt);
    drag.velocity = drag.velocity * .4 + (drag.lastX - event.clientX) / elapsed * .6;
    drag.lastX = event.clientX;
    drag.lastAt = now;
    drag.target = clamp(drag.scroll - delta);
    followTo(drag.target);
  });
  function finishDrag(event) {
    if (!drag || event.pointerId !== drag.id) return;
    const gesture = drag;
    drag = null;
    track.classList.remove('is-dragging');
    if (track.hasPointerCapture(event.pointerId)) track.releasePointerCapture(event.pointerId);
    if (!gesture.moved) return;
    suppressUntil = performance.now() + 350;
    if (event.type !== 'pointerup') { cancelMotion(); return; }
    const velocity = performance.now() - gesture.lastAt < 100 ? gesture.velocity : 0;
    const projected = clamp(gesture.target + Math.max(-1.2, Math.min(1.2, velocity)) * 90);
    const nearest = stops().reduce((best, value) => Math.abs(value - projected) < Math.abs(best - projected) ? value : best);
    followTo(nearest);
  }
  window.addEventListener('pointerup', finishDrag);
  window.addEventListener('pointercancel', finishDrag);
  track.addEventListener('lostpointercapture', finishDrag);
  track.addEventListener('click', event => {
    if (performance.now() >= suppressUntil) return;
    suppressUntil = 0;
    event.preventDefault();
    event.stopImmediatePropagation();
  }, true);
  window.addEventListener('resize', () => { cancelMotion(); measure(); });
  window.addEventListener('pagehide', cancelMotion);
  document.addEventListener('visibilitychange', () => { if (document.hidden) cancelMotion(); });
  reduced.addEventListener('change', cancelMotion);
  new ResizeObserver(() => { cancelMotion(); measure(); }).observe(track);
  measure();
})();
