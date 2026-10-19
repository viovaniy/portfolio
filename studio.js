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
      clipPath: getComputedStyle(card).clipPath
    } : null;
    previous?.cancel();
    contentMotion.get(card)?.forEach(animation => animation.cancel());
    card.hidden = false;
    card.inert = !opening;
    card.setAttribute('aria-hidden', String(!opening));
    // A short popup travel toward the character, without a large scale jump.
    // Use layout coordinates so interrupted transitions keep a stable destination.
    const person = trigger.getBoundingClientRect();
    const stage = scene.getBoundingClientRect();
    const dx = person.left + person.width / 2 - stage.left - card.offsetLeft;
    const dy = person.top + person.height * .32 - stage.top - card.offsetTop - card.offsetHeight / 2;
    const distance = Math.hypot(dx, dy) || 1;
    const travel = distance; // the pill starts right at the character and flies out of them
    // Dynamic Island: the card grows out of a small pill near the character,
    // overshoots a touch (wider first, then taller) and settles like liquid.
    const ox = dx / distance * travel, oy = dy / distance * travel;
    const at = (x, y, sx, sy) => `translateX(-50%) translate(${x}px, ${y}px) scale(${sx}, ${sy})`;
    const pill = 'inset(38% 26% round 40px)', full = 'inset(0% 0% round 28px)';
    card.style.transformOrigin = 'center';
    const complete = () => {
      card.hidden = !opening;
      transitions.delete(card);
    };
    if (reduced.matches) { complete(); return; }
    const from = current ? [{ transform: current.transform, opacity: current.opacity, clipPath: current.clipPath }] : null;
    const frames = opening ? [
      ...(from || [{ offset: 0, transform: at(ox, oy, .62, .42), opacity: .5, clipPath: pill }]).map(k => ({ ...k, easing: 'cubic-bezier(.25,.75,.3,1)' })),
      { offset: .46, transform: at(0, 0, 1.035, .975), opacity: 1, clipPath: full, easing: 'cubic-bezier(.45,0,.55,1)' },
      { offset: .7, transform: at(0, 0, .992, 1.012), easing: 'cubic-bezier(.45,0,.55,1)' },
      { offset: .87, transform: at(0, 0, 1.003, .997), easing: 'cubic-bezier(.45,0,.55,1)' },
      { offset: 1, transform: at(0, 0, 1, 1), opacity: 1, clipPath: full }
    ] : [
      ...(from || [{ offset: 0, transform: at(0, 0, 1, 1), opacity: 1, clipPath: full }]),
      { offset: .3, transform: at(0, 0, 1.02, .97) },
      { offset: 1, transform: at(ox, oy, .6, .4), opacity: 0, clipPath: pill }
    ];
    const animation = card.animate(frames, opening
      ? { duration: 720, easing: 'linear' }
      : { duration: 280, easing: 'cubic-bezier(.4,0,.7,.2)' });
    transitions.set(card, animation);
    animation.onfinish = complete;
    const elements = [...card.querySelectorAll('.studio-client-head, .studio-client-tag-reveal, [id$="-description"]')];
    contentMotion.set(card, elements.map((element, index) => element.animate(
      opening ? [
        { opacity: 0, transform: 'translateY(12px)', filter: 'blur(3px)' },
        { opacity: 1, transform: 'translateY(0)', filter: 'blur(0px)' }
      ] : [{ opacity: 1 }, { opacity: 0 }],
      opening ? { duration: 500, delay: 170 + index * 45, easing: 'cubic-bezier(.22,1,.36,1)', fill: 'backwards' }
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
  // The project tag wobbles like a drop of liquid when the pointer reaches it.
  scene.querySelectorAll('.studio-client-project').forEach(tag => {
    let jelly;
    const wobble = () => {
      if (reduced.matches || jelly?.playState === 'running') return;
      jelly = tag.animate([
        { transform: 'scale(1, 1)' },
        { transform: 'scale(1.14, .88)', offset: .22 },
        { transform: 'scale(.94, 1.07)', offset: .44 },
        { transform: 'scale(1.04, .97)', offset: .64 },
        { transform: 'scale(.99, 1.01)', offset: .82 },
        { transform: 'scale(1, 1)' }
      ], { duration: 680, easing: 'cubic-bezier(.25,.6,.35,1)' });
    };
    tag.addEventListener('pointerenter', event => { if (event.pointerType === 'mouse') wobble(); });
    tag.addEventListener('click', wobble);
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
