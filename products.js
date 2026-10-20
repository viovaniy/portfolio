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

  // Floating 3D marks in the sky: big and sharp near the edges, smaller,
  // blurrier and fainter towards the middle; each levitates on its own rhythm.
  // To show a real logo, set data-logo="assets/whop-logo.svg" on .pd-floaters.
  const floaters = section.querySelector('.pd-floaters');
  if (floaters) {
    const logo = floaters.dataset.logo;
    const spots = [
      [4, 16, 150, -14, 22, 0], [9, 90, 96, 10, -18, 1], [2, 74, 120, -6, 30, 0], [22, 28, 64, 18, 12, 2],
      [92, 20, 140, 12, -24, 0], [82, 62, 104, -10, 20, 1], [96, 78, 118, 8, -28, 0], [75, 32, 60, -16, -14, 2]
    ];
    spots.forEach(([x, y, size, rz, ry, depth], i) => {
      const f = document.createElement('span');
      f.className = `pd-float d${depth}`;
      f.style.cssText = `left:${x}%;top:${y}%;--s:${size}px;--rz:${rz}deg;--ry:${ry}deg;--dur:${7 + (i % 4) * 1.6}s;--delay:${-i * 1.3}s`;
      f.innerHTML = logo ? `<i><img src="${logo}" alt="" draggable="false"></i>` : '<i><svg viewBox="0 0 24 24"><path d="M5 9.5h14l-1.2 9a1.5 1.5 0 0 1-1.5 1.3H7.7a1.5 1.5 0 0 1-1.5-1.3z"/><path d="M8.5 9.5V8a3.5 3.5 0 0 1 7 0v1.5"/></svg></i>';
      floaters.append(f);
    });
  }

  layout();
  start();
})();
