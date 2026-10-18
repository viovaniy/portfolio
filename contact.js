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
      'Hello! I would like to discuss a motion design project.',
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
    const complete = required.every(key => value(key));
    if (complete && !root.classList.contains('is-complete') && !reduced.matches && changedKey) {
      const send = root.querySelector('.im-send');
      send.classList.remove('is-celebrate');
      void send.offsetWidth;
      send.classList.add('is-celebrate');
      setTimeout(() => send.classList.remove('is-celebrate'), 800);
      confetti(send);
    }
    root.classList.toggle('is-complete', complete);
    if (changedKey && !reduced.matches) {
      bubble.classList.add('is-bump');
      clearTimeout(bumpTimer);
      bumpTimer = setTimeout(() => bubble.classList.remove('is-bump'), 140);
    }
  }

  // A small confetti burst from the send button when the brief completes.
  // Particles live in a fixed layer so the preview's rounded clip never cuts
  // them; transforms and opacity only, then the layer is removed.
  const COLORS = ['#0b84fe', '#ff7eaa', '#ffb48f', '#b596f2', '#34c759', '#ffd36e'];
  function confetti(origin, count = 24, reach = 1) {
    const r = origin.getBoundingClientRect();
    const layer = document.createElement('div');
    layer.className = 'im-confetti';
    layer.setAttribute('aria-hidden', 'true');
    layer.style.left = `${r.left + r.width / 2}px`;
    layer.style.top = `${r.top + r.height / 2}px`;
    document.body.append(layer);
    let longest = 0;
    for (let i = 0; i < count; i++) {
      const piece = document.createElement('i');
      const kind = i % 3;
      piece.className = kind === 0 ? 'is-dot' : kind === 1 ? 'is-strip' : 'is-star';
      piece.style.setProperty('--c', COLORS[i % COLORS.length]);
      layer.append(piece);
      // Mostly upward and outward, a few sideways.
      const angle = (-90 + (Math.random() * 2 - 1) * 80) * Math.PI / 180;
      const distance = (46 + Math.random() * 54) * reach;
      const dx = Math.cos(angle) * distance;
      const dy = Math.sin(angle) * distance;
      const spin = (Math.random() < .5 ? -1 : 1) * (180 + Math.random() * 360);
      const duration = 1000 + Math.random() * 450;
      const delay = Math.random() * 60;
      longest = Math.max(longest, duration + delay);
      piece.animate([
        { transform: 'translate(-50%, -50%) scale(.3) rotate(0deg)', opacity: 1 },
        { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(1) rotate(${spin * .55}deg)`, opacity: 1, offset: .42, easing: 'cubic-bezier(.3,0,.7,.6)' },
        { opacity: 1, offset: .72 },
        { transform: `translate(calc(-50% + ${dx * 1.18}px), calc(-50% + ${dy + 46}px)) scale(.85) rotate(${spin}deg)`, opacity: 0 }
      ], { duration, delay, easing: 'cubic-bezier(.12,.75,.3,1)', fill: 'both' });
    }
    setTimeout(() => layer.remove(), longest + 50);
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

  const tapback = root.querySelector('.im-tapback');
  const readTime = root.querySelector('[data-read-time]');
  const sentBubble = bubble;
  let timers = [];
  const later = (ms, fn) => timers.push(setTimeout(fn, ms));
  function resetConversation() {
    timers.forEach(clearTimeout);
    timers = [];
    root.classList.remove('is-read', 'is-loved');
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

  // ---------- Sending to email ----------
  // Paste the Web3Forms access key here (get one free at web3forms.com with
  // the inbox the briefs should go to). Until it is set the visitor still
  // sees the success screen, but briefs are NOT delivered anywhere.
  const WEB3FORMS_KEY = '';

  const done = root.querySelector('.brief-done');
  const sentText = done.querySelector('[data-sent-text]');
  const STATES = ['is-sending', 'is-sent', 'is-failed'];
  const setState = state => { root.classList.remove(...STATES); if (state) root.classList.add(state); };

  function showCard() {
    const reveal = () => {
      root.classList.remove('is-folding');
      root.classList.add('is-done');
      done.hidden = false;
      if (!reduced.matches) { done.classList.remove('is-in'); void done.offsetWidth; done.classList.add('is-in'); }
      done.querySelector('.brief-done-title').focus({ preventScroll: true });
      if (matchMedia('(max-width: 900px)').matches) done.scrollIntoView({ behavior: reduced.matches ? 'instant' : 'smooth', block: 'center' });
    };
    if (reduced.matches || root.classList.contains('is-done')) { reveal(); return; }
    root.classList.add('is-folding');
    setTimeout(reveal, 420);
  }
  function backToForm() {
    root.classList.remove('is-done', 'is-folding', 'is-sending-chat', 'is-ready');
    setState(null);
    done.hidden = true;
    resetConversation();
    setReady(false);
    if (!reduced.matches) form.animate([{ opacity: 0, transform: 'translateY(12px)', filter: 'blur(5px)' }, { opacity: 1, transform: 'none', filter: 'blur(0)' }],
      { duration: 520, easing: 'cubic-bezier(.16,1,.3,1)' });
  }
  done.querySelector('.brief-edit').addEventListener('click', () => {
    const fresh = root.classList.contains('is-sent');
    backToForm();
    if (fresh) {
      // A new brief starts from the project; who you are stays filled in.
      textarea.value = '';
      form.querySelectorAll('input[type=radio]').forEach(radio => { radio.checked = false; });
      grow();
      render();
    }
    form.elements.namedItem('project').focus({ preventScroll: true });
  });

  async function deliver() {
    // No key yet: confirm to the visitor anyway (delivery starts once the key is added).
    if (!WEB3FORMS_KEY) { console.info('Brief not delivered: add WEB3FORMS_KEY in contact.js'); return; }
    const contact = value('contact');
    const response = await fetch('https://api.web3forms.com/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        access_key: WEB3FORMS_KEY,
        subject: `New project brief from ${value('name')}`,
        from_name: 'viovaniy portfolio',
        ...(contact.includes('@') && !contact.startsWith('@') ? { replyto: contact } : {}),
        name: value('name'),
        contact,
        project: value('project'),
        budget: value('budget') || 'To be discussed',
        timeline: value('timeline') || 'Flexible',
        message: message(),
        botcheck: form.elements.namedItem('botcheck').checked
      })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.success) throw new Error(result.message || `HTTP ${response.status}`);
  }

  let sending = false;
  async function send() {
    if (sending) return;
    sending = true;
    briefText.value = message();
    const started = performance.now();
    resetConversation();
    setReady(false);
    setState('is-sending');
    root.classList.add('is-sending-chat');
    showCard();
    // The chat whooshes the message while it sends.
    if (!reduced.matches) {
      sentBubble.classList.add('is-sending');
      later(550, () => sentBubble.classList.remove('is-sending'));
    }
    let ok = true;
    try { await deliver(); } catch (problem) { ok = false; console.warn('Brief not delivered:', problem.message); }
    // Let the "sending" moment breathe a little even on a fast connection.
    const wait = reduced.matches ? 0 : Math.max(0, 900 - (performance.now() - started));
    setTimeout(() => {
      sending = false;
      root.classList.remove('is-sending-chat');
      if (ok) {
        setState('is-sent');
        const name = value('name'), contact = value('contact');
        sentText.textContent = `Thank you, ${name}. I’ll review your brief and reply to ${contact} within one business day.`;
        root.classList.add('is-ready');
        // iMessage: Sent → Read → a heart tapback on the message.
        readTime.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        if (!reduced.matches) {
          confetti(done.querySelector('.brief-done-mark'), 40, 1.6);
          later(1400, () => root.classList.add('is-read'));
          later(2300, () => root.classList.add('is-loved'));
        } else root.classList.add('is-read', 'is-loved');
      } else {
        setState('is-failed');
        root.classList.add('is-failed');
      }
      done.querySelector('.brief-done-title').focus({ preventScroll: true });
    }, wait);
  }
  done.querySelector('.brief-retry').addEventListener('click', send);

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
      const names = { name: 'your name', contact: 'your contact details', project: 'a short project description' };
      error.textContent = `Please add ${missing.map(key => names[key]).join(', ').replace(/, ([^,]*)$/, ' and $1')} to continue.`;
      form.elements.namedItem(missing[0]).focus();
      return;
    }
    if (form.elements.namedItem('botcheck').checked) return; // spam bot
    send();
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
