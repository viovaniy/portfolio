(() => {
  const scene = document.querySelector('.studio-scene');
  if (!scene) return;
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([entry]) => {
      scene.toggleAttribute('data-in-view', entry.isIntersecting);
    }).observe(scene);
  } else scene.setAttribute('data-in-view', '');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const transitions = new Map();
  const contentMotion = new Map();
  let selected = null;
  function animateCard(card, trigger, opening) {
    const previous = transitions.get(card);
    const current = previous ? {
      transform: getComputedStyle(card).transform,
      opacity: getComputedStyle(card).opacity,
      filter: getComputedStyle(card).filter
    } : null;
    previous?.cancel();
    contentMotion.get(card)?.forEach(animation => animation.cancel());
    card.hidden = false;
    card.inert = !opening;
    card.setAttribute('aria-hidden', String(!opening));
    const expanded = { transform: 'translateX(-50%) translateY(0) scale(1)', opacity: 1 };
    const folded = { transform: 'translateX(-50%) translateY(48px) scale(.96)', opacity: 0 };
    const complete = () => {
      card.hidden = !opening;
      transitions.delete(card);
    };
    if (reduced.matches) { complete(); return; }
    const animation = card.animate([
      current || (opening ? folded : expanded), opening ? expanded : folded
    ], {
      duration: opening ? 250 : 150,
      easing: 'cubic-bezier(.22,1,.36,1)'
    });
    transitions.set(card, animation);
    animation.onfinish = complete;
    const elements = [...card.querySelectorAll('.studio-client-head, .studio-client-tag-reveal, [id$="-description"]')];
    contentMotion.set(card, elements.map((element, index) => element.animate(
      opening ? [
        { opacity: 0, transform: 'translateY(12px)', filter: 'blur(3px)' },
        { opacity: 1, transform: 'translateY(0)', filter: 'blur(0px)' }
      ] : [{ opacity: 1 }, { opacity: 0 }],
      opening ? { duration: 500, delay: 80 + index * 40, easing: 'cubic-bezier(.22,1,.36,1)', fill: 'backwards' }
        : { duration: 200, easing: 'ease', fill: 'forwards' }
    )));
  }
  const closeCard = (restoreFocus = false) => {
    if (!selected) return;
    const trigger = selected;
    const card = document.getElementById(trigger.getAttribute('aria-controls'));
    if (restoreFocus || card.contains(document.activeElement)) trigger.focus({ preventScroll: true });
    trigger.setAttribute('aria-expanded', 'false');
    selected = null;
    animateCard(card, trigger, false);
  };
  scene.querySelectorAll('[data-client]').forEach(trigger => {
    trigger.addEventListener('click', () => {
      const wasSelected = selected === trigger;
      closeCard();
      if (wasSelected) return;
      const card = document.getElementById(trigger.getAttribute('aria-controls'));
      selected = trigger;
      trigger.setAttribute('aria-expanded', 'true');
      animateCard(card, trigger, true);
      card.focus({ preventScroll: true });
    });
  });
  reduced.addEventListener('change', () => {
    if (!reduced.matches) return;
    transitions.forEach(animation => animation.finish());
    contentMotion.forEach(animations => animations.forEach(animation => animation.finish()));
  });
  // Match the reference's minimum 150ms press feedback on touch controls.
  scene.querySelectorAll('.studio-client-card button').forEach(button => {
    let releaseTimer;
    button.addEventListener('pointerdown', event => {
      if (event.pointerType === 'mouse') return;
      const started = performance.now();
      clearTimeout(releaseTimer);
      button.classList.add('is-pressed');
      const release = () => {
        document.removeEventListener('pointerup', release, true);
        document.removeEventListener('pointercancel', release, true);
        releaseTimer = setTimeout(() => button.classList.remove('is-pressed'), Math.max(0, 150 - (performance.now() - started)));
      };
      document.addEventListener('pointerup', release, true);
      document.addEventListener('pointercancel', release, true);
    }, { passive: true });
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
