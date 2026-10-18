// Footer: current year and a smooth back-to-top that uses the site's scroller.
(() => {
  const footer = document.querySelector('.site-footer');
  if (!footer) return;
  const year = footer.querySelector('[data-year]');
  if (year) year.textContent = new Date().getFullYear();
  // The wordmark fills the content width exactly, whatever the screen.
  const mark = footer.querySelector('.footer-wordmark');
  const fit = () => {
    mark.style.fontSize = '100px';
    const natural = [...mark.children].reduce((sum, letter) => sum + letter.getBoundingClientRect().width, 0);
    const room = mark.clientWidth;
    if (natural) mark.style.fontSize = `${Math.floor(100 * room / natural * 0.965)}px`;
  };
  if (mark) { new ResizeObserver(fit).observe(mark); document.fonts?.ready.then(fit); fit(); }
  footer.querySelector('.footer-top-btn')?.addEventListener('click', () => {
    const home = document.getElementById('home');
    if (window.siteScroll && home) window.siteScroll.to(home);
    else window.scrollTo({ top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
    history.replaceState(null, '', '#home');
  });
})();
