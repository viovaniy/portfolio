(() => {
  const scene = document.querySelector('.studio-scene');
  if (!scene) return;
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([entry]) => {
      scene.toggleAttribute('data-in-view', entry.isIntersecting);
    }).observe(scene);
  } else scene.setAttribute('data-in-view', '');
  let selected = null;
  const closeCard = (restoreFocus = false) => {
    if (!selected) return;
    const trigger = selected;
    document.getElementById(trigger.getAttribute('aria-controls')).hidden = true;
    trigger.setAttribute('aria-expanded', 'false');
    selected = null;
    if (restoreFocus) trigger.focus({ preventScroll: true });
  };
  scene.querySelectorAll('[data-client]').forEach(trigger => {
    trigger.addEventListener('click', () => {
      const wasSelected = selected === trigger;
      closeCard();
      if (wasSelected) return;
      const card = document.getElementById(trigger.getAttribute('aria-controls'));
      selected = trigger;
      trigger.setAttribute('aria-expanded', 'true');
      card.hidden = false;
      card.focus({ preventScroll: true });
    });
  });
  scene.querySelectorAll('.studio-client-close').forEach(button => {
    button.addEventListener('click', () => closeCard(true));
  });
  document.addEventListener('click', event => {
    if (!event.target.closest('.studio-client, .studio-client-card')) closeCard();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && selected) { event.preventDefault(); closeCard(true); }
  });
})();
