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

// Only time actually presented to the visitor counts toward the entrance.
// Loading in a background tab cannot consume either the logo hold or reveal.
export function createEntranceSequence({
  requestFrame = requestAnimationFrame,
  cancelFrame = cancelAnimationFrame,
  visible = true,
  logoHold = 1350,
  revealDuration = 2600,
  onMark = () => {},
  onReveal = () => {},
  onComplete = () => {},
} = {}) {
  let phase = 'loading';
  let markReady = false;
  let resourcesReady = false;
  let markShown = false;
  let elapsed = 0;
  let previous;
  let frame;
  function schedule() {
    if (visible && phase !== 'complete' && frame === undefined) frame = requestFrame(tick);
  }
  function finish() {
    if (phase === 'complete') return;
    phase = 'complete';
    if (frame !== undefined) cancelFrame(frame);
    frame = undefined;
    onComplete();
  }
  function tick(now) {
    frame = undefined;
    const delta = previous === undefined ? 0 : Math.min(64, Math.max(0, now - previous));
    previous = now;
    if (!visible || phase === 'complete') return;
    if (phase === 'loading') {
      if (markReady && !markShown) { markShown = true; elapsed = 0; onMark(); }
      else if (markShown) elapsed += delta;
      if (resourcesReady && markShown && elapsed >= logoHold) {
        phase = 'revealing';
        elapsed = 0;
        onReveal();
      }
    } else {
      elapsed += delta;
      if (elapsed >= revealDuration) return finish();
    }
    schedule();
  }
  schedule();
  return {
    markReady() { markReady = true; },
    ready() { resourcesReady = true; markReady = true; },
    setVisible(value) {
      visible = value;
      previous = undefined;
      if (frame !== undefined) cancelFrame(frame);
      frame = undefined;
      schedule();
    },
    finish,
    get phase() { return phase; },
  };
}

export function startIntro(heroReady) {
  const root = document.documentElement;
  const intro = document.querySelector('.site-intro');
  const stage = document.querySelector('.stage');
  if (!intro || root.dataset.intro !== 'loading') return;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const logo = intro.querySelector('.intro-logo');
  const anchor = intro.querySelector('.intro-logo-anchor');
  const target = document.querySelector('.brand .brand-logo');
  const track = intro.querySelector('.intro-track');
  const status = intro.querySelector('.intro-status');
  let focusOnFinish = false;
  const listeners = new AbortController();
  const { signal } = listeners;
  const sequence = createEntranceSequence({
    visible: !document.hidden,
    logoHold: reduced ? 0 : 1350,
    revealDuration: reduced ? 0 : 2600,
    onMark() { root.dataset.introBrand = 'ready'; },
    onReveal() {
      alignLogo();
      status.textContent = 'Enter the extraordinary';
      root.dataset.intro = 'revealing';
    },
    onComplete() {
      root.dataset.intro = 'complete';
      delete root.dataset.introPaused;
      stage.inert = false;
      intro.hidden = true;
      listeners.abort();
      if (focusOnFinish) document.querySelector('#main').focus({ preventScroll: true });
    },
  });

  function alignLogo() {
    // Measure the unmoving anchor, so a mobile toolbar resize updates the
    // flight's endpoint without restarting it or dropping the entrance.
    const from = anchor.getBoundingClientRect();
    const to = target.getBoundingClientRect();
    logo.style.setProperty('--logo-x', `${to.left - from.left}px`);
    logo.style.setProperty('--logo-y', `${to.top - from.top}px`);
    logo.style.setProperty('--logo-scale', String(to.width / from.width));
  }
  function syncVisibility() {
    root.dataset.introPaused = String(document.hidden);
    sequence.setVisible(!document.hidden);
    alignLogo();
  }
  function skip() { focusOnFinish = true; sequence.finish(); }
  stage.inert = true;
  intro.querySelector('.intro-skip').addEventListener('click', skip, { signal });
  document.querySelector('.skip-link').addEventListener('click', skip, { signal });
  document.addEventListener('keydown', event => { if (event.key === 'Escape') skip(); }, { signal });
  document.addEventListener('visibilitychange', syncVisibility, { signal });
  window.addEventListener('pageshow', syncVisibility, { signal });
  window.addEventListener('resize', alignLogo, { signal });
  syncVisibility();

  const brand = new Image();
  brand.src = document.querySelector('#brand-mask image').getAttribute('href');
  const brandReady = waitForImage(brand);
  brandReady.then(() => sequence.markReady(), () => sequence.markReady());
  const resources = [
    ...[...document.querySelectorAll('.scenery > img, .cloud-layer img, .drifting-fog img')].map(waitForImage),
    brandReady,
    heroReady,
    document.fonts?.load('350 1em Inter') ?? Promise.resolve(),
  ];
  waitForEntrance(resources, {
    minimum: 0,
    maximum: reduced ? 2500 : 8000,
    onProgress(progress) {
      if (sequence.phase === 'complete') return;
      track.style.setProperty('--load-progress', String(progress));
      track.setAttribute('aria-valuenow', String(Math.round(progress * 100)));
    },
  }).then(() => sequence.ready(), () => sequence.finish());
  // Hand off only once asset deadlines, visibility recovery and Skip are bound.
  window.dispatchEvent(new Event('intro:ready'));
  return sequence;
}
