// Contact brief: a fill-in-the-blanks letter that writes a Telegram message
// live in the preview, then hands it to Telegram (or the clipboard).
(() => {
  const root = document.querySelector('[data-brief]');
  if (!root) return;
  const form = document.getElementById('project-brief');
  const review = document.getElementById('brief-review');
  const briefText = document.getElementById('brief-text');
  const status = document.getElementById('copy-status');
  const error = root.querySelector('.brief-error');
  const bubble = root.querySelector('.brief-bubble');
  const progress = root.querySelector('.brief-progress');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const required = ['name', 'contact', 'project'];
  const keys = ['name', 'contact', 'project', 'budget', 'timeline'];
  form.hidden = false;
  root.classList.add('is-live');

  const value = key => String(new FormData(form).get(key) || '').trim();
  const parts = Object.fromEntries(keys.map(key => [key, bubble.querySelector(`[data-part="${key}"]`)]));
  const fieldOf = key => root.querySelector(`[data-key="${key}"]`);

  // Inputs grow with their text (measured with a hidden mirror).
  const mirror = document.createElement('span');
  mirror.setAttribute('aria-hidden', 'true');
  mirror.style.cssText = 'position:absolute;visibility:hidden;white-space:pre;pointer-events:none;left:-9999px;top:0';
  form.append(mirror);
  function fit(input) {
    const style = getComputedStyle(input);
    mirror.style.font = style.font;
    mirror.style.letterSpacing = style.letterSpacing;
    mirror.textContent = input.value || input.placeholder;
    const max = input.closest('.brief-line').clientWidth;
    input.style.setProperty('--w', `${Math.min(max, Math.ceil(mirror.getBoundingClientRect().width) + 2)}px`);
  }
  const textarea = form.elements.namedItem('project');
  function grow() {
    textarea.style.height = 'auto';
    textarea.style.height = `${textarea.scrollHeight}px`;
  }

  function message() {
    return [
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
  }

  let bumpTimer;
  function render(changedKey) {
    let filled = 0;
    for (const key of keys) {
      const text = value(key);
      if (text) filled++;
      if (parts[key].textContent !== text) parts[key].textContent = text;
      const field = fieldOf(key);
      field?.classList.toggle('is-filled', Boolean(text));
      if (text) field?.classList.remove('is-invalid');
    }
    progress.style.setProperty('--p', (filled / keys.length).toFixed(3));
    progress.querySelector('b').textContent = `${filled} of ${keys.length} filled`;
    root.classList.toggle('is-complete', required.every(key => value(key)));
    if (changedKey && !reduced.matches) {
      bubble.classList.add('is-bump');
      clearTimeout(bumpTimer);
      bumpTimer = setTimeout(() => bubble.classList.remove('is-bump'), 140);
    }
  }

  // The part of the message you're editing lights up in the preview.
  const highlight = key => keys.forEach(k => parts[k].classList.toggle('is-active', k === key));
  form.addEventListener('focusin', event => highlight(event.target.closest('[data-key]')?.dataset.key));
  form.addEventListener('focusout', () => setTimeout(() => { if (!form.contains(document.activeElement)) highlight(null); }, 0));

  form.addEventListener('input', event => {
    resetConversation();
    const key = event.target.closest('[data-key]')?.dataset.key;
    if (event.target.matches('.brief-field input')) fit(event.target);
    if (event.target === textarea) grow();
    error.textContent = '';
    setReady(false);
    render(key);
  });

  const typing = root.querySelector('.im-typing');
  const reply = root.querySelector('.im-reply');
  const sentBubble = bubble;
  let timers = [];
  const later = (ms, fn) => timers.push(setTimeout(fn, ms));
  function resetConversation() {
    timers.forEach(clearTimeout);
    timers = [];
    typing.hidden = true;
    reply.hidden = true;
    sentBubble.classList.remove('is-sending');
  }
  const pop = el => { el.hidden = false; if (!reduced.matches) { el.classList.remove('im-pop'); void el.offsetWidth; el.classList.add('im-pop'); } };

  function setReady(ready) {
    root.classList.toggle('is-ready', ready);
    if (ready === !review.hidden) return;
    review.hidden = !ready;
    if (ready && !reduced.matches) {
      review.animate([{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'none' }],
        { duration: 420, easing: 'cubic-bezier(.22,1,.36,1)' });
    }
  }

  form.addEventListener('submit', event => {
    event.preventDefault();
    const missing = required.filter(key => !value(key));
    if (missing.length) {
      missing.forEach(key => {
        const field = fieldOf(key);
        field.classList.remove('is-invalid');
        void field.offsetWidth; // replay the shake
        field.classList.add('is-invalid');
      });
      const names = { name: 'your name', contact: 'how to reach you', project: 'what you’re working on' };
      error.textContent = `Add ${missing.map(key => names[key]).join(', ').replace(/, ([^,]*)$/, ' and $1')} to continue.`;
      form.elements.namedItem(missing[0]).focus();
      return;
    }
    const text = message();
    briefText.value = text;
    const url = new URL('https://t.me/designmevova');
    url.searchParams.set('text', text);
    document.getElementById('telegram-brief').href = url.href;
    status.textContent = '';
    // Send sequence: whoosh, viovaniy types for ~2s, replies, then the actions.
    resetConversation();
    setReady(false);
    root.classList.add('is-ready');
    const finish = () => {
      setReady(true);
      document.getElementById('review-title').focus({ preventScroll: true });
    };
    if (reduced.matches) { reply.hidden = false; finish(); }
    else {
      sentBubble.classList.add('is-sending');
      later(550, () => sentBubble.classList.remove('is-sending'));
      later(500, () => pop(typing));
      later(2500, () => { typing.hidden = true; pop(reply); });
      later(3000, finish);
    }
    // On narrow screens the preview sits below; bring it into view.
    if (matchMedia('(max-width: 900px)').matches) {
      root.querySelector('.brief-preview').scrollIntoView({ behavior: reduced.matches ? 'instant' : 'smooth', block: 'center' });
    }
  });

  document.getElementById('copy-brief').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(briefText.value);
      status.textContent = 'Copied. Paste it in Telegram whenever you like.';
    } catch {
      status.textContent = 'Couldn’t copy automatically — use Continue in Telegram instead.';
    }
  });

  // iMessage-style timestamp: "Today 20:30".
  const stamp = root.querySelector('[data-im-time]');
  if (stamp) stamp.textContent = `Today ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;

  const fitAll = () => { form.querySelectorAll('.brief-field input').forEach(fit); grow(); };
  new ResizeObserver(fitAll).observe(form);
  document.fonts?.ready.then(fitAll);
  fitAll();
  render();
})();
