(() => {
  const links = [...document.querySelectorAll('.bottom-nav a')];
  const sections = [...document.querySelectorAll('main > .page-section')];
  let pending = false;
  let navigating = false;
  let scrollTimer;
  let labelTimer;

  function selectSection(hash) {
    for (const link of links) {
      if (link.hash === hash) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    }
  }

  function hideTappedLabel() {
    clearTimeout(labelTimer);
    links.forEach(link => link.classList.remove('is-tapped'));
  }

  function finishNavigation() {
    clearTimeout(scrollTimer);
    navigating = false;
    scheduleUpdate();
  }

  for (const link of links) {
    // A tap may keep its label briefly; moving to another item cancels it.
    link.addEventListener('pointerenter', hideTappedLabel);
    link.addEventListener('pointerleave', event => {
      if (event.pointerType !== 'touch') hideTappedLabel();
    });
    link.addEventListener('focus', hideTappedLabel);
    link.addEventListener('click', event => {
      if (event.defaultPrevented || event.button > 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const destination = document.querySelector(link.hash);
      if (!destination) return;
      event.preventDefault();
      // Keep selection immediate while the page takes a gentler path to it.
      navigating = true;
      selectSection(link.hash);
      hideTappedLabel();
      link.classList.add('is-tapped');
      labelTimer = setTimeout(hideTappedLabel, 500);
      clearTimeout(scrollTimer);
      if (location.hash !== link.hash) history.pushState(null, '', link.hash);
      if (window.siteScroll) window.siteScroll.to(destination, finishNavigation);
      else { destination.scrollIntoView({ behavior: 'smooth' }); scrollTimer = setTimeout(finishNavigation, 1400); }
    });
  }

  function updateActiveSection() {
    pending = false;
    if (navigating) return;
    let current = sections[0];
    for (const section of sections) {
      if (section.getBoundingClientRect().top <= innerHeight * 0.36) current = section;
    }
    if (!current) return;
    selectSection(`#${current.id}`);
  }
  function scheduleUpdate() {
    if (!pending) {
      pending = true;
      requestAnimationFrame(updateActiveSection);
    }
  }
  window.addEventListener('scroll', () => {
    if (navigating && !window.siteScroll) {
      // Resume scroll tracking after the anchor animation has settled.
      clearTimeout(scrollTimer);
      scrollTimer = setTimeout(finishNavigation, 160);
    }
    scheduleUpdate();
  }, { passive: true });
  function interruptNavigation(event) {
    if (event.target.closest?.('.bottom-nav')) return;
    hideTappedLabel();
    finishNavigation();
  }
  window.addEventListener('wheel', interruptNavigation, { passive: true });
  window.addEventListener('touchstart', interruptNavigation, { passive: true });
  window.addEventListener('pointerdown', interruptNavigation, { passive: true });
  window.addEventListener('keydown', event => {
    if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '].includes(event.key)) interruptNavigation(event);
  });
  window.addEventListener('resize', scheduleUpdate);
  window.addEventListener('pageshow', scheduleUpdate);
  updateActiveSection();

})();
