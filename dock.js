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

})();
