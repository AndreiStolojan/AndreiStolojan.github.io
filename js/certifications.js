// Certifications, the tape library with labels only. A click on a tape loads it: its slot empties, the drive shows its volume
// and restores the document once. The first tape is in the drive from the start; its restore plays the first time the drive
// comes into view. Under reduced motion every load is instant.
(() => {
  const sec = document.querySelector('.certs-sec');
  if (!sec) return;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const tapes = [...sec.querySelectorAll('.certs-tape')], vols = [...sec.querySelectorAll('.certs-vol')], drive = sec.querySelector('.certs-drive');

  // Puts tape `i` in the drive; `play` restores its document with the one-shot animation.
  const load = (i, play) => {
    tapes.forEach((t, j) => t.setAttribute('aria-pressed', String(j === i)));
    vols.forEach((v, j) => { v.hidden = j !== i; v.classList.remove('certs-play'); });
    drive.classList.toggle('certs-blankd', !vols[i].querySelector('.certs-doc img'));
    if (play && !reduce) { void vols[i].offsetWidth; vols[i].classList.add('certs-play'); }
  };
  let io = null;
  tapes.forEach((t, i) => t.addEventListener('click', () => {
    if (t.getAttribute('aria-pressed') === 'true') return;
    io?.disconnect(); drive.classList.remove('certs-wait');      // a click before the drive is seen still restores
    load(i, true);
  }));

  load(0, false);
  if (reduce) return;
  drive.classList.add('certs-wait');
  io = new IntersectionObserver(([e]) => {
    if (!e.isIntersecting) return;
    io.disconnect();
    drive.classList.remove('certs-wait');
    const i = tapes.findIndex(t => t.getAttribute('aria-pressed') === 'true');
    load(i, true);
  }, { threshold: .35 });
  io.observe(drive);
})();
