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

  // Floating icons — all motion in one spring loop (no CSS transitions on the
  // tile), so hover tilt, tap knock, spin and squash can never fight:
  //  · hover: the tile leans toward the pointer (transitions.dev card-tilt feel)
  //    with a glare that follows it; leaving eases it back flat
  //  · tap: a gentle nudge away from the touch, a little spin, the glass
  //    squashes and a ring of light ripples out; everything springs home
  if (floaters) {
    const MAX = 22;
    const spring = (v, x, target, k, d, dt) => v + (k * (target - x) - d * v) * dt;
    const bodies = [...floaters.querySelectorAll('.pd-float')].map(el => ({
      el, tile: el.querySelector('i'),
      ry0: parseFloat(el.style.getPropertyValue('--ry')) || 0, rz0: parseFloat(el.style.getPropertyValue('--rz')) || 0,
      x: 0, y: 0, r: 0, vx: 0, vy: 0, vr: 0,
      tx: 0, ty: 0, vtx: 0, vty: 0, gtx: 0, gty: 0,
      s: 1, vs: 0, hover: false
    }));
    let raf = 0, last = 0;
    const draw = b => {
      b.tile.style.transform = `translate3d(${b.x.toFixed(2)}px,${b.y.toFixed(2)}px,0) perspective(1000px) rotateX(${(14 + b.tx).toFixed(2)}deg) rotateY(${(b.ry0 + b.ty).toFixed(2)}deg) rotate(${(b.rz0 + b.r).toFixed(2)}deg) scale(${b.s.toFixed(4)})`;
    };
    function tick(now) {
      const dt = Math.min(.032, last ? (now - last) / 1000 : 1 / 60); last = now;
      let busy = false;
      bodies.forEach(b => {
        for (let k = 0; k < 2; k++) {
          const h = dt / 2;
          b.vx = spring(b.vx, b.x, 0, 170, 17, h); b.vy = spring(b.vy, b.y, 0, 170, 17, h); b.vr = spring(b.vr, b.r, 0, 150, 15, h);
          const tk = b.hover ? 70 : 26, td = b.hover ? 15 : 10;   // quick follow, slow return
          b.vtx = spring(b.vtx, b.tx, b.gtx, tk, td, h); b.vty = spring(b.vty, b.ty, b.gty, tk, td, h);
          b.vs = spring(b.vs, b.s, b.hover ? 1.05 : 1, 320, 20, h);
          b.x += b.vx * h; b.y += b.vy * h; b.r += b.vr * h; b.tx += b.vtx * h; b.ty += b.vty * h; b.s += b.vs * h;
        }
        const rest = Math.abs(b.x) + Math.abs(b.y) + Math.abs(b.r) + Math.abs(b.vx) + Math.abs(b.vy) + Math.abs(b.vr)
          + Math.abs(b.tx - b.gtx) + Math.abs(b.ty - b.gty) + Math.abs(b.vtx) + Math.abs(b.vty)
          + Math.abs(b.s - (b.hover ? 1.05 : 1)) + Math.abs(b.vs);
        if (rest > .01) busy = true;
        draw(b);
      });
      raf = busy ? requestAnimationFrame(tick) : 0;
      if (!raf) last = 0;
    }
    const wake = () => { if (!raf) raf = requestAnimationFrame(tick); };
    bodies.forEach(b => {
      draw(b);
      b.el.addEventListener('pointermove', e => {
        if (e.pointerType !== 'mouse' || reduced.matches) return;
        const r = b.el.getBoundingClientRect();
        const px = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
        const py = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
        b.hover = true; b.el.classList.add('is-hover');
        b.gty = (px - .5) * MAX; b.gtx = (.5 - py) * MAX;
        b.tile.style.setProperty('--tilt-gx', (px * 100).toFixed(1) + '%');
        b.tile.style.setProperty('--tilt-gy', (py * 100).toFixed(1) + '%');
        wake();
      });
      b.el.addEventListener('pointerleave', () => { b.hover = false; b.gtx = b.gty = 0; b.el.classList.remove('is-hover'); wake(); });
      b.el.addEventListener('pointerdown', e => {
        e.preventDefault();
        if (reduced.matches) return;
        const r = b.el.getBoundingClientRect();
        let dx = r.left + r.width / 2 - e.clientX, dy = r.top + r.height / 2 - e.clientY;
        const len = Math.hypot(dx, dy) || 1; dx /= len; dy /= len;
        const power = 380 + Math.random() * 80;
        b.vx += dx * power; b.vy += dy * power;
        b.vr += (dx >= 0 ? 1 : -1) * (90 + Math.random() * 50);
        b.vs -= 2.6;
        const tr = b.tile.getBoundingClientRect();
        const ring = document.createElement('span');
        ring.className = 'pd-ripple';
        ring.style.left = ((e.clientX - tr.left) / tr.width * 100) + '%';
        ring.style.top = ((e.clientY - tr.top) / tr.height * 100) + '%';
        b.tile.append(ring);
        setTimeout(() => ring.remove(), 900);
        b.el.classList.remove('is-flash'); void b.el.offsetWidth; b.el.classList.add('is-flash');
        wake();
      });
    });
  }

})();
