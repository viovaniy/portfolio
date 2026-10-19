// Work — scroll is the playhead. The section is tall and one screen stays
// pinned inside it; page scroll moves the playhead across the timeline and
// the clip under it plays on the big screen. Clicking a clip jumps there,
// dragging the playhead scrubs, ← → step between clips.
// A clip can show a real film later: add data-video="assets/work/x.mp4"
// (optional data-poster) to its <li class="tl-clip">.
(() => {
  const section = document.getElementById('work');
  const pin = section?.querySelector('.tl-pin');
  if (!pin) return;
  const clips = [...section.querySelectorAll('.tl-clip')];
  const screen = section.querySelector('.tl-screen');
  const stage = section.querySelector('.tl-stage');
  const caption = section.querySelector('.tl-caption');
  const track = section.querySelector('.tl-clips');
  const playhead = section.querySelector('.tl-playhead');
  const time = section.querySelector('.tl-time');
  const field = k => section.querySelector(`[data-tl="${k}"]`);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const durs = clips.map(c => Number(c.dataset.dur) || 20);
  const total = durs.reduce((a, b) => a + b, 0);
  const starts = durs.map((_, i) => durs.slice(0, i).reduce((a, b) => a + b, 0));
  const FPS = 25;
  let active = -1;

  const range = () => Math.max(1, section.offsetHeight - pin.offsetHeight);
  const top = () => section.getBoundingClientRect().top + scrollY;
  const progress = () => Math.min(1, Math.max(0, (scrollY - top()) / range()));
  const pad = n => String(n).padStart(2, '0');
  const timecode = t => { const f = Math.floor(t * FPS); return `${pad(Math.floor(f / FPS / 60))}:${pad(Math.floor(f / FPS) % 60)}:${pad(f % FPS)}`; };

  function media(clip) {
    if (clip.dataset.video) {
      const v = document.createElement('video');
      Object.assign(v, { src: clip.dataset.video, muted: true, loop: true, autoplay: true, playsInline: true });
      v.setAttribute('playsinline', '');
      if (clip.dataset.poster) v.poster = clip.dataset.poster;
      return v;
    }
    return clip.querySelector('template').content.firstElementChild.cloneNode(true);
  }

  function cut(index) {
    if (index === active) return;
    const clip = clips[index];
    const data = k => clip.querySelector(`[data-k="${k}"]`)?.textContent || '';
    clips.forEach((c, i) => c.classList.toggle('is-active', i === index));
    ['--a', '--b', '--c'].forEach(v => screen.style.setProperty(v, clip.style.getPropertyValue(v)));
    caption.querySelector('.tl-title').textContent = clip.querySelector('.tl-clip-name').textContent;
    caption.querySelector('.tl-desc').textContent = data('desc');
    field('kind').textContent = data('kind');
    field('tools').textContent = data('tools');
    field('index').textContent = index + 1;
    const next = media(clip);
    const old = [...stage.children];
    if (active < 0 || reduced.matches) old.forEach(n => n.remove());
    else {
      old.forEach(n => { n.classList.add('is-out'); setTimeout(() => n.remove(), 320); });
      next.classList.add('is-in');
      caption.classList.remove('is-in'); void caption.offsetWidth; caption.classList.add('is-in');
    }
    stage.append(next);
    active = index;
  }

  function render() {
    const p = progress();
    const t = p * total;
    playhead.style.transform = `translateX(${p * track.clientWidth}px)`;
    time.textContent = timecode(t);
    // keep the timecode label inside the panel near the right end
    time.style.transform = p > .82 ? 'translateX(calc(-100% - 24px))' : '';
    let index = starts.findIndex((s, i) => t >= s && t < s + durs[i]);
    if (index < 0) index = clips.length - 1;
    cut(index);
    section.classList.toggle('is-scrubbing', p > .015);
  }

  let frame = 0;
  const schedule = () => { if (!frame) frame = requestAnimationFrame(() => { frame = 0; render(); }); };
  addEventListener('scroll', schedule, { passive: true });
  addEventListener('resize', schedule);

  // Jump to a moment on the timeline (the middle of a clip, or any time t).
  function seek(t, smooth = true) {
    const y = top() + (Math.min(total - .01, Math.max(0, t)) / total) * range();
    if (smooth && !reduced.matches && window.siteScroll) {
      const marker = document.createElement('div');
      marker.style.cssText = `position:absolute;left:0;top:${y - top()}px;height:1px;width:1px;pointer-events:none`;
      section.append(marker);
      window.siteScroll.to(marker, () => marker.remove());
      setTimeout(() => marker.remove(), 1600);
    } else scrollTo({ top: y, behavior: smooth && !reduced.matches ? 'smooth' : 'instant' });
  }
  const middle = i => starts[i] + durs[i] * .5;
  clips.forEach((c, i) => c.querySelector('.tl-clip-btn').addEventListener('click', () => seek(middle(i))));

  // Drag the playhead (or anywhere on the track) to scrub.
  let dragging = false;
  const scrubTo = x => {
    const r = track.getBoundingClientRect();
    seek(Math.min(1, Math.max(0, (x - r.left) / r.width)) * total, false);
  };
  playhead.addEventListener('pointerdown', e => { dragging = true; playhead.setPointerCapture(e.pointerId); e.preventDefault(); });
  playhead.addEventListener('pointermove', e => { if (dragging) scrubTo(e.clientX); });
  playhead.addEventListener('pointerup', () => { dragging = false; });
  playhead.addEventListener('pointercancel', () => { dragging = false; });

  // ← → step clip by clip while the work screen is pinned.
  document.addEventListener('keydown', e => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName)) return;
    const r = section.getBoundingClientRect();
    if (r.top > 2 || r.bottom < innerHeight - 2) return;
    e.preventDefault();
    const next = Math.min(clips.length - 1, Math.max(0, active + (e.key === 'ArrowRight' ? 1 : -1)));
    seek(middle(next));
  });

  render();
})();
