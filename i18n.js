// Site translations + the language picker on the first screen.
// English lives in the HTML. Another language is chosen with ?lang=xx (or the
// saved choice); the small inline script in <head> then loads i18n/<lang>.js,
// which defines window.__I18N = { lang, dict } keyed by the English text.
// This script runs first among the deferred scripts, so the text is already
// translated before other scripts split words for their reveal animations.
(function () {
  const LANGS = [
    ['en', 'English', 'English', 'US'],
    ['zh', '中文', 'Chinese', 'CN'],
    ['es', 'Español', 'Spanish', 'ES'],
    ['fr', 'Français', 'French', 'FR'],
    ['pt', 'Português', 'Portuguese', 'BR'],
    ['ru', 'Русский', 'Russian', 'RU'],
    ['de', 'Deutsch', 'German', 'DE'],
    ['ja', '日本語', 'Japanese', 'JP'],
    ['it', 'Italiano', 'Italian', 'IT'],
    ['uk', 'Українська', 'Ukrainian', 'UA']
  ];
  const pack = window.__I18N && window.__I18N.dict ? window.__I18N : { lang: 'en', dict: {} };
  const lang = pack.lang, dict = pack.dict;
  const CJK = lang === 'zh' || lang === 'ja';

  // t('Thank you, {name}.', { name }) — falls back to the English text.
  window.t = (text, vars) => {
    let out = Object.prototype.hasOwnProperty.call(dict, text) ? dict[text] : text;
    if (vars) out = out.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));
    return out;
  };
  window.tList = items => {
    if (items.length < 2) return items.join('');
    return items.slice(0, -1).join(t('{list-sep}') === '{list-sep}' ? ', ' : t('{list-sep}')) + (t('{list-and}') === '{list-and}' ? ' and ' : t('{list-and}')) + items[items.length - 1];
  };
  window.siteLang = lang;

  // ---------- apply the dictionary ----------
  function translateDom() {
    const hero = document.getElementById('intro-title');

    // Hero lines are pre-split into animated words: rebuild them from the translated sentence.
    if (hero) {
      hero.lang = lang;
      let i = 0;
      const lines = [...hero.querySelectorAll('.reveal-line')];
      const said = [];
      lines.forEach(line => {
        const source = [...line.querySelectorAll('.reveal-word')].map(w => w.textContent).join(' ');
        const text = t(source);
        said.push(text.replace(/\s*\{\w+\}/g, ''));
        if (text === source) { i += line.querySelectorAll('.reveal-word').length; return; }
        // {play} / {spark} mark where the little icon tiles sit in each language
        const tiles = {};
        line.querySelectorAll('.hero-tile').forEach(tile => { tiles[tile.textContent.trim()] = tile.cloneNode(true); });
        const tokens = CJK ? text.match(/\{\w+\}[、。，！？：；」』）)!?,.]*|.[、。，！？：；」』）)!?,.]*/gu) || [text] : text.split(/\s+/);
        line.textContent = '';
        tokens.forEach(token => {
          const delay = `${(0.1 + i++ * (CJK ? 0.012 : 0.026)).toFixed(3)}s`;
          const mark = token.match(/^(\{\w+\})(.*)$/);
          const clip = document.createElement('span');
          if (mark && tiles[mark[1]]) {
            clip.className = 'reveal-clip tile-clip';
            const tile = tiles[mark[1]].cloneNode(true);
            tile.style.setProperty('--reveal-delay', delay);
            clip.append(tile); line.append(clip);
            if (mark[2]) { const p = document.createElement('span'); p.className = 'reveal-clip'; const w = document.createElement('span'); w.className = 'reveal-word'; w.style.setProperty('--reveal-delay', delay); w.textContent = mark[2]; p.append(w); line.append(p); }
          } else {
            clip.className = 'reveal-clip';
            const word = document.createElement('span'); word.className = 'reveal-word';
            word.style.setProperty('--reveal-delay', delay);
            word.textContent = token;
            clip.append(word); line.append(clip);
          }
          if (!CJK) line.append(' ');
        });
      });
      const sr = hero.querySelector('.sr-only');
      if (sr) sr.textContent = [t('Hello!'), ...said].join(' ');
    }

    // Tool cards read their text from this JSON.
    const tools = document.getElementById('tools-data');
    if (tools) {
      try {
        const list = JSON.parse(tools.textContent);
        list.forEach(item => { item.cat = t(item.cat); item.desc = t(item.desc); });
        tools.textContent = JSON.stringify(list);
      } catch {}
    }

    // Every other text node and the few attributes people see or hear.
    const skip = el => el.closest('script,style,svg,.reveal-line,[data-no-i18n]');
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const nodes = [];
    for (let n = walker.nextNode(); n; n = walker.nextNode()) nodes.push(n);
    nodes.forEach(node => {
      const raw = node.nodeValue, key = raw.replace(/\s+/g, ' ').trim();
      if (!key || !Object.prototype.hasOwnProperty.call(dict, key) || skip(node.parentElement)) return;
      const lead = raw.match(/^\s*/)[0] ? ' ' : '', tail = raw.match(/\s*$/)[0] ? ' ' : '';
      node.nodeValue = (CJK ? '' : lead) + dict[key] + (CJK ? '' : tail);
    });
    ['placeholder', 'aria-label', 'alt', 'title', 'data-text', 'data-empty'].forEach(attr => {
      document.querySelectorAll(`[${attr}]`).forEach(el => {
        if (el.closest('[data-no-i18n]')) return;
        const v = el.getAttribute(attr);
        if (Object.prototype.hasOwnProperty.call(dict, v)) el.setAttribute(attr, dict[v]);
      });
    });

    document.title = `viovaniy — ${t('motion designer')}`;
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.content = t(meta.content);
  }
  if (lang !== 'en') translateDom();

  // ---------- flags: Apple emoji where available, small drawn flags elsewhere ----------
  const FLAG_SVG = {
    US: '<rect width="30" height="20" fill="#fff"/><path d="M0 0h30M0 3.08h30M0 6.15h30M0 9.23h30M0 12.3h30M0 15.4h30M0 18.46h30" stroke="#B22234" stroke-width="1.54" transform="translate(0 .77)"/><rect width="13" height="10.77" fill="#3C3B6E"/><g fill="#fff">'+[...Array(20)].map((_, i) => `<circle cx="${1.6 + (i % 5) * 2.45 + (Math.floor(i / 5) % 2) * 1.2}" cy="${1.4 + Math.floor(i / 5) * 2.6}" r=".45"/>`).join('')+'</g>',
    GB: '<rect width="30" height="20" fill="#012169"/><path d="M0 0l30 20M30 0L0 20" stroke="#fff" stroke-width="4"/><path d="M0 0l30 20M30 0L0 20" stroke="#C8102E" stroke-width="1.6"/><path d="M15 0v20M0 10h30" stroke="#fff" stroke-width="6"/><path d="M15 0v20M0 10h30" stroke="#C8102E" stroke-width="3.4"/>',
    CN: '<rect width="30" height="20" fill="#DE2910"/><path fill="#FFDE00" d="M5.5 2.6l.9 2.7h2.8l-2.3 1.7.9 2.7-2.3-1.7-2.3 1.7.9-2.7L1.8 5.3h2.8z"/><circle cx="11" cy="2.6" r=".8" fill="#FFDE00"/><circle cx="12.6" cy="4.7" r=".8" fill="#FFDE00"/><circle cx="12.6" cy="7.4" r=".8" fill="#FFDE00"/><circle cx="11" cy="9.4" r=".8" fill="#FFDE00"/>',
    ES: '<rect width="30" height="20" fill="#AA151B"/><rect y="5" width="30" height="10" fill="#F1BF00"/>',
    FR: '<rect width="30" height="20" fill="#EF4135"/><rect width="20" height="20" fill="#fff"/><rect width="10" height="20" fill="#0055A4"/>',
    BR: '<rect width="30" height="20" fill="#009B3A"/><path d="M15 2.2 27.4 10 15 17.8 2.6 10z" fill="#FEDF00"/><circle cx="15" cy="10" r="4.6" fill="#002776"/>',
    RU: '<rect width="30" height="20" fill="#D52B1E"/><rect width="30" height="13.4" fill="#0039A6"/><rect width="30" height="6.7" fill="#fff"/>',
    DE: '<rect width="30" height="20" fill="#FFCE00"/><rect width="30" height="13.4" fill="#DD0000"/><rect width="30" height="6.7" fill="#000"/>',
    JP: '<rect width="30" height="20" fill="#fff"/><circle cx="15" cy="10" r="5.6" fill="#BC002D"/>',
    IT: '<rect width="30" height="20" fill="#CE2B37"/><rect width="20" height="20" fill="#fff"/><rect width="10" height="20" fill="#009246"/>',
    UA: '<rect width="30" height="20" fill="#FFD700"/><rect width="30" height="10" fill="#0057B7"/>'
  };
  const emojiOf = cc => String.fromCodePoint(...[...cc].map(c => 0x1f1a5 + c.charCodeAt(0)));
  let emojiFlags = null;
  function flagsSupported() {
    if (emojiFlags !== null) return emojiFlags;
    emojiFlags = /Mac|iPhone|iPad|Android/.test(navigator.userAgent); // fast path
    if (!emojiFlags) {
      try {
        const c = document.createElement('canvas'); c.width = c.height = 32;
        const x = c.getContext('2d', { willReadFrequently: true });
        x.textBaseline = 'top'; x.font = '28px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
        x.fillText(emojiOf('FR'), 0, 0);
        const d = x.getImageData(0, 0, 32, 32).data;
        for (let i = 0; i < d.length; i += 4) if (d[i + 3] && (Math.abs(d[i] - d[i + 1]) > 40 || Math.abs(d[i + 1] - d[i + 2]) > 40)) { emojiFlags = true; break; }
      } catch {}
    }
    return emojiFlags;
  }
  function flag(cc) {
    const span = document.createElement('span');
    span.className = 'lang-flag';
    span.setAttribute('aria-hidden', 'true');
    if (flagsSupported()) span.textContent = emojiOf(cc);
    else { span.classList.add('is-svg'); span.innerHTML = `<svg viewBox="0 0 30 20">${FLAG_SVG[cc]}</svg>`; }
    return span;
  }

  // ---------- the picker ----------
  const root = document.querySelector('[data-lang-picker]');
  if (!root) return;
  const button = root.querySelector('.lang-btn');
  const current = LANGS.find(l => l[0] === lang) || LANGS[0];
  button.querySelector('.lang-flag').replaceWith(flag(current[3]));
  button.querySelector('.lang-name').textContent = current[1];
  button.setAttribute('aria-label', `${t('Language')}: ${current[1]}`);

  const pop = document.createElement('div');
  pop.className = 'lang-pop';
  pop.id = 'lang-menu';
  pop.setAttribute('role', 'menu');
  pop.setAttribute('aria-label', t('Choose a language'));
  pop.innerHTML = `<p class="lang-head" aria-hidden="true">${t('Language')}</p><span class="lang-hl" aria-hidden="true"></span>`;
  const options = LANGS.map(([code, native, english, cc], i) => {
    const opt = document.createElement('button');
    opt.type = 'button';
    opt.className = 'lang-opt';
    opt.setAttribute('role', 'menuitemradio');
    opt.setAttribute('aria-checked', String(code === lang));
    opt.lang = code;
    opt.dataset.code = code;
    opt.style.setProperty('--i', i);
    opt.tabIndex = -1;
    opt.setAttribute('data-pointer-exact', ''); // the cursor becomes the row highlight
    opt.append(flag(cc));
    opt.insertAdjacentHTML('beforeend', `<span class="lang-native">${native}</span><span class="lang-en">${english}</span><svg class="lang-check" viewBox="0 0 24 24" aria-hidden="true"><path d="m5.5 12.5 4 4 9-9.5"/></svg>`);
    pop.append(opt);
    return opt;
  });
  root.append(pop);
  button.setAttribute('aria-controls', pop.id);

  const hl = pop.querySelector('.lang-hl');
  function highlight(opt) {
    if (!opt) { hl.classList.remove('is-on'); return; }
    hl.style.transform = `translate(${opt.offsetLeft}px, ${opt.offsetTop}px)`;
    hl.style.width = `${opt.offsetWidth}px`;
    hl.style.height = `${opt.offsetHeight}px`;
    hl.classList.add('is-on');
  }

  let open = false;
  function setOpen(value, focusButton) {
    if (open === value) return;
    open = value;
    if (value) {
      // Open upwards if there isn't room below.
      pop.classList.remove('is-up');
      const r = button.getBoundingClientRect();
      if (innerHeight - r.bottom < pop.offsetHeight + 24 && r.top > innerHeight - r.bottom) pop.classList.add('is-up');
      const active = options.find(o => o.dataset.code === lang) || options[0];
      hl.style.transition = 'none'; highlight(active); void hl.offsetWidth; hl.style.transition = '';
      active.focus({ preventScroll: true });
      document.addEventListener('pointerdown', outside, true);
    } else {
      document.removeEventListener('pointerdown', outside, true);
      highlight(null);
      if (focusButton) button.focus({ preventScroll: true });
    }
    root.classList.toggle('is-open', value);
    pop.classList.toggle('is-open', value);
    button.setAttribute('aria-expanded', String(value));
  }
  const outside = e => { if (!root.contains(e.target)) setOpen(false); };
  button.addEventListener('click', () => setOpen(!open));

  pop.addEventListener('pointermove', e => { const o = e.target.closest('.lang-opt'); if (o) highlight(o); });
  pop.addEventListener('pointerleave', () => highlight(options.find(o => o === document.activeElement) || null));
  options.forEach(o => o.addEventListener('focus', () => highlight(o)));

  pop.addEventListener('keydown', e => {
    const i = options.indexOf(document.activeElement);
    const go = n => { e.preventDefault(); options[(n + options.length) % options.length].focus({ preventScroll: true }); };
    if (e.key === 'ArrowDown') go(i + 1);
    else if (e.key === 'ArrowUp') go(i - 1);
    else if (e.key === 'Home') go(0);
    else if (e.key === 'End') go(options.length - 1);
    else if (e.key === 'Escape') { e.preventDefault(); setOpen(false, true); }
    else if (e.key === 'Tab') setOpen(false);
  });
  root.addEventListener('keydown', e => { if (e.key === 'Escape' && open) setOpen(false, true); });

  pop.addEventListener('click', e => {
    const opt = e.target.closest('.lang-opt');
    if (!opt) return;
    const code = opt.dataset.code;
    if (code === lang) { setOpen(false, true); return; }
    options.forEach(o => o.setAttribute('aria-checked', String(o === opt)));
    try { if (code === 'en') localStorage.removeItem('lang'); else localStorage.setItem('lang', code); } catch {}
    const url = new URL(location.href);
    if (code === 'en') url.searchParams.delete('lang'); else url.searchParams.set('lang', code);
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    setTimeout(() => {
      setOpen(false);
      document.documentElement.classList.add('lang-leaving');
      setTimeout(() => location.assign(url.toString()), reduced ? 0 : 260);
    }, reduced ? 0 : 220);
  });
})();
