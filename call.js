// Video call booking inside the iMessage card: the camera button opens an
// iOS-style sheet (pick a day and time → where to send the invite + Meet/Zoom).
// The booking rides along with the brief and appears as a calendar event in
// the chat. Slots are the owner's working hours, shown in the visitor's time zone.
(() => {
  const preview = document.querySelector('.brief-preview');
  const button = preview?.querySelector('.im-video');
  const sheet = document.getElementById('call-sheet');
  if (!preview || !button || !sheet) return;
  const tr = (text, vars) => (window.t ? window.t(text, vars) : text.replace(/\{(\w+)\}/g, (m, k) => (vars && k in vars ? vars[k] : m)));
  const lang = window.siteLang || document.documentElement.lang || 'en';
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');

  // The owner's availability (his time zone is Yekaterinburg, UTC+5, no DST).
  const HOST_OFFSET = 5;            // hours ahead of UTC
  const HOURS = [10, 11, 12, 13, 14, 15, 16, 17, 18]; // call start times, his time
  const WORKDAYS = [1, 2, 3, 4, 5]; // Mon–Fri, his time
  const LEAD_HOURS = 12;            // earliest booking from now
  const DAYS_AHEAD = 35;

  const clientTz = (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch { return ''; } })();
  const dayKey = d => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`; // in the visitor's local time

  // All open slots, as real instants, grouped by the visitor's local day.
  function buildSlots() {
    const map = new Map();
    const now = Date.now(), earliest = now + LEAD_HOURS * 3600e3;
    const hostToday = new Date(now + HOST_OFFSET * 3600e3); // shifted so getUTC* reads his wall clock
    for (let i = 0; i <= DAYS_AHEAD; i++) {
      const y = hostToday.getUTCFullYear(), m = hostToday.getUTCMonth(), d = hostToday.getUTCDate() + i;
      const dow = new Date(Date.UTC(y, m, d)).getUTCDay();
      if (!WORKDAYS.includes(dow)) continue;
      for (const h of HOURS) {
        const at = Date.UTC(y, m, d, h - HOST_OFFSET);
        if (at < earliest) continue;
        const local = new Date(at), key = dayKey(local);
        if (!map.has(key)) map.set(key, []);
        map.get(key).push(at);
      }
    }
    return map;
  }

  const el = s => sheet.querySelector(s);
  const pages = el('.call-pages');
  const monthLabel = el('[data-call-month]');
  const dow = el('.call-dow');
  const days = el('.call-days');
  const times = el('.call-times');
  const next = el('.call-next');
  const input = el('.call-input');
  const error = el('.call-error');
  const summary = el('[data-call-summary]');
  const eventCard = preview.querySelector('.im-event');
  const dot = button.querySelector('.im-video-dot');
  const hint = document.querySelector('.call-hint');
  el('[data-call-tz]').textContent = clientTz.replace(/_/g, ' ').split('/').pop();

  const fmt = (opts, d) => { try { return new Intl.DateTimeFormat(lang, opts).format(d); } catch { return new Intl.DateTimeFormat('en', opts).format(d); } };
  const timeOf = at => fmt({ hour: '2-digit', minute: '2-digit' }, new Date(at));
  const longDay = at => fmt({ weekday: 'long', day: 'numeric', month: 'long' }, new Date(at));

  // Weekday initials, Monday first (like Calendar in most of the world).
  const monday = new Date(2024, 0, 1);
  for (let i = 0; i < 7; i++) {
    const s = document.createElement('span');
    s.textContent = fmt({ weekday: 'narrow' }, new Date(monday.getFullYear(), 0, 1 + i));
    dow.append(s);
  }

  let slots = buildSlots();
  let view = new Date(); view.setDate(1);
  let pickedDay = null, pickedAt = null;
  let booking = null; // { at, via, handle, platform }
  let via = 'email', platform = 'Google Meet';

  function renderMonth() {
    monthLabel.textContent = fmt({ month: 'long', year: 'numeric' }, view).replace(/\s*г\.$/, ''); // Russian adds "г." after the year
    days.textContent = '';
    const first = new Date(view.getFullYear(), view.getMonth(), 1);
    const lead = (first.getDay() + 6) % 7; // Monday-first offset
    const count = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();
    const today = dayKey(new Date());
    for (let i = 0; i < lead; i++) days.append(document.createElement('span'));
    for (let d = 1; d <= count; d++) {
      const date = new Date(view.getFullYear(), view.getMonth(), d);
      const key = dayKey(date);
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'call-day'; b.textContent = d;
      b.dataset.key = key;
      const open = slots.has(key);
      b.disabled = !open;
      if (key === today) b.classList.add('is-today');
      if (key === pickedDay) b.classList.add('is-picked');
      b.setAttribute('aria-label', fmt({ weekday: 'long', day: 'numeric', month: 'long' }, date) + (open ? '' : ` · ${tr('unavailable')}`));
      b.setAttribute('aria-pressed', String(key === pickedDay));
      days.append(b);
    }
    // Month arrows only where there are open days.
    const firstOpen = Math.min(...[...slots.values()].map(a => a[0]));
    const lastOpen = Math.max(...[...slots.values()].map(a => a[a.length - 1]));
    const startOfView = new Date(view.getFullYear(), view.getMonth(), 1).getTime();
    const endOfView = new Date(view.getFullYear(), view.getMonth() + 1, 1).getTime();
    el('.call-nav[data-dir="-1"]').disabled = !(firstOpen < startOfView);
    el('.call-nav[data-dir="1"]').disabled = !(lastOpen >= endOfView);
  }

  function renderTimes() {
    times.textContent = '';
    const list = pickedDay ? slots.get(pickedDay) || [] : [];
    times.classList.toggle('is-empty', !list.length);
    if (!list.length) {
      const p = document.createElement('p'); p.className = 'call-times-empty';
      p.textContent = tr('Choose a day to see open times');
      times.append(p);
    }
    list.forEach((at, i) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'call-time'; b.textContent = timeOf(at);
      b.dataset.at = at; b.setAttribute('role', 'option');
      b.setAttribute('aria-selected', String(at === pickedAt));
      b.style.setProperty('--i', i);
      times.append(b);
    });
    next.disabled = !pickedAt;
  }

  days.addEventListener('click', e => {
    const b = e.target.closest('.call-day');
    if (!b || b.disabled) return;
    pickedDay = b.dataset.key;
    if (!(slots.get(pickedDay) || []).includes(pickedAt)) pickedAt = null;
    days.querySelectorAll('.call-day').forEach(x => { const on = x === b; x.classList.toggle('is-picked', on); x.setAttribute('aria-pressed', String(on)); });
    renderTimes();
    times.classList.remove('is-in'); void times.offsetWidth; times.classList.add('is-in');
  });
  // A time that only peeks in at the edge can't be picked: tapping it slides it into view first.
  const peeking = b => {
    const r = b.getBoundingClientRect(), box = times.getBoundingClientRect();
    return r.left < box.left - 1 || r.right > box.right + 1;
  };
  const markPeek = () => times.querySelectorAll('.call-time').forEach(x => {
    const p = peeking(x);
    x.classList.toggle('is-peek', p);
    x.toggleAttribute('data-pointer-passive', p); // the cursor doesn't wrap a half-hidden chip
  });
  times.addEventListener('scroll', () => requestAnimationFrame(markPeek), { passive: true });
  new MutationObserver(() => requestAnimationFrame(markPeek)).observe(times, { childList: true });
  times.addEventListener('click', e => {
    const b = e.target.closest('.call-time');
    if (!b) return;
    if (peeking(b)) {
      const box = times.getBoundingClientRect(), r = b.getBoundingClientRect();
      times.scrollBy({ left: r.right > box.right ? r.right - box.right : r.left - box.left, behavior: reduced.matches ? 'auto' : 'smooth' });
      return;
    }
    pickedAt = +b.dataset.at;
    times.querySelectorAll('.call-time').forEach(x => x.setAttribute('aria-selected', String(x === b)));
    next.disabled = false;
  });
  sheet.querySelectorAll('.call-nav').forEach(b => b.addEventListener('click', () => {
    view = new Date(view.getFullYear(), view.getMonth() + +b.dataset.dir, 1);
    renderMonth();
    days.classList.remove('is-slide-l', 'is-slide-r'); void days.offsetWidth;
    days.classList.add(+b.dataset.dir > 0 ? 'is-slide-l' : 'is-slide-r');
  }));

  // Segmented controls with a sliding white thumb.
  function seg(name, value) {
    const box = sheet.querySelector(`[data-seg="${name}"]`);
    const buttons = [...box.querySelectorAll('button')];
    const index = Math.max(0, buttons.findIndex(b => b.dataset.v === value));
    buttons.forEach((b, i) => b.setAttribute('aria-checked', String(i === index)));
    box.style.setProperty('--i', index);
    return buttons[index].dataset.v;
  }
  function setVia(v) {
    via = seg('via', v);
    input.type = via === 'email' ? 'email' : 'text';
    input.autocomplete = via === 'email' ? 'email' : 'off';
    input.placeholder = via === 'email' ? 'name@email.com' : '@username';
    error.textContent = '';
  }
  sheet.querySelector('[data-seg="via"]').addEventListener('click', e => { const b = e.target.closest('button'); if (b) { setVia(b.dataset.v); input.focus({ preventScroll: true }); } });
  sheet.querySelector('[data-seg="platform"]').addEventListener('click', e => { const b = e.target.closest('button'); if (b) platform = seg('platform', b.dataset.v); });

  // Pages: an iOS push between "when" and "how".
  function page(n) {
    pages.dataset.page = n;
    if (n === 2) {
      summary.textContent = `${longDay(pickedAt)} · ${timeOf(pickedAt)}`;
      // Prefill from the brief's contact field when it fits.
      if (!input.value) {
        const c = (document.querySelector('#project-brief [name="contact"]')?.value || '').trim();
        if (/^\S+@\S+\.\S+$/.test(c)) { setVia('email'); input.value = c; }
        else if (/^@?[a-z0-9_]{4,32}$/i.test(c) || /t\.me\//i.test(c)) { setVia('telegram'); input.value = c.startsWith('@') || /t\.me/i.test(c) ? c : '@' + c; }
      }
      setTimeout(() => input.focus({ preventScroll: true }), reduced.matches ? 0 : 380);
    } else setTimeout(() => sheet.querySelector('.call-day.is-picked, .call-day:not(:disabled)')?.focus({ preventScroll: true }), 60);
  }
  next.addEventListener('click', () => { if (pickedAt) page(2); });
  el('.call-back').addEventListener('click', () => page(1));

  function valid() {
    const v = input.value.trim();
    if (via === 'email') return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
    return /^@?[a-z0-9_]{4,32}$/i.test(v) || /^(https?:\/\/)?t\.me\/[a-z0-9_]{4,32}\/?$/i.test(v);
  }
  el('.call-book').addEventListener('click', () => {
    if (!valid()) {
      error.textContent = via === 'email' ? tr('Please add a valid email address.') : tr('Please add your Telegram username, like @name.');
      if (!reduced.matches) { input.parentElement.classList.remove('is-shake'); void input.offsetWidth; input.parentElement.classList.add('is-shake'); }
      input.focus({ preventScroll: true });
      return;
    }
    let handle = input.value.trim();
    if (via === 'telegram' && !/t\.me/i.test(handle) && !handle.startsWith('@')) handle = '@' + handle;
    booking = { at: pickedAt, via, handle, platform };
    setOpen(false, true);
    showEvent(true);
  });
  input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); el('.call-book').click(); } });
  input.addEventListener('input', () => { error.textContent = ''; });

  // The booked call appears in the chat like a Calendar event.
  function showEvent(animate) {
    const has = Boolean(booking);
    eventCard.hidden = !has;
    dot.hidden = !has;
    button.classList.toggle('is-booked', has);
    hint?.classList.toggle('is-done', has);
    if (!has) return;
    const d = new Date(booking.at);
    eventCard.querySelector('[data-ev-dow]').textContent = fmt({ weekday: 'short' }, d);
    eventCard.querySelector('[data-ev-day]').textContent = d.getDate();
    eventCard.querySelector('[data-ev-when]').textContent = `${fmt({ day: 'numeric', month: 'long' }, d)} · ${timeOf(booking.at)}`;
    eventCard.querySelector('[data-ev-where]').textContent = `${booking.platform} · ${booking.handle}`;
    eventCard.querySelector('.im-event-text b').textContent = tr('Video call');
    if (animate && !reduced.matches) {
      eventCard.classList.remove('is-in'); void eventCard.offsetWidth; eventCard.classList.add('is-in');
      // The little calendar page flips over to the chosen date, like a tear-off calendar.
      eventCard.querySelector('.im-event-cal').animate([
        { transform: 'perspective(160px) rotateX(-95deg)', opacity: .2 },
        { offset: .6, transform: 'perspective(160px) rotateX(12deg)', opacity: 1 },
        { transform: 'none', opacity: 1 }
      ], { duration: 650, delay: 180, easing: 'cubic-bezier(.22,1,.36,1)', fill: 'backwards' });
    }
  }
  eventCard.addEventListener('click', () => setOpen(true));

  // ---------- open / close ----------
  let open = false, locked = false;
  function setOpen(value, focusButton) {
    if (open === value) return;
    open = value;
    if (value) {
      window.briefRefs?.close();
      slots = buildSlots();
      if (booking) { pickedAt = booking.at; pickedDay = dayKey(new Date(booking.at)); view = new Date(new Date(booking.at).getFullYear(), new Date(booking.at).getMonth(), 1); }
      else if (!pickedDay) {
        // Start on the first month that has an open day.
        const first = Math.min(...[...slots.values()].map(a => a[0]));
        if (isFinite(first)) { const f = new Date(first); view = new Date(f.getFullYear(), f.getMonth(), 1); }
      }
      renderMonth(); renderTimes();
      pages.dataset.page = 1;
      sheet.hidden = false;
      fit();
      requestAnimationFrame(() => sheet.classList.add('is-open'));
      page(1);
    } else {
      sheet.classList.remove('is-open');
      setTimeout(() => { if (!open) sheet.hidden = true; }, reduced.matches ? 0 : 320);
      if (focusButton) button.focus({ preventScroll: true });
    }
    preview.classList.toggle('is-call-open', value);
    button.setAttribute('aria-expanded', String(value));
  }
  // The phone keeps its size: if the sheet doesn't fit, it switches to a tighter layout.
  function fit() {
    if (sheet.hidden) return;
    sheet.classList.remove('is-tight');
    if (sheet.scrollHeight > sheet.clientHeight + 1) sheet.classList.add('is-tight');
  }
  window.addEventListener('resize', fit);

  // Once either button has been used, they stop pulsing.
  [button, preview.querySelector('.im-plus')].forEach(b => b?.addEventListener('click', () => preview.classList.add('is-explored')));
  button.addEventListener('click', () => {
    if (locked) { nudge(); return; }
    setOpen(!open);
  });
  sheet.querySelectorAll('.call-cancel').forEach(b => b.addEventListener('click', () => setOpen(false, true)));
  sheet.addEventListener('keydown', e => { if (e.key === 'Escape') { e.stopPropagation(); setOpen(false, true); } });

  // Locked after sending, like the + button, until "Send another brief".
  const tip = document.createElement('span');
  tip.className = 'im-video-tip'; tip.setAttribute('role', 'status');
  preview.querySelector('.brief-chat-head').append(tip);
  let tipTimer;
  function nudge() {
    tip.textContent = tr('Press “Send another brief” to book a new call');
    tip.classList.add('is-on');
    clearTimeout(tipTimer); tipTimer = setTimeout(() => tip.classList.remove('is-on'), 2600);
    if (!reduced.matches) { button.classList.remove('is-nope'); void button.offsetWidth; button.classList.add('is-nope'); }
  }
  function lock(value) {
    locked = value;
    if (value) setOpen(false);
    button.classList.toggle('is-locked', value);
    button.setAttribute('aria-disabled', String(value));
    eventCard.disabled = value;
    if (!value) tip.classList.remove('is-on');
  }

  // Keep the handwritten hint clear of the conversation as it grows.
  const narrowHint = matchMedia('(max-width: 900px)');
  function placeHint() {
    if (!hint) return;
    if (narrowHint.matches) { hint.classList.remove('is-crowded'); return; } // above the card on phones
    const h = hint.getBoundingClientRect();
    const first = preview.querySelector('.im-time');
    const top = first ? first.getBoundingClientRect().top : Infinity;
    hint.classList.toggle('is-crowded', h.height > 0 && h.bottom > top - 6);
  }
  new ResizeObserver(placeHint).observe(preview.querySelector('.brief-chat'));
  addEventListener('resize', placeHint);
  narrowHint.addEventListener('change', placeHint);
  if (hint && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) { hint.classList.add('is-drawn'); io.disconnect(); } }, { threshold: .6 });
    io.observe(hint);
  } else hint?.classList.add('is-drawn');

  // For the brief: what the owner gets in Telegram.
  function get() {
    if (!booking) return null;
    return { at: new Date(booking.at).toISOString(), via: booking.via, handle: booking.handle, platform: booking.platform, clientTz };
  }
  function clear() { booking = null; pickedAt = pickedDay = null; input.value = ''; showEvent(false); }

  setVia('email'); platform = seg('platform', 'Google Meet');
  window.briefCall = { get, clear, lock, close: () => setOpen(false) };
})();

// iPhone Duo status bar: the visitor's own local time, like a real phone.
(() => {
  const el = document.querySelector('.duo-time');
  if (!el) return;
  let fmt;
  try {
    fmt = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });
  } catch (e) { return; }
  const render = () => {
    // iOS shows the time without AM/PM in the status bar.
    const parts = fmt.formatToParts(new Date());
    el.textContent = parts.filter(p => p.type === 'hour' || p.type === 'minute' || (p.type === 'literal' && p.value.includes(':'))).map(p => p.value).join('') || '9:41';
  };
  const tick = () => {
    render();
    setTimeout(tick, 60000 - (Date.now() % 60000) + 50);
  };
  tick();
  document.addEventListener('visibilitychange', () => { if (!document.hidden) render(); });
})();

// The phone's Back button: one step back in the booking, out of a sheet otherwise.
(() => {
  const back = document.querySelector('.brief-preview .im-back');
  const preview = back?.closest('.brief-preview');
  if (!back || !preview) return;
  back.addEventListener('click', () => {
    if (preview.classList.contains('is-call-open')) {
      const pages = preview.querySelector('.call-pages');
      if (pages?.dataset.page === '2') preview.querySelector('.call-back')?.click();
      else preview.querySelector('.call-sheet .call-cancel')?.click();
    } else if (preview.classList.contains('is-refs-open')) {
      preview.querySelector('.refs-done')?.click();
    } else {
      back.classList.remove('is-nudge'); void back.offsetWidth; back.classList.add('is-nudge');
    }
  });
  back.addEventListener('animationend', () => back.classList.remove('is-nudge'));
})();
