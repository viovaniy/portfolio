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
  // A stack seen in perspective: each card behind is smaller and sits higher.
  // Hovering eases the stack apart a little and lifts the front card; there is
  // no switching — every card simply opens the Whop store.
  const STEP = 30, SCALE = .08;
  let visible = false;
  function layout(open) {
    cards.forEach((c, d) => {
      const y = -d * (open ? STEP * 1.55 : STEP);
      const sc = 1 - d * (open ? SCALE * .9 : SCALE) + (open && d === 0 ? .02 : 0);
      c.style.transform = `translate3d(-50%,calc(-50% + ${y}px),0) scale(${sc})`;
      c.style.zIndex = String(cards.length - d);
      c.style.setProperty('--depth', d);
    });
    stack.classList.toggle('is-open', open);
  }
  stack.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') layout(true); });
  stack.addEventListener('pointerleave', () => layout(false));
  stack.addEventListener('focusin', () => layout(true));
  stack.addEventListener('focusout', e => { if (!stack.contains(e.relatedTarget)) layout(false); });
  layout(false);

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

})();
