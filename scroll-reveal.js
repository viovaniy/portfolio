// Site-wide scroll reveals: things fade, rise and sharpen as they enter view,
// staggered within each batch. Plays once per element, then cleans up.
(() => {
  if (!('IntersectionObserver' in window)) return;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const groups = [
    // [selector, kind]
    ['.content-section .section-label', 'rise'],
    ['.work-section h2, .products-section h2, .contact-section h2', 'words'],
    ['.work-count, .work-note, .section-copy, .form-intro', 'rise'],
    ['.work-item', 'pop'],
    ['.gallery-footer', 'rise'],
    ['.products-section .contact-button', 'rise'],
    ['#project-brief .brief-line, #project-brief .brief-actions', 'rise'],
    ['.brief-preview', 'pop'],
    ['.footer-title', 'rise'],
    ['.footer-start, .footer-col, .footer-bottom', 'rise'],
    ['.footer-wordmark', 'pop'],
    // The macOS window rises as one piece (its parts move together, so the
    // live glass blur keeps working); the sky behind it stays still.
    ['.about-glass', 'group']
  ];

  function splitWords(el) {
    const words = [];
    const wrap = node => {
      const clip = document.createElement('span');
      clip.className = 'sr-clip';
      const word = document.createElement('span');
      word.className = 'sr-word';
      word.append(node);
      clip.append(word);
      words.push(word);
      return clip;
    };
    for (const node of [...el.childNodes]) {
      if (node.nodeType === Node.TEXT_NODE) {
        const parts = node.textContent.split(/(\s+)/);
        const frag = document.createDocumentFragment();
        for (const part of parts) {
          if (!part) continue;
          frag.append(/^\s+$/.test(part) ? document.createTextNode(part) : wrap(document.createTextNode(part)));
        }
        node.replaceWith(frag);
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        // Punctuation spans and the like stick to the previous word.
        const prev = words[words.length - 1];
        if (prev && !/\s$/.test(node.previousSibling?.textContent || ' ')) prev.append(node);
        else node.replaceWith(wrap(node.cloneNode(true)));
      }
    }
    words.forEach((word, i) => word.style.setProperty('--w', i));
    el.classList.add('sr-words');
  }

  const items = [];
  for (const [selector, kind] of groups) {
    for (const el of document.querySelectorAll(selector)) {
      if (el.hasAttribute('data-sr')) continue;
      if (kind === 'words') splitWords(el);
      if (kind === 'group') {
        el.srParts = [...el.children].filter(child => !child.hidden);
        el.srParts.forEach(part => part.setAttribute('data-sr', 'window'));
        el.setAttribute('data-sr-group', '');
        items.push(el);
        continue;
      }
      el.setAttribute('data-sr', kind === 'words' ? 'rise' : kind);
      items.push(el);
    }
  }

  const finish = el => {
    el.classList.remove('sr-in');
    el.removeAttribute('data-sr');
    el.style.removeProperty('--sr-delay');
  };
  const reveal = (el, delay) => {
    if (el.srParts) {
      el.removeAttribute('data-sr-group');
      // Frame and title bar together, then the title and the tabbed card.
      el.srParts.forEach(part => {
        const offset = part.matches('.about-heading') ? 70 : part.matches('.about-card') ? 130 : 0;
        reveal(part, delay + offset);
      });
      return;
    }
    el.style.setProperty('--sr-delay', `${delay}ms`);
    el.classList.add('sr-in');
    const last = el.classList.contains('sr-words') ? [...el.querySelectorAll('.sr-word')].pop() : el;
    const done = event => {
      if (event.target !== last) return;
      el.removeEventListener('animationend', done);
      finish(el);
    };
    el.addEventListener('animationend', done);
    // Safety net if an animation is skipped (e.g. element hidden meanwhile).
    setTimeout(() => { if (el.hasAttribute('data-sr')) finish(el); }, delay + 2500);
  };

  // Anything already scrolled past (deep link, reload mid-page) shows at once.
  for (const el of items) {
    if (el.getBoundingClientRect().bottom < 0) (el.srParts || [el]).forEach(finish), el.removeAttribute('data-sr-group');
  }

  const observer = new IntersectionObserver(entries => {
    const entering = entries.filter(e => e.isIntersecting).sort((a, b) =>
      (a.boundingClientRect.top - b.boundingClientRect.top) || (a.boundingClientRect.left - b.boundingClientRect.left));
    const batch = entering.map(entry => entry.target);
    // A carousel reveals as one row, including cards scrolled out of view.
    if (batch.some(el => el.matches('.work-item'))) {
      for (const el of document.querySelectorAll('.work-item[data-sr]:not(.sr-in)')) if (!batch.includes(el)) batch.push(el);
    }
    batch.forEach((el, i) => {
      observer.unobserve(el);
      reveal(el, Math.min(i * 80, 480));
    });
  }, { rootMargin: '0px 0px -10% 0px', threshold: 0.08 });
  items.filter(el => el.hasAttribute('data-sr') || el.hasAttribute('data-sr-group')).forEach(el => observer.observe(el));
})();
