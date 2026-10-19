// Work: glass folders on a Finder-like desk. Click (or Space/Enter) opens a
// Quick Look window that springs out of the folder; arrows flip between
// projects, Space or Esc closes it, like macOS.
(() => {
  const folders = [...document.querySelectorAll('.wf')];
  const ql = document.getElementById('work-quicklook');
  if (!folders.length || !ql) return;
  const win = ql.querySelector('.ql-window');
  const scrim = ql.querySelector('.ql-scrim');
  const paper = ql.querySelector('.ql-paper');
  const title = ql.querySelector('#ql-title');
  const desc = ql.querySelector('.ql-desc');
  const field = key => ql.querySelector(`[data-ql="${key}"]`);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let current = -1, opened = false, motion = null;

  function select(index) {
    folders.forEach((f, i) => f.classList.toggle('is-selected', i === index));
  }

  function fill(index) {
    const f = folders[index], item = f.closest('.wf-item');
    const data = k => f.querySelector(`[data-k="${k}"]`)?.textContent || '';
    title.textContent = f.querySelector('.wf-name').textContent;
    desc.textContent = data('desc');
    field('kind').textContent = data('kind');
    field('tools').textContent = data('tools');
    ['--a', '--b', '--c'].forEach(v => win.style.setProperty(v, item.style.getPropertyValue(v)));
    paper.replaceChildren(f.querySelector('.loop').cloneNode(true));
  }

  // FLIP from the folder to the window, with a little liquid overshoot.
  function fromFolder(index) {
    const a = folders[index].querySelector('.wf-art').getBoundingClientRect();
    const b = win.getBoundingClientRect();
    const dx = a.left + a.width / 2 - (b.left + b.width / 2);
    const dy = a.top + a.height / 2 - (b.top + b.height / 2);
    return `translate(${dx}px, ${dy}px) scale(${a.width / b.width}, ${a.height / b.height})`;
  }

  function open(index) {
    current = index;
    select(index);
    fill(index);
    folders.forEach((f, i) => f.classList.toggle('is-open', i === index));
    ql.hidden = false;
    opened = true;
    document.documentElement.classList.add('ql-open');
    motion?.forEach(m => m.cancel());
    if (!reduced.matches) {
      const start = fromFolder(index);
      motion = [
        win.animate([
          { transform: start, opacity: .4, borderRadius: '14px' },
          { transform: 'scale(1.025, .985)', opacity: 1, offset: .55, borderRadius: '24px', easing: 'cubic-bezier(.45,0,.55,1)' },
          { transform: 'scale(.995, 1.008)', offset: .8, easing: 'cubic-bezier(.45,0,.55,1)' },
          { transform: 'none', opacity: 1, borderRadius: '24px' }
        ], { duration: 620, easing: 'cubic-bezier(.22,.9,.3,1)' }),
        scrim.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300, easing: 'ease' })
      ];
    }
    win.focus({ preventScroll: true });
  }

  function close() {
    if (!opened) return;
    opened = false;
    const index = current;
    const done = () => {
      ql.hidden = true;
      folders[index].classList.remove('is-open');
      document.documentElement.classList.remove('ql-open');
    };
    folders[index].focus({ preventScroll: true });
    motion?.forEach(m => m.cancel());
    if (reduced.matches) { done(); return; }
    const end = fromFolder(index);
    motion = [
      win.animate([{ transform: 'none', opacity: 1 }, { transform: end, opacity: 0 }], { duration: 280, easing: 'cubic-bezier(.4,0,.7,.2)', fill: 'forwards' }),
      scrim.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 260, easing: 'ease', fill: 'forwards' })
    ];
    motion[0].onfinish = () => { motion.forEach(m => m.cancel()); done(); };
  }

  function step(dir) {
    const next = (current + dir + folders.length) % folders.length;
    folders[current].classList.remove('is-open');
    current = next;
    folders[next].classList.add('is-open');
    select(next);
    fill(next);
    win.style.setProperty('--dir', dir);
    win.classList.remove('is-swap'); void win.offsetWidth; win.classList.add('is-swap');
  }

  folders.forEach((f, i) => {
    f.addEventListener('click', () => (opened && current === i ? close() : open(i)));
    f.addEventListener('focus', () => { if (!opened) select(i); });
  });
  ql.querySelectorAll('[data-ql-close]').forEach(el => el.addEventListener('click', close));
  ql.querySelectorAll('.ql-step').forEach(b => b.addEventListener('click', () => step(Number(b.dataset.step))));

  document.addEventListener('keydown', e => {
    if (opened) {
      if (e.key === 'Escape' || e.key === ' ') { e.preventDefault(); close(); }
      else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); step(1); }
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); step(-1); }
      else if (e.key === 'Tab') {
        // keep focus inside the window
        const items = [...win.querySelectorAll('button')];
        const first = items[0], last = items[items.length - 1];
        if (e.shiftKey && (document.activeElement === first || document.activeElement === win)) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
      return;
    }
    // On the desk: arrows move the selection between folders, like Finder.
    const at = folders.indexOf(document.activeElement);
    if (at < 0) return;
    const cols = getComputedStyle(folders[0].closest('.wf-grid')).gridTemplateColumns.split(' ').length;
    const move = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: cols, ArrowUp: -cols }[e.key];
    if (move) {
      const next = at + move;
      if (next >= 0 && next < folders.length) { e.preventDefault(); folders[next].focus(); }
    }
  });

  // Clicking empty desk space clears the selection.
  document.addEventListener('pointerdown', e => {
    if (!opened && !e.target.closest('.wf')) select(-1);
  });
})();

// Phones have no hover: folders on screen play their studies on their own.
(() => {
  if (matchMedia('(hover: hover)').matches || !('IntersectionObserver' in window)) return;
  const io = new IntersectionObserver(entries => entries.forEach(e => e.target.classList.toggle('is-live', e.isIntersecting)), { threshold: .6 });
  document.querySelectorAll('.wf').forEach(f => io.observe(f));
})();
