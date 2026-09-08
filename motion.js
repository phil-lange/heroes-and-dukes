// A single clock drives the sky, mist and cloth, including after page restore.
export function createMotionClock(render, {
  requestFrame = callback => requestAnimationFrame(callback),
  cancelFrame = id => cancelAnimationFrame(id),
} = {}) {
  let frame = null;
  let playing = false;
  let elapsed = 0;
  let lastTime = null;

  function tick(time) {
    frame = null;
    if (!playing) return;
    if (lastTime !== null) elapsed += Math.min(64, Math.max(0, time - lastTime));
    lastTime = time;
    render(elapsed);
    frame = requestFrame(tick);
  }

  render(0);
  return {
    get time() { return elapsed; },
    setPlaying(next) {
      // Re-arm even if the browser froze a pending frame while backgrounded.
      if (frame !== null) cancelFrame(frame);
      frame = null;
      playing = next;
      lastTime = null;
      if (playing) frame = requestFrame(tick);
    },
  };
}

export function waitForImage(image) {
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      image.removeEventListener('load', loaded);
      image.removeEventListener('error', failed);
    };
    const loaded = () => {
      if (!image.naturalWidth) return failed();
      cleanup();
      resolve(image);
    };
    const failed = () => {
      cleanup();
      reject(new Error('An animation image could not be loaded.'));
    };
    if (image.complete) return image.naturalWidth ? loaded() : failed();
    image.addEventListener('load', loaded);
    image.addEventListener('error', failed);
    // The load event also works when decode is unavailable or rejects early.
    if (typeof image.decode === 'function') image.decode().then(loaded, () => {
      if (image.complete) image.naturalWidth ? loaded() : failed();
    });
  });
}

export function bindMotionControls({ clock, toggle, scenery, page = document, host = window }) {
  const preference = host.matchMedia('(prefers-reduced-motion: reduce)');
  let choice = null;
  try { choice = host.sessionStorage.getItem('heroes-dukes-motion'); } catch { /* Storage can be unavailable in private browsing. */ }
  let paused = choice === 'paused' || (choice !== 'playing' && preference.matches);
  let pageActive = true;

  function sync() {
    const running = !paused && pageActive && !page.hidden;
    scenery.classList.toggle('motion-enabled', running);
    scenery.classList.toggle('motion-paused', paused);
    scenery.dataset.motionState = running ? 'playing' : paused ? 'paused' : 'suspended';
    clock.setPlaying(running);
    toggle.setAttribute('aria-pressed', String(!paused));
    toggle.title = paused ? 'Play background animation' : 'Pause background animation';
    const label = toggle.querySelector('.motion-label');
    if (label) label.textContent = paused ? 'Play' : 'Pause';
  }

  toggle.addEventListener('click', () => {
    paused = !paused;
    choice = paused ? 'paused' : 'playing';
    try { host.sessionStorage.setItem('heroes-dukes-motion', choice); } catch { /* Playback still works without storage. */ }
    sync();
  });
  const preferenceChanged = () => {
    if (choice === null) paused = preference.matches;
    sync();
  };
  if (preference.addEventListener) preference.addEventListener('change', preferenceChanged);
  else preference.addListener?.(preferenceChanged);
  page.addEventListener('visibilitychange', sync);
  host.addEventListener('pagehide', () => { pageActive = false; sync(); });
  host.addEventListener('pageshow', () => { pageActive = true; sync(); });
  host.addEventListener('focus', sync);
  toggle.hidden = false;
  sync();
}
