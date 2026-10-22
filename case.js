// Case page: the film, its chapters (which double as the seek bar), the
// "scene by scene" list that follows the playhead, and frames that play the
// film from their own moment. One rAF loop runs only while the film plays.
(() => {
  const body = document.body;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const tr = s => (window.t ? window.t(s) : s);
  document.title = 'Fliq — viovaniy';

  // ---------- entrance (skipped for the film when it morphs in from the gallery) ----------
  body.classList.add('is-loading');
  addEventListener('pagereveal', e => { if (e.viewTransition) body.classList.add('via-vt'); });
  setTimeout(() => body.classList.remove('is-loading'), 1600);

  // ---------- back: return to the gallery exactly where you left it ----------
  document.querySelectorAll('[data-back]').forEach(a => a.addEventListener('click', e => {
    try {
      if (document.referrer && new URL(document.referrer).origin === location.origin && history.length > 1) {
        e.preventDefault(); history.back();
      }
    } catch {}
  }));

  // ---------- local nav: glass once scrolled, title once the big title has gone ----------
  const nav = document.querySelector('[data-nav]');
  const bigTitle = document.querySelector('.intro-title');
  const onScroll = () => {
    nav.classList.toggle('is-stuck', scrollY > 8);
    if (bigTitle) nav.classList.toggle('is-titled', bigTitle.getBoundingClientRect().bottom < 56);
  };
  addEventListener('scroll', onScroll, { passive: true }); onScroll();

  // ---------- the film ----------
  const film = document.querySelector('[data-film]');
  const v = film.querySelector('video');
  const rail = document.querySelector('[data-rail] .chapter-track');
  const chapters = [...rail.querySelectorAll('.chapter')];
  const beats = [...document.querySelectorAll('.beat')];
  const nowEl = document.querySelector('[data-now]');
  const starts = chapters.map(c => Number(c.dataset.start));
  let duration = 25.083;
  const mmss = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  const sizeChapters = () => chapters.forEach((c, i) => c.style.setProperty('--len', ((starts[i + 1] ?? duration) - starts[i]).toFixed(2)));
  sizeChapters();

  let current = -1, lastP = '', lastNow = '';
  function paint() {
    const t = v.currentTime || 0;
    let i = starts.length - 1; while (i > 0 && t < starts[i]) i--;
    if (i !== current) {
      current = i;
      chapters.forEach((c, k) => { c.classList.toggle('is-on', k === i); c.classList.toggle('is-done', k < i); if (k > i) c.style.setProperty('--p', 0); });
      beats.forEach((b, k) => { b.classList.toggle('is-on', k === i); b.setAttribute('aria-current', k === i ? 'true' : 'false'); });
    }
    const end = starts[i + 1] ?? duration;
    const p = Math.min(1, Math.max(0, (t - starts[i]) / (end - starts[i]))).toFixed(4);
    if (p !== lastP) { chapters[i].style.setProperty('--p', p); lastP = p; }
    const now = mmss(t);
    if (now !== lastNow) { nowEl.textContent = now; rail.setAttribute('aria-valuenow', Math.round(t)); rail.setAttribute('aria-valuetext', now); lastNow = now; }
  }
  let raf = 0;
  const loop = () => { paint(); raf = v.paused ? 0 : requestAnimationFrame(loop); };
  const kick = () => { if (!raf) raf = requestAnimationFrame(loop); };

  const setPaused = paused => {
    film.classList.toggle('is-paused', paused);
    film.querySelectorAll('[data-act="toggle"]').forEach(b => b.setAttribute('aria-label', tr(paused ? 'Play' : 'Pause')));
  };
  v.addEventListener('play', () => { setPaused(false); kick(); showUi(); });
  v.addEventListener('pause', () => { setPaused(true); paint(); });
  v.addEventListener('seeked', paint);
  v.addEventListener('loadedmetadata', () => { if (v.duration > 0) { duration = v.duration; sizeChapters(); } paint(); });
  let userPaused = false;
  const play = () => v.play().catch(() => setPaused(true));
  const toggle = () => { if (v.paused) { userPaused = false; play(); } else { userPaused = true; v.pause(); } };

  // start time handed over from the gallery (?t=12.3), so the film just carries on
  const t0 = parseFloat(new URLSearchParams(location.search).get('t'));
  if (t0 > 0 && t0 < 30) { const set = () => { v.currentTime = t0; }; v.readyState ? set() : v.addEventListener('loadedmetadata', set, { once: true }); }
  if (reduced.matches) setPaused(true); else play();

  // controls show on movement and fade after a moment of stillness while playing
  let uiTimer = 0;
  function showUi() {
    film.classList.add('is-ui');
    clearTimeout(uiTimer);
    uiTimer = setTimeout(() => { if (!v.paused) film.classList.remove('is-ui'); }, 2200);
  }
  film.addEventListener('pointermove', showUi);
  film.addEventListener('click', e => {
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'full') { full(); return; }
    // touch: the first tap only wakes the controls, the next one pauses
    if (!act && matchMedia('(hover: none)').matches && !film.classList.contains('is-ui') && !v.paused) { showUi(); return; }
    toggle(); showUi();
  });
  function full() {
    const el = film;
    if (document.fullscreenElement) document.exitFullscreen?.();
    else if (el.requestFullscreen) el.requestFullscreen().catch(() => v.webkitEnterFullscreen?.());
    else v.webkitEnterFullscreen?.();   // iPhone Safari
  }
  document.addEventListener('keydown', e => {
    if (e.target.closest('input,textarea,[contenteditable]')) return;
    const r = film.getBoundingClientRect();
    if (r.bottom < 0 || r.top > innerHeight) return;
    if (e.key === ' ' && !e.target.closest('button,a')) { e.preventDefault(); toggle(); showUi(); }
  });

  // ---------- seek: chapters, drag along the track, keys ----------
  function seek(t, autoplay = true) {
    v.currentTime = Math.max(0, Math.min(duration - .05, t));
    paint();
    if (autoplay && v.paused && !reduced.matches) { userPaused = false; play(); }
  }
  const timeAt = x => {
    // the track is made of chapter segments with small gaps: map x onto them
    for (let i = 0; i < chapters.length; i++) {
      const r = chapters[i].querySelector('i').getBoundingClientRect();
      const end = starts[i + 1] ?? duration;
      if (x <= r.right + 3 || i === chapters.length - 1) return starts[i] + Math.min(1, Math.max(0, (x - r.left) / r.width)) * (end - starts[i]);
    }
    return 0;
  };
  let grab = null;
  rail.addEventListener('pointerdown', e => {
    grab = { id: e.pointerId, x: e.clientX, moved: false, wasPaused: v.paused };
    rail.classList.add('is-grab');
    try { rail.setPointerCapture(e.pointerId); } catch {}
  });
  rail.addEventListener('pointermove', e => {
    if (!grab || e.pointerId !== grab.id) return;
    if (!grab.moved && Math.abs(e.clientX - grab.x) < 4) return;
    grab.moved = true;
    v.currentTime = timeAt(e.clientX); paint();
  });
  const drop = e => {
    if (!grab) return;
    const g = grab; grab = null; rail.classList.remove('is-grab');
    if (!g.moved) {
      // a tap: jump to the start of that chapter
      const ch = e.target.closest?.('.chapter') || document.elementFromPoint(e.clientX, e.clientY)?.closest('.chapter');
      if (ch) seek(Number(ch.dataset.start));
    } else if (!g.wasPaused) play();
  };
  rail.addEventListener('pointerup', drop);
  rail.addEventListener('pointercancel', () => { grab = null; rail.classList.remove('is-grab'); });
  rail.addEventListener('keydown', e => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); seek(v.currentTime + (e.key === 'ArrowRight' ? 5 : -5), false); }
  });

  // ---------- "scene by scene" rows and frames play from their moment ----------
  const bringFilm = () => {
    const r = film.getBoundingClientRect();
    if (r.top < 56 || r.bottom > innerHeight) scrollTo({ top: Math.max(0, scrollY + r.top - 72), behavior: reduced.matches ? 'auto' : 'smooth' });
  };
  beats.forEach(b => b.addEventListener('click', () => seek(Number(b.dataset.start))));
  document.querySelectorAll('.shot').forEach(s => s.addEventListener('click', () => { seek(Number(s.dataset.start)); bringFilm(); }));

  // ---------- palette: tap a chip to copy its colour ----------
  const toast = document.querySelector('.case-toast');
  let toastTimer = 0;
  document.querySelectorAll('.swatch').forEach(s => s.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(s.dataset.hex); } catch {}
    toast.textContent = tr('Copied {hex}').replace('{hex}', s.dataset.hex);
    toast.classList.add('is-on'); clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('is-on'), 1600);
  }));

  // ---------- frames arrive once, gently staggered by position ----------
  const tiles = [...document.querySelectorAll('.bento > *')];
  if ('IntersectionObserver' in window && !reduced.matches) {
    tiles.forEach(t => t.classList.add('reveal'));
    const io = new IntersectionObserver(entries => entries.forEach(en => {
      if (!en.isIntersecting) return;
      const r = en.target.getBoundingClientRect();
      en.target.style.setProperty('--d', `${Math.round((r.left / innerWidth) * 160)}ms`);
      en.target.classList.add('is-in'); io.unobserve(en.target);
    }), { rootMargin: '0px 0px -8% 0px' });
    tiles.forEach(t => io.observe(t));
  }

  // ---------- the film rests when nobody can see it ----------
  let seen = true;
  new IntersectionObserver(([en]) => {
    seen = en.isIntersecting;
    if (!seen && !v.paused) { v.pause(); film.dataset.autoPaused = '1'; }
    else if (seen && film.dataset.autoPaused && !userPaused) { delete film.dataset.autoPaused; play(); }
  }, { threshold: .15 }).observe(film);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && !v.paused) { v.pause(); film.dataset.autoPaused = '1'; }
    else if (!document.hidden && seen && film.dataset.autoPaused && !userPaused) { delete film.dataset.autoPaused; play(); }
  });
  paint();
})();
