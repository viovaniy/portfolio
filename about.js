(() => {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  document.querySelectorAll('.about-toggle').forEach(card => {
    const summary = card.querySelector('summary');
    const body = card.querySelector('.about-body');
    let animation = null;
    let expanded = card.open;
    function settle() {
      animation?.cancel();
      animation = null;
      card.open = expanded;
      card.removeAttribute('data-closing');
      summary.setAttribute('aria-expanded', String(expanded));
    }
    summary.setAttribute('aria-expanded', String(expanded));
    summary.addEventListener('click', event => {
      event.preventDefault();
      const start = card.getBoundingClientRect().height;
      animation?.cancel();
      expanded = !expanded;
      summary.setAttribute('aria-expanded', String(expanded));
      card.toggleAttribute('data-closing', !expanded);
      // Keep content in layout until the entire card has finished shrinking.
      card.open = true;
      const border = 2;
      const end = summary.offsetHeight + (expanded ? body.offsetHeight : 0) + border;
      if (reduced.matches || typeof card.animate !== 'function') { settle(); return; }
      animation = card.animate([{height:`${start}px`},{height:`${end}px`}], {
        duration:360, easing:'cubic-bezier(.22,1,.36,1)'
      });
      animation.onfinish = settle;
    });
    // Let the content return to its natural height after resizing or interruption.
    window.addEventListener('resize', settle);
    reduced.addEventListener('change', settle);
  });
})();
