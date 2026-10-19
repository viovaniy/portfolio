// Phones: the iMessage card is hidden, so these two buttons in the form open
// its references and video-call sheets, which then rise as bottom sheets.
(() => {
  const preview = document.querySelector('.brief-preview');
  const tools = document.querySelector('.brief-tools');
  if (!preview || !tools) return;
  const plus = preview.querySelector('.im-plus');
  const video = preview.querySelector('.im-video');
  const refsTool = tools.querySelector('[data-tool="refs"]');
  const callTool = tools.querySelector('[data-tool="call"]');

  refsTool.addEventListener('click', () => plus?.click());
  callTool.addEventListener('click', () => video?.click());

  // Tapping the dimmed backdrop closes the open sheet.
  preview.addEventListener('click', event => {
    if (event.target !== preview) return;
    window.briefRefs?.close?.();
    window.briefCall?.close?.();
  });

  const sync = () => {
    const count = window.briefRefs?.count?.() || 0;
    const refsBadge = refsTool.querySelector('.brief-tool-badge');
    refsBadge.textContent = count;
    refsBadge.hidden = !count;
    refsTool.classList.toggle('is-on', count > 0);
    const booked = Boolean(window.briefCall?.get?.());
    const callBadge = callTool.querySelector('.brief-tool-badge');
    callBadge.textContent = '✓';
    callBadge.hidden = !booked;
    callTool.classList.toggle('is-on', booked);
    refsTool.setAttribute('aria-expanded', preview.classList.contains('is-refs-open'));
    callTool.setAttribute('aria-expanded', preview.classList.contains('is-call-open'));
  };
  new MutationObserver(sync).observe(preview, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['hidden', 'class'] });
  sync();
})();
