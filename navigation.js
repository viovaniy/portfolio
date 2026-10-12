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

  const form = document.getElementById('project-brief');
  const review = document.getElementById('brief-review');
  const briefText = document.getElementById('brief-text');
  const status = document.getElementById('copy-status');
  form.hidden = false;
  form.addEventListener('submit', event => {
    event.preventDefault();
    const data = new FormData(form);
    const value = key => String(data.get(key) || '').trim();
    // The browser handles required fields; catch whitespace-only entries too.
    for (const name of ['name', 'contact', 'project']) {
      const field = form.elements.namedItem(name);
      field.setCustomValidity(value(name) ? '' : 'Please fill out this field.');
    }
    if (!form.reportValidity()) return;
    const message = [
      'Hi viovaniy! I’d like to discuss a motion project.',
      '',
      `Name: ${value('name')}`,
      `Contact: ${value('contact')}`,
      '',
      value('project'),
      '',
      `Budget: ${value('budget') || 'To be discussed'}`,
      `Timeline: ${value('timeline') || 'Flexible'}`
    ].join('\n');
    briefText.value = message;
    const url = new URL('https://t.me/designmevova');
    url.searchParams.set('text', message);
    document.getElementById('telegram-brief').href = url.href;
    status.textContent = '';
    review.hidden = false;
    document.getElementById('review-title').focus({ preventScroll: true });
    review.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' });
  });
  form.addEventListener('input', event => {
    if ('setCustomValidity' in event.target) event.target.setCustomValidity('');
    review.hidden = true;
  });
  document.getElementById('copy-brief').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(briefText.value);
      status.textContent = 'Copied. You can paste your brief in Telegram.';
    } catch {
      briefText.focus();
      briefText.select();
      status.textContent = 'Select and copy the brief above, then paste it in Telegram.';
    }
  });
})();
