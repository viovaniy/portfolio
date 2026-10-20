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
  // place the stack without any slide-in, then let the cards drop in from
  // above one onto another when the section first comes into view
  stack.classList.add('no-anim');
  layout(false);
  void stack.offsetWidth;
  requestAnimationFrame(() => stack.classList.remove('no-anim'));
  if (!reduced.matches && 'IntersectionObserver' in window) {
    stack.classList.add('is-waiting');
    const io = new IntersectionObserver(([en]) => {
      if (!en.isIntersecting) return;
      io.disconnect();
      stack.classList.remove('is-waiting');
      [...cards].reverse().forEach((c, k) => {
        c.querySelector('.pd-link').animate([
          { transform: 'translateY(-90px)', opacity: 0 },
          { transform: 'translateY(0)', opacity: 1, offset: .55 },
          { transform: 'translateY(-6px)', offset: .78 },
          { transform: 'translateY(0)', opacity: 1 }
        ], { duration: 720, delay: k * 110, easing: 'cubic-bezier(.33,0,.2,1)', fill: 'backwards' });
      });
    }, { threshold: .35 });
    io.observe(stack);
  }

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
    const K = 170, D = 17, KR = 150, DR = 15;   // calmer: a soft overshoot, no long wobble
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
        // a gentle nudge, not a kick
        const power = reduced.matches ? 0 : 380 + Math.random() * 80;
        b.vx += dx * power; b.vy += dy * power;
        b.vr += (dx >= 0 ? 1 : -1) * (90 + Math.random() * 50);
        // the glass presses in where it was touched and a ring of light spreads out
        const tile = b.el.querySelector('i'), tr = tile.getBoundingClientRect();
        const gx = ((e.clientX - tr.left) / tr.width) * 100, gy = ((e.clientY - tr.top) / tr.height) * 100;
        const ring = document.createElement('span');
        ring.className = 'pd-ripple';
        ring.style.left = gx + '%'; ring.style.top = gy + '%';
        tile.append(ring);
        setTimeout(() => ring.remove(), 900);
        b.el.classList.remove('is-hit'); void b.el.offsetWidth; b.el.classList.add('is-hit', 'is-knock');
        if (!raf) raf = requestAnimationFrame(tick);
      });
    });
  }

})();
