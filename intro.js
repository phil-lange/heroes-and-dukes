import { waitForImage } from './motion.js';

// Count settled resources, but never hold the entrance hostage to a stalled load.
export function waitForEntrance(resources, {
  minimum = 1100,
  maximum = 6500,
  onProgress = () => {},
  setTimer = setTimeout,
  clearTimer = clearTimeout,
} = {}) {
  return new Promise(resolve => {
    let settled = 0;
    let minimumElapsed = minimum === 0;
    let finished = false;
    const timers = [];
    const finish = reason => {
      if (finished) return;
      finished = true;
      timers.forEach(clearTimer);
      resolve(reason);
    };
    const check = () => {
      if (minimumElapsed && settled === resources.length) finish('ready');
    };
    onProgress(0);
    timers.push(setTimer(() => finish('timeout'), maximum));
    if (!minimumElapsed) timers.push(setTimer(() => { minimumElapsed = true; check(); }, minimum));
    const complete = () => {
      if (finished) return;
      settled++;
      onProgress(settled / resources.length);
      check();
    };
    resources.forEach(resource => Promise.resolve(resource).then(complete, complete));
    check();
  });
}

export function startIntro(heroReady) {
  const root = document.documentElement;
  const intro = document.querySelector('.site-intro');
  const stage = document.querySelector('.stage');
  if (!intro || root.dataset.intro !== 'loading') return;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const logo = intro.querySelector('.intro-logo');
  const target = document.querySelector('.brand .brand-logo');
  const track = intro.querySelector('.intro-track');
  const status = intro.querySelector('.intro-status');
  let finished = false;
  let finishTimer;

  function finish(focus = false) {
    if (finished) return;
    finished = true;
    clearTimeout(finishTimer);
    root.dataset.intro = 'complete';
    stage.inert = false;
    intro.hidden = true;
    document.removeEventListener('keydown', onKey);
    if (focus) document.querySelector('#main').focus({ preventScroll: true });
  }
  function onKey(event) {
    if (event.key === 'Escape') finish(true);
  }
  function reveal() {
    if (finished || root.dataset.intro === 'complete') return finish();
    if (reduced || document.hidden) return finish();
    const from = logo.getBoundingClientRect();
    const to = target.getBoundingClientRect();
    logo.style.setProperty('--logo-x', `${to.left - from.left}px`);
    logo.style.setProperty('--logo-y', `${to.top - from.top}px`);
    logo.style.setProperty('--logo-scale', String(to.width / from.width));
    status.textContent = 'Enter the extraordinary';
    root.dataset.intro = 'revealing';
    finishTimer = setTimeout(finish, 1900);
  }

  stage.inert = true;
  intro.querySelector('.intro-skip').addEventListener('click', () => finish(true));
  document.addEventListener('keydown', onKey);
  window.addEventListener('pageshow', event => { if (event.persisted) finish(); });
  // Complete cleanly if the viewport changes during the logo's flight.
  window.addEventListener('resize', () => { if (root.dataset.intro === 'revealing') finish(); });

  const brand = new Image();
  brand.src = document.querySelector('#brand-mask image').getAttribute('href');
  const resources = [
    ...[...document.querySelectorAll('.scenery > img, .cloud-layer img, .drifting-fog img')].map(waitForImage),
    waitForImage(brand),
    heroReady,
    document.fonts?.load('350 1em Inter') ?? Promise.resolve(),
  ];
  waitForEntrance(resources, {
    minimum: reduced ? 0 : 1100,
    maximum: reduced ? 2500 : 6500,
    onProgress(progress) {
      if (finished) return;
      track.style.setProperty('--load-progress', String(progress));
      track.setAttribute('aria-valuenow', String(Math.round(progress * 100)));
    },
  }).then(reveal, () => finish());
}
