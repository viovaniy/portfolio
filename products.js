// Resources: a stack of product cards (like an iOS widget stack).
// It shuffles by itself — the front card flicks away and tucks in at the back —
// and fans out like a hand of cards when the pointer arrives. Every card and
// the button lead to the Whop store (set WHOP_URL below once the store is live).
(() => {
  const WHOP_URL = 'https://whop.com/';
  const section = document.getElementById('products');
  const stack = section?.querySelector('.pd-stack');
  if (!stack) return;
  section.querySelectorAll('[data-whop]').forEach(a => { a.href = WHOP_URL; });
  const cards = [...stack.querySelectorAll('.pd-card')];
  const n = cards.length;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let order = cards.map((_, i) => i);   // order[0] is the front card
  let fanned = false, lifted = -1, timer = 0, visible = false, busy = false;

  const stackPose = d => `translate3d(0,${-d * 16}px,0) scale(${1 - d * .055}) rotate(${d ? (d % 2 ? 1 : -1) * d * 1.6 : 0}deg)`;
  const fanSlots = [[0, 0, 0], [-1, 1, 1], [1, 1, 1], [-2, 2, 2], [2, 2, 2]];
  function fanPose(d, isLift) {
    const [side, ring] = fanSlots[d] || [0, 3];
    const w = stack.offsetWidth;
    const x = side * w * (ring === 1 ? .22 : .4), rot = side * (ring === 1 ? 5 : 9), y = ring * 12 - (isLift ? 22 : 0);
    return `translate3d(${x}px,${y}px,0) rotate(${rot}deg) scale(${isLift ? 1.03 : 1 - ring * .07})`;
  }

  function layout() {
    order.forEach((ci, d) => {
      const c = cards[ci];
      const isLift = fanned && ci === lifted;
      c.style.transform = fanned ? fanPose(d, isLift) : stackPose(d);
      c.style.zIndex = String(isLift ? 50 : n - d);
      c.style.opacity = !fanned && d > 3 ? '0' : '1';
      c.querySelector('.pd-link').tabIndex = fanned || d === 0 ? 0 : -1;
    });
    stack.classList.toggle('is-fanned', fanned);
  }

  // the front card flicks out to the side and tucks in at the back
  function cycle() {
    if (fanned || busy || reduced.matches || !visible || document.hidden) return;
    busy = true;
    const front = cards[order[0]];
    const from = front.style.transform;
    order = [...order.slice(1), order[0]];
    front.style.transition = 'none';
    front.style.zIndex = String(n + 1);
    const to = stackPose(n - 1);
    const anim = front.animate([
      { transform: from },
      { transform: 'translate3d(112%,-18px,0) rotate(13deg) scale(.97)', offset: .42, easing: 'cubic-bezier(.4,0,.2,1)' },
      { transform: to }
    ], { duration: 950, easing: 'cubic-bezier(.22,1,.36,1)' });
    // the others move up one step on their own spring transitions
    order.forEach((ci, d) => { if (ci !== order[n - 1]) { cards[ci].style.transform = stackPose(d); cards[ci].style.zIndex = String(n - d); } });
    setTimeout(() => { front.style.zIndex = '0'; }, 420);
    anim.onfinish = () => {
      front.style.transform = to;
      front.style.opacity = '0';
      void front.offsetWidth;
      front.style.transition = '';
      layout();
      busy = false;
    };
  }
  const start = () => { clearInterval(timer); timer = setInterval(cycle, 3200); };

  stack.addEventListener('pointerenter', e => { if (e.pointerType !== 'mouse') return; fanned = true; layout(); });
  stack.addEventListener('pointerleave', () => { fanned = false; lifted = -1; layout(); });
  cards.forEach((c, i) => {
    c.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse' && fanned) { lifted = i; layout(); } });
    c.addEventListener('focusin', () => { if (!fanned) { fanned = true; } lifted = i; layout(); });
  });
  stack.addEventListener('focusout', e => { if (!stack.contains(e.relatedTarget)) { fanned = false; lifted = -1; layout(); } });

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([en]) => {
      visible = en.isIntersecting;
      section.toggleAttribute('data-in-view', visible);
    }, { threshold: .2 }).observe(section);
  } else visible = true;

  layout();
  start();
})();
