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
  const glass = section.querySelector('.about-glass');
  const heading = section.querySelector('.about-heading');
  const description = section.querySelector('.about-panels');
  const minimize = section.querySelector('[data-window-action="minimize"]');
  const resize = section.querySelector('[data-window-action="resize"]');
  const folds = new Map();
  let minimized = false;
  let shake;
  // Keep the section (and its sky) a fixed height while the window changes,
  // so the background never resizes, re-rasterises or shifts the page.
  let lockedHeight = 0;
  function lockSection() {
    if (lockedHeight) return;
    lockedHeight = section.offsetHeight;
    section.style.minHeight = `${lockedHeight}px`;
  }
  window.addEventListener('resize', () => {
    if (minimized || glass.classList.contains('is-enlarged')) return;
    lockedHeight = 0;
    section.style.minHeight = '';
  }, { passive: true });

  const EASE = 'cubic-bezier(.32,.72,0,1)';
  function fold(element, closed) {
    const running = folds.get(element);
    const from = element.getBoundingClientRect().height;
    const opacity = running ? getComputedStyle(element).opacity : (closed ? '1' : '0');
    running?.cancel();
    element.hidden = false;
    element.style.height = '';
    const to = closed ? 0 : element.getBoundingClientRect().height;
    element.style.marginTop = '';
    const margin = getComputedStyle(element).marginTop;
    const fromMargin = running ? `${parseFloat(getComputedStyle(element).marginTop) || 0}px` : (closed ? margin : '0px');
    element.inert = closed;
    const finish = () => {
      element.hidden = closed;
      element.style.height = '';
      element.style.marginTop = '';
      element.style.overflow = '';
      element.style.willChange = '';
      folds.delete(element);
    };
    if (reduced.matches) { finish(); return; }
    element.style.overflow = 'hidden';
    element.style.willChange = 'opacity';
    // Content fades quickly while the frame settles, like a native window.
    const keyframes = closed
      ? [{ height: `${from}px`, marginTop: fromMargin, opacity }, { opacity: 0, offset: .45 }, { height: '0px', marginTop: '0px', opacity: 0 }]
      : [{ height: `${from}px`, marginTop: fromMargin, opacity }, { opacity: Number(opacity), offset: .3 }, { height: `${to}px`, marginTop: margin, opacity: 1 }];
    const motion = element.animate(keyframes, { duration: closed ? 420 : 480, easing: EASE });
    folds.set(element, motion);
    motion.onfinish = finish;
  }
  function setMinimized(value) {
    if (value === minimized) return;
    lockSection();
    minimized = value;
    minimize.setAttribute('aria-expanded', String(!value));
    minimize.setAttribute('aria-label', value ? 'Restore description' : 'Minimize description');
    fold(heading, value);
    fold(description, value);
  }
  minimize.addEventListener('click', () => setMinimized(!minimized));
  resize.addEventListener('click', () => {
    lockSection();
    const enlarged = glass.classList.toggle('is-enlarged');
    resize.setAttribute('aria-pressed', String(enlarged));
    resize.setAttribute('aria-label', enlarged ? 'Restore window size' : 'Enlarge window');
  });
  section.querySelector('[data-window-action="refuse"]').addEventListener('click', () => {
    shake?.cancel();
    if (reduced.matches) return;
    shake = glass.animate([0,-9,8,-6,4,-2,0].map(x => ({transform:`translateX(${x}px)`})),
      {duration:420,easing:'ease-in-out'});
  });
  let active = 0;
  let animation;
  let selectionTimer;
  const tablist = section.querySelector('.about-tabs');
  function positionSelection() {
    const tab = tabs[active];
    tablist.style.setProperty('--tab-left', `${tab.offsetLeft}px`);
    tablist.style.setProperty('--tab-width', `${tab.offsetWidth}px`);
  }
  positionSelection();
  new ResizeObserver(positionSelection).observe(tablist);
  function select(index, focus = false) {
    setMinimized(false);
    if (focus) tabs[index].focus();
    if (index === active) return;
    const direction = index > active ? 1 : -1;
    active = index;
    positionSelection();
    animation?.cancel();
    clearTimeout(selectionTimer);
    tabs.forEach((tab, i) => {
      tab.classList.remove('is-selecting');
      tab.setAttribute('aria-selected', String(i === index));
      tab.tabIndex = i === index ? 0 : -1;
      panels[i].hidden = i !== index;
      panels[i].inert = i !== index;
    });
    if (!reduced.matches) {
      tabs[index].classList.add('is-selecting');
      selectionTimer = setTimeout(() => tabs[index].classList.remove('is-selecting'), 480);
    }
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
  reduced.addEventListener('change', () => {
    animation?.cancel();
    shake?.cancel();
    if (reduced.matches) folds.forEach(motion => motion.finish());
  });
})();

// About tab: the word "click" plays a small burst on hover (mouse) or tap.
(() => {
  const word = document.querySelector('.me-click');
  if (!word) return;
  const play = () => {
    word.classList.remove('is-burst');
    void word.offsetWidth; // restart the animation
    word.classList.add('is-burst');
  };
  word.addEventListener('click', play);
  word.addEventListener('pointerenter', event => { if (event.pointerType === 'mouse') play(); });
  word.addEventListener('animationend', event => { if (event.target === word.querySelector('.me-burst i:last-child')) word.classList.remove('is-burst'); });
})();
