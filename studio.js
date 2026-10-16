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
    // Anchor the scale to the character, outside the card's own rectangle.
    const person = trigger.getBoundingClientRect();
    const stage = scene.getBoundingClientRect();
    const x = person.left + person.width / 2 - stage.left - card.offsetLeft + card.offsetWidth / 2;
    const y = person.top + person.height * .6 - stage.top - card.offsetTop;
    card.style.transformOrigin = `${x}px ${y}px`;
    const expanded = { transform: 'translateX(-50%) scale(1)', opacity: 1, filter: 'blur(0px)' };
    const folded = { transform: 'translateX(-50%) scale(.12)', opacity: 0, filter: 'blur(3px)' };
    const complete = () => {
      card.hidden = !opening;
      transitions.delete(card);
    };
    if (reduced.matches) { complete(); return; }
    const animation = card.animate([
      current || (opening ? folded : expanded), opening ? expanded : folded
    ], {
      duration: opening ? 430 : 280,
      easing: opening ? 'cubic-bezier(.16,1,.3,1)' : 'cubic-bezier(.55,0,.8,.45)'
    });
    transitions.set(card, animation);
    animation.onfinish = complete;
    const elements = [...card.querySelectorAll('h2, .studio-client-project, [id$="-description"], .studio-client-close')];
    contentMotion.set(card, elements.map((element, index) => element.animate(
      opening ? [
        { opacity: 0, transform: 'translateY(7px)', filter: 'blur(5px)' },
        { opacity: 1, transform: 'translateY(0)', filter: 'blur(0px)' }
      ] : [{ opacity: 1 }, { opacity: 0 }],
      opening ? { duration: 340, delay: 70 + index * 45, easing: 'cubic-bezier(.22,1,.36,1)', fill: 'backwards' }
        : { duration: 150, fill: 'forwards' }
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
