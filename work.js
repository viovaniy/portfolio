// Work, Finder "Gallery view": one large screen shows the current case;
// the folders underneath switch between cases (click, arrows, or swipe).
// A folder can carry a real film later: data-video="assets/work/x.mp4"
// (optional data-poster) — otherwise its code-drawn motion study is shown.
(() => {
  const section = document.getElementById('work');
  const folders = [...document.querySelectorAll('.wf')];
  const viewer = document.querySelector('.wv');
  if (!section || !folders.length || !viewer) return;
  const stage = viewer.querySelector('.wv-stage');
  const meta = viewer.querySelector('.wv-meta');
  const title = viewer.querySelector('.wv-title');
  const desc = viewer.querySelector('.wv-desc');
  const field = key => viewer.querySelector(`[data-wv="${key}"]`);
  const desk = document.querySelector('.work-desk');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let current = -1;

  function content(folder) {
    if (folder.dataset.video) {
      const video = document.createElement('video');
      Object.assign(video, { src: folder.dataset.video, muted: true, loop: true, autoplay: true, playsInline: true });
      if (folder.dataset.poster) video.poster = folder.dataset.poster;
      video.setAttribute('playsinline', '');
      return video;
    }
    return folder.querySelector('.loop').cloneNode(true);
  }

  function show(index, dir = 1, focus = false) {
    index = (index + folders.length) % folders.length;
    if (index === current) return;
    const folder = folders[index], item = folder.closest('.wf-item');
    const data = k => folder.querySelector(`[data-k="${k}"]`)?.textContent || '';
    folders.forEach((f, i) => {
      f.setAttribute('aria-selected', String(i === index));
      f.tabIndex = i === index ? 0 : -1;
    });
    ['--a', '--b', '--c'].forEach(v => viewer.style.setProperty(v, item.style.getPropertyValue(v)));
    title.textContent = folder.querySelector('.wf-name').textContent;
    desc.textContent = data('desc');
    field('kind').textContent = data('kind');
    field('tools').textContent = data('tools');

    const next = content(folder);
    const old = [...stage.children];
    stage.style.setProperty('--dir', dir);
    if (current < 0 || reduced.matches) old.forEach(n => n.remove());
    else {
      old.forEach(n => { n.classList.add('is-out'); setTimeout(() => n.remove(), 360); });
      next.classList.add('is-in');
      meta.classList.remove('is-in'); void meta.offsetWidth; meta.classList.add('is-in');
    }
    stage.append(next);
    current = index;
    if (focus) folder.focus({ preventScroll: true });
    // keep the chosen folder in view on the phone strip
    if (desk && desk.scrollWidth > desk.clientWidth) {
      const r = folder.getBoundingClientRect(), d = desk.getBoundingClientRect();
      desk.scrollBy({ left: r.left + r.width / 2 - (d.left + d.width / 2), behavior: reduced.matches ? 'auto' : 'smooth' });
    }
  }

  folders.forEach((f, i) => f.addEventListener('click', () => show(i, i > current ? 1 : -1)));
  viewer.querySelectorAll('.wv-arrow').forEach(b => b.addEventListener('click', () => {
    const d = Number(b.dataset.step); show(current + d, d);
  }));

  // Arrow keys: on the folder strip (tabs), or anywhere while the page is on screen.
  let onScreen = false;
  if ('IntersectionObserver' in window) new IntersectionObserver(([e]) => { onScreen = e.intersectionRatio > .5; }, { threshold: [0, .5, 1] }).observe(viewer);
  document.addEventListener('keydown', e => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    const inStrip = folders.includes(document.activeElement);
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName) || document.activeElement?.isContentEditable;
    if (!inStrip && (typing || !onScreen || section.contains(document.activeElement) === false && document.activeElement !== document.body)) return;
    e.preventDefault();
    const d = e.key === 'ArrowRight' ? 1 : -1;
    show(current + d, d, inStrip);
  });

  // Swipe on the screen.
  let start = null;
  stage.addEventListener('pointerdown', e => { start = { x: e.clientX, y: e.clientY }; });
  stage.addEventListener('pointerup', e => {
    if (!start) return;
    const dx = e.clientX - start.x, dy = e.clientY - start.y;
    start = null;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.3) show(current + (dx < 0 ? 1 : -1), dx < 0 ? 1 : -1);
  });
  stage.addEventListener('pointercancel', () => { start = null; });

  show(0);
})();
