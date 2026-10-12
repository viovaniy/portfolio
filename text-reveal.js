(() => {
  const stage = document.querySelector('.greeting-stage');
  if (!stage) return;
  const greetings = [['Hello!', 'en'], ['Hallo!', 'de'], ['Bonjour!', 'fr'], ['Привет!', 'ru'], ['Привіт!', 'uk'], ['Hola!', 'es'], ['你好!', 'zh'], ['こんにちは!', 'ja'], ['Ciao!', 'it'], ['Olá!', 'pt'], ['안녕하세요!', 'ko'], ['नमस्ते!', 'hi'], ['مرحبًا!', 'ar']];
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let index = 0, visible = false, timer;
  function updateTimer() {
    clearInterval(timer);
    if (reduced.matches || document.hidden || !visible) return;
    timer = setInterval(() => {
      index = (index + 1) % greetings.length;
      const [text, lang] = greetings[index];
      const next = document.createElement('span');
      next.className = 'greeting-word';
      next.lang = lang;
      next.dir = 'auto';
      next.textContent = text;
      const old = stage.firstElementChild;
      old.style.position = 'absolute';
      const exit = old.animate([{opacity:1,transform:'translateY(0)',filter:'blur(0)'},{opacity:0,transform:'translateY(-65%)',filter:'blur(5px)'}], {duration:280,easing:'ease-in',fill:'forwards'});
      stage.append(next);
      exit.onfinish = () => old.remove();
    }, 3000);
  }
  new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; updateTimer(); }).observe(stage);
  document.addEventListener('visibilitychange', updateTimer);
  reduced.addEventListener('change', updateTimer);
})();
