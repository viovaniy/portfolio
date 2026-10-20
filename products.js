// Resources: a stack of product cards (like an iOS widget stack).
// It shuffles by itself — the front card flicks away and tucks in at the back —
// and fans out like a hand of cards when the pointer arrives. Every card and
// the button lead to the Whop store (set WHOP_URL below once the store is live).
(() => {
  const WHOP_URL = 'https://whop.com/viovaniy/';
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
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
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
      f.innerHTML = logo ? `<i><img src="${logo}" alt="" draggable="false"><span class="t-tilt-glare"></span></i>` : '<i><svg viewBox="0 0 24 24"><path d="M5 9.5h14l-1.2 9a1.5 1.5 0 0 1-1.5 1.3H7.7a1.5 1.5 0 0 1-1.5-1.3z"/><path d="M8.5 9.5V8a3.5 3.5 0 0 1 7 0v1.5"/></svg></i>';
      floaters.append(f);
    });
  }

  // Tap a floating icon: it gets knocked away from the pointer and spins,
  // then springs back home (bouncy, a little underdamped).
  if (floaters) {
    const bodies = [...floaters.querySelectorAll('.pd-float')].map(el => ({ el, x: 0, y: 0, r: 0, vx: 0, vy: 0, vr: 0 }));
    let raf = 0, last = 0;
    const K = 120, D = 9, KR = 90, DR = 7;
    function tick(now) {
      const dt = Math.min(.033, last ? (now - last) / 1000 : 1 / 60); last = now;
      let moving = false;
      bodies.forEach(b => {
        b.vx += (-K * b.x - D * b.vx) * dt; b.vy += (-K * b.y - D * b.vy) * dt; b.vr += (-KR * b.r - DR * b.vr) * dt;
        b.x += b.vx * dt; b.y += b.vy * dt; b.r += b.vr * dt;
        if (Math.abs(b.x) + Math.abs(b.y) + Math.abs(b.r) + Math.abs(b.vx) + Math.abs(b.vy) + Math.abs(b.vr) > .05) moving = true;
        else { b.x = b.y = b.r = b.vx = b.vy = b.vr = 0; b.el.classList.remove('is-knock'); }
        b.el.style.setProperty('--kx', b.x.toFixed(2) + 'px');
        b.el.style.setProperty('--ky', b.y.toFixed(2) + 'px');
        b.el.style.setProperty('--kr', b.r.toFixed(2) + 'deg');
      });
      raf = moving ? requestAnimationFrame(tick) : 0;
      if (!raf) last = 0;
    }
    // transitions.dev "card hover tilt": the icon leans toward the pointer
    // with a glare that follows it, then eases back flat (pointer tracked
    // on the flat .pd-float wrapper, the inner tile does the tilting).
    const MAX = 22;
    bodies.forEach(b => {
      const tile = b.el.querySelector('i');
      const reset = () => {
        b.el.classList.remove('is-hover'); tile.classList.remove('is-tilting');
        tile.style.setProperty('--tilt-rx', '0deg'); tile.style.setProperty('--tilt-ry', '0deg');
      };
      b.el.addEventListener('pointermove', e => {
        if (e.pointerType !== 'mouse' || reduced.matches) return;
        const r = b.el.getBoundingClientRect();
        const px = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
        const py = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
        b.el.classList.add('is-hover'); tile.classList.add('is-tilting');
        tile.style.setProperty('--tilt-ry', ((px - .5) * MAX).toFixed(2) + 'deg');
        tile.style.setProperty('--tilt-rx', ((.5 - py) * MAX).toFixed(2) + 'deg');
        tile.style.setProperty('--tilt-gx', (px * 100).toFixed(1) + '%');
        tile.style.setProperty('--tilt-gy', (py * 100).toFixed(1) + '%');
      });
      b.el.addEventListener('pointerleave', reset);
    });
    bodies.forEach(b => {
      b.el.addEventListener('pointerdown', e => {
        e.preventDefault();
        const r = b.el.getBoundingClientRect();
        let dx = r.left + r.width / 2 - e.clientX, dy = r.top + r.height / 2 - e.clientY;
        const len = Math.hypot(dx, dy) || 1; dx /= len; dy /= len;
        const power = reduced.matches ? 0 : 900 + Math.random() * 300;
        b.vx += dx * power; b.vy += dy * power - 200;
        b.vr += (dx >= 0 ? 1 : -1) * (520 + Math.random() * 380);
        b.el.classList.remove('is-hit'); void b.el.offsetWidth; b.el.classList.add('is-hit', 'is-knock');
        if (!raf) raf = requestAnimationFrame(tick);
      });
    });
  }

})();
