// Visit context attached to a brief: where the visitor came from, what they
// looked at, how long they spent. Nothing leaves the browser until they send
// the brief. window.briefInsight() returns the summary for contact.js.
(function () {
  const store = (area, key, fallback) => { try { const v = area.getItem(key); return v == null ? fallback : JSON.parse(v); } catch { return fallback; } };
  const save = (area, key, value) => { try { area.setItem(key, JSON.stringify(value)); } catch {} };
  const L = window.localStorage, S = window.sessionStorage;
  const started = Date.now();

  // Visits: one per browser session.
  let visits = store(L, 'bi-visits', 0);
  if (!store(S, 'bi-counted', false)) { visits += 1; save(L, 'bi-visits', visits); save(S, 'bi-counted', true); }
  if (!store(L, 'bi-first', '')) save(L, 'bi-first', new Date().toISOString());

  // Source: ?from= / utm_* tags, otherwise the referring site. First touch is kept too.
  const params = new URLSearchParams(location.search);
  const tag = params.get('from') || params.get('ref') || [params.get('utm_source'), params.get('utm_medium'), params.get('utm_campaign')].filter(Boolean).join(' / ');
  let ref = '';
  try { if (document.referrer) { const u = new URL(document.referrer); if (u.host !== location.host) ref = u.host.replace(/^www\./, ''); } } catch {}
  const source = tag ? `${tag}${ref ? ` (via ${ref})` : ''}` : (ref || 'direct');
  if (!store(S, 'bi-source', '')) save(S, 'bi-source', source);
  if (!store(L, 'bi-first-source', '')) save(L, 'bi-first-source', source);

  // Sections seen and About tabs opened during this visit.
  const seen = new Set(store(S, 'bi-seen', []));
  const remember = name => { if (!seen.has(name)) { seen.add(name); save(S, 'bi-seen', [...seen]); } };
  const names = { home: 'Home', about: 'About', work: 'Work', products: 'Products', contact: 'Contact' };
  if ('IntersectionObserver' in window) {
    // Counts only after ~1.5 s on screen, so scrolling past a section doesn't count.
    const timers = new Map();
    const io = new IntersectionObserver(entries => entries.forEach(e => {
      clearTimeout(timers.get(e.target));
      if (e.isIntersecting) timers.set(e.target, setTimeout(() => { remember(names[e.target.id]); io.unobserve(e.target); }, 1500));
    }), { threshold: 0.35 });
    Object.keys(names).forEach(id => { const el = document.getElementById(id); if (el) io.observe(el); });
  }
  document.querySelectorAll('[id^="about-tab-"]').forEach(tab => tab.addEventListener('click', () => remember(`About › ${tab.textContent.trim()}`)));

  // Time spent filling in the brief: from the first keystroke or choice.
  let formStart = 0;
  const form = document.getElementById('project-brief');
  if (form) ['input', 'change'].forEach(type => form.addEventListener(type, () => { if (!formStart) formStart = Date.now(); }, { capture: true }));

  window.briefInsight = () => {
    let tz = '';
    try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch {}
    return {
      visits,
      firstVisit: store(L, 'bi-first', ''),
      source: store(S, 'bi-source', source),
      firstSource: store(L, 'bi-first-source', source),
      seen: [...seen],
      onSite: Math.round((Date.now() - started) / 1000),
      filling: formStart ? Math.round((Date.now() - formStart) / 1000) : 0,
      timeZone: tz,
      localTime: new Date().toLocaleString('en-GB', { weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false }),
      languages: (navigator.languages || [navigator.language]).slice(0, 3).join(', '),
      screen: `${screen.width}×${screen.height}`
    };
  };
})();
