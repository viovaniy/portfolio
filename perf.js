// Performance: CSS animations in sections that are far off screen are paused
// (they resume, from where they were, a little before the section scrolls in),
// and films only play while they can actually be seen.
(() => {
  if (!('IntersectionObserver' in window)) return;
  const sections = [...document.querySelectorAll('main > .page-section, .site-footer')];
  const io = new IntersectionObserver(entries => {
    entries.forEach(en => en.target.toggleAttribute('data-offscreen', !en.isIntersecting));
  }, { rootMargin: '-1px 0px' });
  sections.forEach(s => io.observe(s));

  // Videos: pause when off screen or when the tab is hidden; resume if they were meant to play.
  const videos = [...document.querySelectorAll('video')];
  const seen = new Map();
  const sync = v => {
    const want = !v.dataset.userPaused && seen.get(v) && !document.hidden && !v.closest('.cg-slide:not(.is-active)');
    if (want && v.paused && v.autoplay !== false) v.play().catch(() => {});
    else if (!want && !v.paused) v.pause();
  };
  const vio = new IntersectionObserver(entries => entries.forEach(en => { seen.set(en.target, en.isIntersecting); sync(en.target); }), { threshold: .05 });
  videos.forEach(v => vio.observe(v));
  document.addEventListener('visibilitychange', () => videos.forEach(sync));
})();
