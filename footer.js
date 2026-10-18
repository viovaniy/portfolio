// Footer: current year and a smooth back-to-top that uses the site's scroller.
(() => {
  const footer = document.querySelector('.site-footer');
  if (!footer) return;
  const year = footer.querySelector('[data-year]');
  if (year) year.textContent = new Date().getFullYear();
  footer.querySelector('.footer-top-btn')?.addEventListener('click', () => {
    const home = document.getElementById('home');
    if (window.siteScroll && home) window.siteScroll.to(home);
    else window.scrollTo({ top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
    history.replaceState(null, '', '#home');
  });
})();
