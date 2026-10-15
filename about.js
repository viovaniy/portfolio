(() => {
  const section = document.querySelector('.about-section');
  if (!section) return;
  const sizeBackdrop = () => section.style.setProperty('--about-viewport', `${document.documentElement.clientWidth}px`);
  sizeBackdrop();
  window.addEventListener('resize', sizeBackdrop, { passive: true });
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([entry]) => section.toggleAttribute('data-in-view', entry.isIntersecting)).observe(section);
  } else section.setAttribute('data-in-view', '');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const tabs = [...section.querySelectorAll('[role="tab"]')];
  const panels = [...section.querySelectorAll('[role="tabpanel"]')];
  let active = 0;
  let animation;
  function select(index, focus = false) {
    if (focus) tabs[index].focus();
    if (index === active) return;
    const direction = index > active ? 1 : -1;
    active = index;
    animation?.cancel();
    tabs.forEach((tab, i) => {
      tab.setAttribute('aria-selected', String(i === index));
      tab.tabIndex = i === index ? 0 : -1;
      panels[i].hidden = i !== index;
      panels[i].inert = i !== index;
    });
    if (!reduced.matches) animation = panels[index].animate([
      { opacity: 0, transform: `translateX(${direction * 12}px)` },
      { opacity: 1, transform: 'translateX(0)' }
    ], { duration: 300, easing: 'cubic-bezier(.22,1,.36,1)' });
  }
  tabs.forEach((tab, i) => {
    tab.addEventListener('click', () => select(i));
    tab.addEventListener('keydown', event => {
      let next;
      if (event.key === 'ArrowRight') next = (i + 1) % tabs.length;
      if (event.key === 'ArrowLeft') next = (i - 1 + tabs.length) % tabs.length;
      if (event.key === 'Home') next = 0;
      if (event.key === 'End') next = tabs.length - 1;
      if (next !== undefined) { event.preventDefault(); select(next, true); }
    });
  });
  reduced.addEventListener('change', () => animation?.cancel());
})();
