// About, Moonshot: every shot misses the moon and lands on a star. The first one fires once when the sky comes into
// view; after that only a click (or tap, or Enter) on the moon fires the next. Stars stay lit; the count says how
// many misses so far, and each one is a star.
(() => {
  const sky = document.querySelector('.abt-sky');
  if (!sky) return;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const arcs = [...sky.querySelectorAll('.abt-arc')];
  const stars = [...sky.querySelectorAll('.abt-star')];
  const count = sky.querySelector('.abt-n');
  const hint = sky.querySelector('.abt-hint');
  let shots = 0, timer = 0;

  // ViewBox units per CSS pixel, for the width of the shot (see abt-about.css).
  const svg = sky.querySelector('svg');
  new ResizeObserver(() => { if (svg.clientWidth) sky.style.setProperty('--k', (1000 / svg.clientWidth).toFixed(3)); }).observe(svg);

  const say = n => { count.textContent = `${n} ${n === 1 ? 'miss' : 'misses'}, ${n} ${n === 1 ? 'star' : 'stars'}`; };

  function fire() {
    const i = shots % arcs.length;
    shots++;
    clearTimeout(timer);
    arcs.forEach(a => a.classList.remove('abt-go', 'abt-done'));
    const arc = arcs[i], star = stars[i];
    if (reduce) { arc.classList.add('abt-done'); star.classList.add('abt-lit'); say(shots); return; }
    void arc.getBoundingClientRect();              // restart the draw if the same arc fires again
    arc.classList.add('abt-go');
    star.classList.remove('abt-pop');
    timer = setTimeout(() => { star.classList.add('abt-lit', 'abt-pop'); say(shots); }, 1050);
  }

  sky.querySelector('.abt-aim').addEventListener('click', () => { hint.hidden = true; fire(); });

  if (reduce) fire();
  else {
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { io.disconnect(); setTimeout(fire, 450); } }, { threshold: .6 });
    io.observe(sky);
  }
})();
