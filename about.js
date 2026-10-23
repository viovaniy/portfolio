(() => {
  const section = document.querySelector('.about-section');
  if (!section) return;
  // the page width without the scrollbar — the colour cards size from it
  const sizeBackdrop = () => document.documentElement.style.setProperty('--about-viewport', `${document.documentElement.clientWidth}px`);
  sizeBackdrop();
  window.addEventListener('resize', sizeBackdrop, { passive: true });
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([entry]) => {
      section.toggleAttribute('data-in-view', entry.isIntersecting);
      // Content entrance plays once, the first time the window is seen.
      if (entry.isIntersecting && !section.classList.contains('is-revealed')) {
        section.classList.add('is-revealed', 'is-first-reveal');
        setTimeout(() => section.classList.remove('is-first-reveal'), 1600);
      }
    }).observe(section);
  } else { section.setAttribute('data-in-view', ''); section.classList.add('is-revealed'); }
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
    // exact (fractional) height: offsetHeight rounds, and even a third of a
    // pixel resized the two huge cloud layers, forcing a full re-raster
    lockedHeight = section.getBoundingClientRect().height;
    section.style.height = `${lockedHeight}px`;
  }
  window.addEventListener('resize', () => {
    if (minimized || glass.classList.contains('is-enlarged')) return;
    lockedHeight = 0;
    section.style.height = '';
  }, { passive: true });

  const EASE = 'cubic-bezier(.32,.72,0,1)';
  // Minimize / restore without re-laying-out the content on every frame.
  // Only three cheap things move: the window frame and the white card change
  // height (their own boxes — nothing inside them reflows), and the card glides
  // up/down by the heading's height. The heading and the tab content just fade
  // on the GPU, and the card clips them while it shrinks. Layout is switched to
  // its final state once, at the start (closing: at the end).
  const card = section.querySelector('.about-card');
  const box = el => el.getBoundingClientRect();
  function setMinimized(value) {
    if (value === minimized) return;
    lockSection();
    minimized = value;
    minimize.setAttribute('aria-expanded', String(!value));
    minimize.setAttribute('aria-label', value ? 'Restore description' : 'Minimize description');
    // where everything is right now (also mid-animation)
    const from = { glass: box(glass).height, card: box(card).height, shift: box(card).top - box(glass).top,
      head: Number(getComputedStyle(heading).opacity), desc: Number(getComputedStyle(description).opacity) };
    folds.forEach(m => m.cancel()); folds.clear();
    [glass, card].forEach(el => { el.style.height = ''; el.style.overflow = ''; });
    // measure the open and the minimized layout once
    heading.hidden = description.hidden = false;
    const open = { glass: box(glass).height, card: box(card).height, shift: box(card).top - box(glass).top };
    heading.hidden = description.hidden = true;
    const shut = { glass: box(glass).height, card: box(card).height, shift: box(card).top - box(glass).top };
    const to = value ? shut : open;
    heading.inert = description.inert = value;
    const settle = () => {
      heading.hidden = description.hidden = value;
      [glass, card].forEach(el => { el.style.height = ''; el.style.overflow = ''; });
      section.classList.remove('is-window-moving');
      folds.clear();
    };
    if (reduced.matches) { settle(); return; }
    // the content stays laid out during the motion (it is only faded and clipped)
    heading.hidden = description.hidden = false;
    card.style.overflow = 'hidden';
    section.classList.add('is-window-moving');
    const dur = value ? 420 : 480, opt = { duration: dur, easing: EASE, fill: 'forwards' };
    // the content keeps its open layout while moving, so offsets are relative to it
    const dy0 = from.shift - open.shift, dy1 = to.shift - open.shift;
    const run = [
      glass.animate([{ height: `${from.glass}px` }, { height: `${to.glass}px` }], opt),
      card.animate([{ height: `${from.card}px`, transform: `translateY(${dy0}px)` }, { height: `${to.card}px`, transform: `translateY(${dy1}px)` }], opt),
      heading.animate(value
        ? [{ opacity: from.head }, { opacity: 0, offset: .4 }, { opacity: 0 }]
        : [{ opacity: from.head }, { opacity: from.head, offset: .3 }, { opacity: 1 }], opt),
      description.animate(value
        ? [{ opacity: from.desc }, { opacity: 0, offset: .45 }, { opacity: 0 }]
        : [{ opacity: from.desc }, { opacity: from.desc, offset: .3 }, { opacity: 1 }], opt)
    ];
    run.forEach(m => folds.set(m, m));
    run[0].finished.then(() => { if (folds.has(run[0])) { run.forEach(m => m.cancel()); settle(); } }).catch(() => {});
  }
  minimize.addEventListener('click', () => setMinimized(!minimized));
  // Zoom (green light): the content keeps its width; only the frosted frame,
  // the title bar and the lights move, as GPU transforms (FLIP).
  const surface = section.querySelector('.about-glass-surface');
  const chrome = section.querySelector('.about-window-chrome');
  const lights = section.querySelector('.about-window-lights');
  const ZOOM = { duration: 460, easing: 'cubic-bezier(.32,.72,0,1)' };
  let zooms = [];
  resize.addEventListener('click', () => {
    lockSection();
    const first = surface.getBoundingClientRect(); // includes a running zoom
    zooms.forEach(z => z.cancel());
    section.classList.add('is-zooming');
    const enlarged = glass.classList.toggle('is-enlarged');
    resize.setAttribute('aria-pressed', String(enlarged));
    resize.setAttribute('aria-label', enlarged ? 'Restore window size' : 'Enlarge window');
    const last = surface.getBoundingClientRect();
    requestAnimationFrame(() => requestAnimationFrame(() => section.classList.remove('is-zooming')));
    if (reduced.matches || !last.width) return;
    const sx = first.width / last.width;
    const dx = (first.left + first.width / 2) - (last.left + last.width / 2);
    const frame = [{ transform: `translateX(${dx}px) scaleX(${sx})` }, { transform: 'none' }];
    section.classList.add('is-window-moving');
    zooms = [
      surface.animate(frame, ZOOM),
      chrome.animate(frame, ZOOM),
      // Undo the frame's horizontal scale so the round lights never stretch.
      lights.animate([{ transform: `scaleX(${1 / sx})` }, { transform: 'none' }], ZOOM)
    ];
    const z = zooms[0];
    z.finished.then(() => { if (zooms[0] === z && !folds.size) section.classList.remove('is-window-moving'); }).catch(() => {});
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
  // Tab change: the outgoing panel fades and drifts away while the incoming one
  // fades and drifts in, overlapping in the same grid cell (opacity/transform only).
  const leaving = new Map();
  const SWAP = 'cubic-bezier(.22,1,.36,1)';
  function select(index, focus = false) {
    setMinimized(false);
    if (focus) tabs[index].focus();
    if (index === active) return;
    const direction = index > active ? 1 : -1;
    const previous = active;
    active = index;
    positionSelection();
    animation?.cancel();
    clearTimeout(selectionTimer);
    leaving.forEach((motion, panel) => { motion.cancel(); panel.hidden = true; });
    leaving.clear();
    tabs.forEach((tab, i) => {
      tab.classList.remove('is-selecting');
      tab.setAttribute('aria-selected', String(i === index));
      tab.tabIndex = i === index ? 0 : -1;
      panels[i].inert = i !== index;
      if (i !== index && i !== previous) panels[i].hidden = true;
    });
    panels[index].hidden = false;
    if (reduced.matches) { panels[previous].hidden = true; return; }
    tabs[index].classList.add('is-selecting');
    selectionTimer = setTimeout(() => tabs[index].classList.remove('is-selecting'), 480);
    const out = panels[previous];
    const exit = out.animate([
      { opacity: 1, transform: 'translateX(0)' },
      { opacity: 0, transform: `translateX(${direction * -10}px)` }
    ], { duration: 200, easing: 'cubic-bezier(.4,0,1,1)', fill: 'forwards' });
    leaving.set(out, exit);
    exit.onfinish = () => { out.hidden = true; exit.cancel(); leaving.delete(out); };
    animation = panels[index].animate([
      { opacity: 0, transform: `translateX(${direction * 14}px)` },
      { opacity: 1, transform: 'translateX(0)' }
    ], { duration: 420, delay: 70, easing: SWAP, fill: 'backwards' });
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

// About tab: "No AI slop" — split the note into words so they drift in one by one.
(() => {
  const note = document.querySelector('.me-noslop-more');
  if (!note) return;
  const text = note.textContent.trim();
  note.textContent = '';
  text.split(/\s+/).forEach((word, i) => {
    const w = document.createElement('span');
    w.className = 'w';
    w.style.setProperty('--i', i);
    w.textContent = word;
    note.append(w, ' ');
  });
})();

// Projects tab: blue glass folder holding the cases.
(() => {
  const folder = document.querySelector('[data-pj]');
  if (!folder) return;
  const panel = folder.closest('.about-panel');
  const hit = folder.querySelector('.pj-hit');
  const sheets = [...folder.querySelectorAll('.pj-sheet')];
  const types = [...panel.querySelectorAll('.pj-tile')];
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const tilt = folder.querySelector('.pj-tilt');
  let open = false;

  // Frosted glass: a blurred twin of every card, clipped to the glass shape.
  const frost = document.createElement('div');
  frost.className = 'pj-frost';
  frost.setAttribute('aria-hidden', 'true');
  const frostInner = document.createElement('div');
  frostInner.className = 'pj-frost-in';
  frost.append(frostInner);
  const twins = sheets.map(sheet => {
    const twin = sheet.cloneNode(true);
    twin.removeAttribute('href');
    twin.removeAttribute('data-case');
    twin.removeAttribute('data-film');
    twin.removeAttribute('data-pointer-passive');
    twin.tabIndex = -1;
    frostInner.append(twin);
    return twin;
  });
  folder.querySelector('.pj-files').after(frost);
  // Keep each twin exactly where its card is when a card is hovered or focused.
  sheets.forEach((sheet, i) => {
    const mirror = on => () => twins[i].classList.toggle('is-hover', on && open);
    sheet.addEventListener('pointerenter', mirror(true));
    sheet.addEventListener('pointerleave', mirror(false));
    sheet.addEventListener('focus', mirror(true));
    sheet.addEventListener('blur', mirror(false));
  });

  const setOpen = value => {
    open = value;
    folder.toggleAttribute('data-open', value);
    hit.setAttribute('aria-expanded', String(value));
    hit.setAttribute('aria-label', `${value ? 'Close' : 'Open'} My cases, ${sheets.length} projects`);
    // Closed cards stay out of the tab order.
    sheets.forEach(sheet => { sheet.tabIndex = value ? 0 : -1; });
    if (!value) twins.forEach(twin => twin.classList.remove('is-hover'));
  };
  setOpen(false);
  hit.addEventListener('click', () => setOpen(!open));
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && open) { setOpen(false); hit.focus({ preventScroll: true }); }
  });
  document.addEventListener('pointerdown', event => {
    if (open && !folder.contains(event.target) && !event.target.closest?.('.pj-tile')) setOpen(false);
  });

  // Hovering a project type lifts its case out of the folder.
  const peek = index => {
    sheets.forEach((sheet, i) => sheet.classList.toggle('is-peek', i === index));
    twins.forEach((twin, i) => twin.classList.toggle('is-peek', i === index));
    types.forEach((button, i) => button.classList.toggle('is-on', i === index));
    folder.classList.toggle('is-peeking', index >= 0 && !open);
  };
  types.forEach((button, i) => {
    button.addEventListener('pointerenter', event => { if (event.pointerType === 'mouse' && finePointer.matches) peek(i); });
    button.addEventListener('pointerleave', () => peek(-1));
    button.addEventListener('focus', () => peek(i));
    button.addEventListener('blur', () => peek(-1));
    button.addEventListener('click', () => { setOpen(true); peek(i); });
  });

  // Entrance: the folder rises in as one object (fade + blur-to-sharp), then
  // the cases fall in one by one with gravity, a soft landing and one gentle
  // rebound; the folder gives a little under each landing.
  function enter() {
    folder.setAttribute('data-entered', '');
    if (reducedMotion.matches) return;
    tilt.animate([
      { opacity: 0, transform: 'translateY(22px) scale(.985)', filter: 'blur(8px)' },
      { opacity: 1, transform: 'none', filter: 'blur(0px)' }
    ], { duration: 760, easing: 'cubic-bezier(.22,1,.36,1)', fill: 'backwards' });
    const FALL = 900;
    sheets.forEach((sheet, i) => {
      const delay = 320 + i * 135;
      const side = i % 2 ? 1 : -1;
      const keyframes = [
        { translate: '0 -165px', rotate: `${side * 6}deg`, opacity: 0, easing: 'cubic-bezier(.55,0,.85,.45)' },
        { opacity: 1, offset: .2 },
        { translate: '0 7px', rotate: `${side * -.8}deg`, offset: .58, easing: 'cubic-bezier(.3,0,.4,1)' },
        { translate: '0 -2px', rotate: '0deg', offset: .8, easing: 'cubic-bezier(.4,0,.6,1)' },
        { translate: '0 0', rotate: '0deg', opacity: 1 }
      ];
      for (const el of [sheet, twins[i]]) el.animate(keyframes, { duration: FALL, delay, fill: 'backwards' });
      tilt.animate([{ translate: '0 0' }, { translate: '0 1.6px' }, { translate: '0 0' }],
        { duration: 340, delay: delay + FALL * .58, easing: 'cubic-bezier(.3,0,.4,1)', composite: 'add' });
    });
  }

  // Assemble the folder the first time the tab is shown; close it when leaving.
  const sync = () => {
    if (!panel.hidden && !folder.hasAttribute('data-entered')) {
      enter();
      types.forEach((tile, i) => tile.style.setProperty('--n', i));
      panel.classList.add('is-shown');
      setTimeout(() => panel.classList.add('is-settled'), 1400);
    }
    if (panel.hidden && open) setOpen(false);
    if (panel.hidden) peek(-1);
  };
  new MutationObserver(sync).observe(panel, { attributes: true, attributeFilter: ['hidden'] });
  sync();
})();

// Tools tab: a macOS-style Dock. Icons magnify toward the cursor, bounce when
// chosen, and the card below describes how each tool is used.
(() => {
  const panel = document.getElementById('about-panel-2');
  const dock = panel?.querySelector('.dock');
  if (!dock) return;
  const apps = [...dock.querySelectorAll('.dock-app')];
  const tools = JSON.parse(document.getElementById('tools-data').textContent);
  const detail = panel.querySelector('.tl-detail');
  const icon = detail.querySelector('.tl-detail-icon');
  const nameEl = detail.querySelector('.tl-detail-name');
  const catEl = detail.querySelector('.tl-detail-cat');
  const descEl = detail.querySelector('.tl-detail-desc');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const fine = matchMedia('(hover: hover) and (pointer: fine)');
  let current = -1;
  let swap;

  function select(index, bounce) {
    const app = apps[index];
    apps.forEach(a => a.setAttribute('aria-pressed', String(a === app)));
    if (bounce && !reduced.matches) {
      app.classList.remove('is-bouncing'); void app.offsetWidth; app.classList.add('is-bouncing');
    }
    if (index === current) return;
    current = index;
    const tool = tools[index];
    const fill = () => {
      icon.style.setProperty('--c1', app.style.getPropertyValue('--c1'));
      icon.style.setProperty('--c2', app.style.getPropertyValue('--c2'));
      icon.classList.toggle('is-light', app.dataset.tone === 'light');
      icon.innerHTML = app.querySelector('.dock-icon').innerHTML;
      icon.classList.toggle('has-logo', app.classList.contains('has-logo'));
      nameEl.textContent = tool.name;
      catEl.textContent = tool.cat;
      descEl.textContent = tool.desc;
    };
    swap?.cancel();
    if (reduced.matches || !detail.dataset.ready) { fill(); detail.dataset.ready = '1'; return; }
    const out = detail.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(4px)' }], { duration: 120, easing: 'ease-in', fill: 'forwards' });
    swap = out;
    out.onfinish = () => {
      fill();
      out.cancel();
      swap = detail.animate([{ opacity: 0, transform: 'translateY(-6px)' }, { opacity: 1, transform: 'none' }], { duration: 360, easing: 'cubic-bezier(.22,1,.36,1)' });
    };
  }
  apps.forEach((app, i) => {
    app.addEventListener('click', () => select(i, true));
    app.addEventListener('animationend', () => app.classList.remove('is-bouncing'));
    app.addEventListener('keydown', event => {
      const step = { ArrowRight: 1, ArrowLeft: -1 }[event.key];
      if (step) { event.preventDefault(); apps[(i + step + apps.length) % apps.length].focus(); }
      if (event.key === 'Home') { event.preventDefault(); apps[0].focus(); }
      if (event.key === 'End') { event.preventDefault(); apps[apps.length - 1].focus(); }
    });
    app.tabIndex = i === 1 ? 0 : -1;
    app.addEventListener('focus', () => apps.forEach(a => { a.tabIndex = a === app ? 0 : -1; }));
  });
  // Official app icons: drop assets/tools/<key>.svg or .png into the project
  // (e.g. assets/tools/figma.svg) and it replaces the drawn glyph inside the
  // glass tile automatically. Missing files simply keep the glyph.
  apps.forEach(app => {
    const key = app.dataset.key;
    const tryLoad = exts => {
      if (!exts.length) return;
      const img = new Image();
      img.alt = '';
      img.decoding = 'async';
      img.draggable = false;
      img.onload = () => {
        const tile = app.querySelector('.dock-icon');
        tile.querySelector('svg')?.remove();
        tile.prepend(img);
        app.classList.add('has-logo');
        if (app.getAttribute('aria-pressed') === 'true') { icon.innerHTML = tile.innerHTML; icon.classList.add('has-logo'); }
      };
      img.onerror = () => tryLoad(exts.slice(1));
      img.src = `assets/tools/${key}.${exts[0]}?v=3`;
    };
    tryLoad(['svg', 'png']);
  });
  select(1, false); // After Effects first: the heart of the work.

  // Magnification like the macOS Dock: icons grow with a smooth falloff around
  // the cursor. Sizes ease toward their target every frame (no springs, no
  // overshoot), so entering, moving and leaving all glide.
  const BASE = () => parseFloat(getComputedStyle(apps[0]).getPropertyValue('--size')) || 52;
  let frame = 0, x = null, base = 52;
  const sizes = apps.map(() => 0);
  let centers = [];
  function measure() {
    // Centers at rest, so the falloff doesn't chase the icons as they grow.
    apps.forEach(app => { app.style.width = app.style.height = ''; });
    centers = apps.map(app => { const r = app.getBoundingClientRect(); return r.left + r.width / 2; });
    apps.forEach((app, i) => { if (sizes[i]) app.style.width = app.style.height = `${sizes[i]}px`; });
  }
  function tick() {
    frame = 0;
    let moving = false;
    apps.forEach((app, i) => {
      const target = x === null ? base : base * (1 + .5 * Math.cos(Math.min(1, Math.abs(x - centers[i]) / (base * 2.9)) * Math.PI / 2) ** 2);
      const now = sizes[i] || base;
      const next = Math.abs(target - now) < .05 ? target : now + (target - now) * .24;
      if (next !== target) moving = true;
      sizes[i] = next;
      app.style.width = app.style.height = `${next.toFixed(2)}px`;
    });
    if (moving) frame = requestAnimationFrame(tick);
    else if (x === null) { apps.forEach((app, i) => { app.style.width = app.style.height = ''; sizes[i] = 0; }); }
  }
  const run = () => { if (!frame) frame = requestAnimationFrame(tick); };
  dock.addEventListener('pointerenter', event => {
    if (event.pointerType !== 'mouse' || !fine.matches || reduced.matches) return;
    base = BASE();
    if (!sizes.some(Boolean)) measure();
  });
  dock.addEventListener('pointermove', event => {
    if (event.pointerType !== 'mouse' || !fine.matches || reduced.matches) return;
    if (!centers.length) measure();
    x = event.clientX;
    dock.classList.add('is-tracking');
    run();
  });
  dock.addEventListener('pointerleave', () => {
    x = null;
    dock.classList.remove('is-tracking');
    centers = [];
    run();
  });
})();

/* Process: replay the step cards each time the tab opens; loop the small animations only while visible. */
(function(){
  var panel=document.getElementById('about-panel-3'); if(!panel) return;
  var onScreen=true;
  function sync(){
    var open=!panel.hasAttribute('hidden');
    if(open && !panel.classList.contains('ps-on')){ void panel.offsetWidth; panel.classList.add('ps-on'); }
    else if(!open) panel.classList.remove('ps-on');
    panel.classList.toggle('ps-paused', !onScreen || document.hidden);
  }
  new MutationObserver(sync).observe(panel,{attributes:true,attributeFilter:['hidden']});
  if('IntersectionObserver' in window) new IntersectionObserver(function(e){ onScreen=e[0].isIntersecting; sync(); }).observe(panel);
  document.addEventListener('visibilitychange',sync);
  sync();
})();
