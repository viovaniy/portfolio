// Reference uploader for the brief: the iMessage "+" opens an attachment sheet.
// Up to 10 files are pinned to the brief and, once the brief reaches Telegram,
// each one is sent as a reply to it (/api/brief-file, one file per request).
(() => {
  const preview = document.querySelector('.brief-preview');
  const plus = preview?.querySelector('.im-plus');
  if (!preview || !plus) return;
  const tr = (text, vars) => (window.t ? window.t(text, vars) : text.replace(/\{(\w+)\}/g, (m, k) => (vars && k in vars ? vars[k] : m)));
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const MAX_FILES = 10;
  const BUDGET = 4.15 * 1024 * 1024;   // brief + all files travel in one request (Vercel: ~4.5 MB)
  const PHOTO = /^image\/(jpeg|png|webp|heic|heif|avif)$/i;

  const sheet = document.getElementById('refs-sheet');
  const drop = sheet.querySelector('.refs-drop');
  const input = sheet.querySelector('.refs-input');
  const grid = sheet.querySelector('.refs-grid');
  const countEl = sheet.querySelector('.refs-count b');
  const ring = sheet.querySelector('.refs-ring-bar');
  const note = sheet.querySelector('.refs-note');
  const doneBtn = sheet.querySelector('.refs-done');
  const badge = plus.querySelector('.im-plus-count');
  const attach = preview.querySelector('.im-attach');
  const hint = document.querySelector('.refs-hint');

  const items = []; // { id, file, url, kind, ext }
  let uid = 0;

  // ---------- open / close ----------
  let open = false;
  function setOpen(value, focusPlus) {
    if (open === value) return;
    open = value;
    sheet.hidden = false;
    preview.classList.toggle('is-refs-open', value);
    plus.setAttribute('aria-expanded', String(value));
    plus.setAttribute('aria-label', value ? tr('Close references') : tr('Add references'));
    if (value) {
      requestAnimationFrame(() => sheet.classList.add('is-open'));
      setTimeout(() => doneBtn.focus({ preventScroll: true }), 60);
    } else {
      sheet.classList.remove('is-open');
      setTimeout(() => { if (!open) sheet.hidden = true; }, reduced.matches ? 0 : 320);
      if (focusPlus) plus.focus({ preventScroll: true });
    }
  }
  plus.addEventListener('click', () => setOpen(!open));
  doneBtn.addEventListener('click', () => setOpen(false, true));
  sheet.addEventListener('keydown', e => { if (e.key === 'Escape') { e.stopPropagation(); setOpen(false, true); } });

  // ---------- adding files ----------
  const otherBytes = () => items.reduce((n, x) => n + (PHOTO.test(x.file.type) ? 0 : x.file.size), 0);
  const kindOf = file => file.type.startsWith('image/') ? 'image' : file.type.startsWith('video/') ? 'video' : 'file';
  const extOf = file => (file.name.split('.').pop() || '').slice(0, 4).toUpperCase() || 'FILE';
  let noteTimer;
  function say(text, shake) {
    note.textContent = text;
    note.classList.add('is-on');
    clearTimeout(noteTimer);
    noteTimer = setTimeout(() => note.classList.remove('is-on'), 3200);
    if (shake && !reduced.matches) { drop.classList.remove('is-shake'); void drop.offsetWidth; drop.classList.add('is-shake'); }
  }

  function add(list) {
    const files = [...list].filter(f => f && f.size >= 0);
    if (!files.length) return;
    let skippedBig = 0, skippedMax = 0;
    const added = [];
    for (const file of files) {
      if (items.length >= MAX_FILES) { skippedMax++; continue; }
      const kind = kindOf(file);
      // Photos are compressed before sending; other files must fit in what's left.
      if (!PHOTO.test(file.type) && otherBytes() + file.size > BUDGET * .85) { skippedBig++; continue; }
      const item = { id: ++uid, file, kind, ext: extOf(file), url: kind === 'file' ? '' : URL.createObjectURL(file) };
      items.push(item); added.push(item);
    }
    if (skippedMax) say(tr('Only {max} files can be pinned.', { max: MAX_FILES }), true);
    else if (skippedBig) say(tr('All files together must fit in 4 MB (photos are compressed automatically).'), true);
    const tiles = added.map((item, i) => { const li = tile(item, i); grid.append(li); return li; });
    update();
    morph(tiles);
  }

  // "The zone morphs into the image": each new tile starts as the drop zone's
  // shape and springs into its own place, while the zone squashes as it lets go.
  function morph(tiles) {
    if (!tiles.length || reduced.matches) return;
    drop.classList.remove('is-gulp'); void drop.offsetWidth; drop.classList.add('is-gulp');
    const z = drop.getBoundingClientRect();
    tiles.forEach((li, i) => {
      const t = li.getBoundingClientRect();
      if (!t.width) return;
      const dx = (z.left + z.width / 2) - (t.left + t.width / 2);
      const dy = (z.top + z.height / 2) - (t.top + t.height / 2);
      const sx = Math.min(2.4, z.width / t.width), sy = Math.min(1.5, z.height / t.height);
      const r = parseFloat(li.style.getPropertyValue('--r')) || 0;
      li.animate([
        { transform: `translate(${dx}px,${dy}px) scale(${sx},${sy})`, borderRadius: '18px', opacity: 0 },
        { offset: .2, opacity: 1 },
        { offset: .58, transform: `translate(0,0) scale(1.08) rotate(${r}deg)`, borderRadius: '12px' },
        { offset: .8, transform: `scale(.97) rotate(${-r / 3}deg)` },
        { transform: 'none', borderRadius: '12px', opacity: 1 }
      ], { duration: 720, delay: i * 70, easing: 'cubic-bezier(.2,.75,.25,1)', fill: 'backwards' });
      li.firstElementChild?.animate([{ opacity: 0, transform: 'scale(1.25)' }, { offset: .35, opacity: 0 }, { opacity: 1, transform: 'none' }], { duration: 720, delay: i * 70, easing: 'ease-out', fill: 'backwards' });
    });
  }

  function tile(item, i) {
    const li = document.createElement('li');
    li.className = `refs-tile is-${item.kind}`;
    li.dataset.id = item.id;
    li.style.setProperty('--r', `${(Math.random() * 14 - 7).toFixed(1)}deg`);
    li.style.setProperty('--d', `${i * 55}ms`);
    if (item.kind === 'image') li.innerHTML = `<img alt="" src="${item.url}" decoding="async">`;
    else if (item.kind === 'video') li.innerHTML = `<video muted playsinline preload="metadata" src="${item.url}#t=0.1"></video><span class="refs-play" aria-hidden="true"></span>`;
    else li.innerHTML = `<span class="refs-doc" aria-hidden="true"><b>${item.ext}</b></span>`;
    const label = document.createElement('span');
    label.className = 'refs-name'; label.textContent = item.file.name;
    li.append(label);
    const remove = document.createElement('button');
    remove.type = 'button'; remove.className = 'refs-remove';
    remove.setAttribute('aria-label', tr('Remove {name}', { name: item.file.name }));
    remove.innerHTML = '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="m3 3 6 6M9 3 3 9"/></svg>';
    remove.addEventListener('click', () => removeItem(item.id));
    li.append(remove);
    return li;
  }

  function removeItem(id) {
    const index = items.findIndex(x => x.id === id);
    if (index < 0) return;
    const [item] = items.splice(index, 1);
    const li = grid.querySelector(`[data-id="${id}"]`);
    const finish = () => { li?.remove(); if (item.url) URL.revokeObjectURL(item.url); update(); };
    if (!li || reduced.matches) { finish(); return; }
    // FLIP: the remaining tiles glide into the gap.
    const before = new Map([...grid.children].map(el => [el, el.getBoundingClientRect()]));
    li.animate([{ opacity: 1, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(.4)' }], { duration: 220, easing: 'cubic-bezier(.4,0,1,1)' }).onfinish = () => {
      li.remove(); if (item.url) URL.revokeObjectURL(item.url);
      [...grid.children].forEach(el => {
        const a = before.get(el), b = el.getBoundingClientRect();
        if (a && (a.left !== b.left || a.top !== b.top)) el.animate([{ transform: `translate(${a.left - b.left}px,${a.top - b.top}px)` }, { transform: 'none' }], { duration: 380, easing: 'cubic-bezier(.22,1,.36,1)' });
      });
      update();
    };
  }

  function update() {
    const n = items.length;
    countEl.textContent = n;
    ring.style.strokeDashoffset = String(1 - n / MAX_FILES);
    sheet.classList.toggle('has-files', n > 0);
    sheet.classList.toggle('is-full', n >= MAX_FILES);
    input.disabled = n >= MAX_FILES;
    badge.textContent = n;
    badge.hidden = n === 0;
    hint?.classList.toggle('is-done', n > 0);
    renderAttach();
  }

  // The message shows pinned files as a fanned stack, like iMessage.
  function renderAttach() {
    attach.textContent = '';
    const shown = items.slice(-3);
    attach.hidden = !items.length;
    shown.forEach((item, i) => {
      const card = document.createElement('span');
      card.className = 'im-attach-card';
      card.style.setProperty('--i', shown.length - 1 - i);
      card.style.setProperty('--n', shown.length);
      if (item.kind === 'image') card.innerHTML = `<img alt="" src="${item.url}">`;
      else if (item.kind === 'video') card.innerHTML = `<video muted playsinline preload="metadata" src="${item.url}#t=0.1"></video>`;
      else card.innerHTML = `<span class="refs-doc"><b>${item.ext}</b></span>`;
      attach.append(card);
    });
    if (items.length > 3) {
      const more = document.createElement('span');
      more.className = 'im-attach-more'; more.textContent = `+${items.length - 3}`;
      attach.append(more);
    }
    attach.setAttribute('aria-label', tr('{n} references pinned', { n: items.length }));
  }

  input.addEventListener('change', () => { add(input.files); input.value = ''; });

  // Drag & drop: dragging files over the iMessage card opens the sheet.
  let depth = 0;
  const hasFiles = e => [...(e.dataTransfer?.types || [])].includes('Files');
  preview.addEventListener('dragenter', e => {
    if (!hasFiles(e) || locked) return;
    e.preventDefault(); depth++;
    setOpen(true);
    drop.classList.add('is-over');
  });
  const stack = drop.querySelector('.refs-stack');
  preview.addEventListener('dragover', e => {
    if (!hasFiles(e)) return;
    e.preventDefault(); e.dataTransfer.dropEffect = 'copy';
    // The little picture stack leans toward the file being dragged.
    const z = drop.getBoundingClientRect();
    const nx = Math.max(-1, Math.min(1, (e.clientX - (z.left + z.width / 2)) / (z.width / 2)));
    const ny = Math.max(-1, Math.min(1, (e.clientY - (z.top + z.height / 2)) / (z.height / 1.2)));
    stack.style.transform = `translate(${(nx * 8).toFixed(1)}px,${(ny * 5).toFixed(1)}px) rotate(${(nx * 6).toFixed(1)}deg)`;
  });
  preview.addEventListener('dragleave', () => { depth = Math.max(0, depth - 1); if (!depth) { drop.classList.remove('is-over'); stack.style.transform = ''; } });
  preview.addEventListener('drop', e => {
    if (!hasFiles(e) || locked) return;
    e.preventDefault(); depth = 0; drop.classList.remove('is-over'); stack.style.transform = '';
    add(e.dataTransfer.files);
  });
  // Pasting images while the sheet is open pins them too.
  document.addEventListener('paste', e => {
    if (!open) return;
    const files = [...(e.clipboardData?.files || [])];
    if (files.length) { e.preventDefault(); add(files); }
  });

  // The handwritten hint draws itself when it scrolls into view.
  if (hint && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) { hint.classList.add('is-drawn'); io.disconnect(); } }, { threshold: .6 });
    io.observe(hint);
  } else hint?.classList.add('is-drawn');

  // ---------- packing for sending ----------
  // The brief and every file go in one request, so Telegram receives them as a
  // single album. Photos are compressed just enough to fit; others go as they are.
  async function compress(file, side, quality) {
    if (!PHOTO.test(file.type) || !window.createImageBitmap) return file;
    try {
      const bmp = await createImageBitmap(file);
      const scale = Math.min(1, side / Math.max(bmp.width, bmp.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(bmp.width * scale); canvas.height = Math.round(bmp.height * scale);
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height); // transparent PNGs get a white backdrop
      ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
      bmp.close?.();
      const blob = await new Promise(r => canvas.toBlob(r, 'image/jpeg', quality));
      if (!blob) return file;
      return blob.size < file.size || !/jpeg|png|webp/i.test(file.type) ? new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' }) : file;
    } catch { return file; }
  }
  async function pack(brief) {
    const steps = [[2048, .86], [1600, .8], [1280, .74], [1024, .68], [800, .6]];
    let files = items.map(x => x.file), json, size = 0;
    for (const [side, quality] of steps) {
      files = await Promise.all(items.map(x => compress(x.file, side, quality)));
      json = new TextEncoder().encode(JSON.stringify({ ...brief, files: files.map(f => ({ name: f.name, type: f.type || 'application/octet-stream', size: f.size })) }));
      size = 4 + json.length + files.reduce((n, f) => n + f.size, 0);
      if (size <= BUDGET) break;
    }
    if (size > BUDGET) throw new Error('Attachments are too large');
    const head = new Uint8Array(4);
    new DataView(head.buffer).setUint32(0, json.length);
    return new Blob([head, json, ...files], { type: 'application/octet-stream' });
  }

  // After a brief is sent, pinning is locked until "Send another brief".
  let locked = false;
  const tip = document.createElement('span');
  tip.className = 'im-plus-tip'; tip.setAttribute('role', 'status');
  plus.after(tip);
  function lock(value) {
    locked = value;
    if (value) setOpen(false);
    plus.classList.toggle('is-locked', value);
    plus.setAttribute('aria-disabled', String(value));
    plus.setAttribute('aria-label', value ? tr('Send another brief to pin new files') : tr('Add references'));
    if (!value) tip.classList.remove('is-on');
  }
  let tipTimer;
  plus.addEventListener('click', e => {
    if (!locked) return;
    e.stopImmediatePropagation();
    tip.textContent = tr('Press “Send another brief” to pin new files');
    tip.classList.add('is-on');
    clearTimeout(tipTimer); tipTimer = setTimeout(() => tip.classList.remove('is-on'), 2600);
    if (!reduced.matches) { plus.classList.remove('is-nope'); void plus.offsetWidth; plus.classList.add('is-nope'); }
  }, true);

  function clear() {
    items.splice(0).forEach(item => item.url && URL.revokeObjectURL(item.url));
    grid.textContent = '';
    update();
  }

  window.briefRefs = { count: () => items.length, pack, clear, lock, close: () => setOpen(false) };
  update();
})();
