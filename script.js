import { createMotionClock, waitForImage, bindMotionControls } from './motion.js';

// Replace null with real URLs, including a mailto: URL for contact if desired.
// Until configured, demo controls clearly identify the missing destination.
const destinations = Object.freeze({ games: null, publishing: null, about: null, contact: null });
const destinationLabels = { games: 'The games page', publishing: 'The publishing page', about: 'The about page', contact: 'The contact link' };
const dialog = document.querySelector('.preview-dialog');
let returnFocus;

document.addEventListener('click', event => {
  const trigger = event.target.closest('[data-destination]');
  if (trigger) {
    const key = trigger.dataset.destination;
    document.querySelectorAll('details[open]').forEach(menu => { menu.open = false; });
    const destination = destinations[key];
    if (destination) { window.location.assign(destination); return; }
    returnFocus = trigger.closest('.mobile-links') ? document.querySelector('.mobile-menu > summary') : trigger;
    if (trigger.closest('.dropdown')) returnFocus = document.querySelector('.games-menu > summary');
    document.querySelector('#preview-description').textContent = `${destinationLabels[key]} has not been connected in this HTML example.`;
    dialog.showModal();
    return;
  }
  document.querySelectorAll('details[open]').forEach(menu => { if (!menu.contains(event.target)) menu.open = false; });
});
dialog.addEventListener('click', event => { if (event.target === dialog) { const r = dialog.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) dialog.close(); } });
dialog.addEventListener('close', () => returnFocus?.focus());
document.addEventListener('keydown', event => { if (event.key === 'Escape') document.querySelectorAll('details[open]').forEach(menu => { menu.open = false; menu.querySelector('summary').focus(); }); });

// Sample one cloth texture through a continuous, pinned displacement field.
// Premultiplied bilinear sampling keeps translucent fabric edges clean.
function createCapeFlow(texture, weights, context) {
  const { width, height, data } = texture;
  const premultiplied = new Float32Array(data.length);
  for (let i = 0; i < data.length; i += 4) {
    const alpha = data[i + 3] / 255;
    premultiplied[i] = data[i] * alpha;
    premultiplied[i + 1] = data[i + 1] * alpha;
    premultiplied[i + 2] = data[i + 2] * alpha;
    premultiplied[i + 3] = alpha;
  }
  const output = context.createImageData(width, height);
  output.data.set(data);
  const points = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const pixel = y * width + x;
      if (weights[pixel] === 0) continue;
      const free = Math.max(0, Math.min(1, (145 - x) / 115));
      const reach = free * free * (3 - 2 * free);
      const phase = free * 2.8 - y / height * .8;
      points.push({
        i: pixel * 4, x, y, amplitude: weights[pixel] * reach,
        sin: Math.sin(phase), cos: Math.cos(phase),
        sinRipple: Math.sin(phase * 1.7), cosRipple: Math.cos(phase * 1.7),
      });
    }
  }
  return milliseconds => {
    const time = milliseconds / 1000;
    const windSin = Math.sin(time * 1.15), windCos = Math.cos(time * 1.15);
    const rippleSin = Math.sin(time * 2.05 + .6), rippleCos = Math.cos(time * 2.05 + .6);
    for (const point of points) {
      const wave = windSin * point.cos - windCos * point.sin;
      const ripple = rippleSin * point.cosRipple - rippleCos * point.sinRipple;
      const sx = Math.max(0, Math.min(width - 1.001,
        point.x - point.amplitude * (2.8 * wave + .8 * ripple)));
      const sy = Math.max(0, Math.min(height - 1.001,
        point.y - point.amplitude * (12 * wave + 2.5 * ripple)));
      const x0 = Math.floor(sx), y0 = Math.floor(sy);
      const dx = sx - x0, dy = sy - y0;
      const a = (y0 * width + x0) * 4;
      const b = a + 4, c = a + width * 4, d = c + 4;
      const wa = (1 - dx) * (1 - dy), wb = dx * (1 - dy);
      const wc = (1 - dx) * dy, wd = dx * dy;
      const alpha = premultiplied[a + 3] * wa + premultiplied[b + 3] * wb
        + premultiplied[c + 3] * wc + premultiplied[d + 3] * wd;
      for (let channel = 0; channel < 3; channel++) {
        output.data[point.i + channel] = alpha > .0001
          ? (premultiplied[a + channel] * wa + premultiplied[b + channel] * wb
            + premultiplied[c + channel] * wc + premultiplied[d + channel] * wd) / alpha
          : 0;
      }
      output.data[point.i + 3] = alpha * 255;
    }
    context.putImageData(output, 0, 0);
  };
}

// Draw the body once. Only a separate patch of free cape fabric can animate.
// Generated differences in head, torso, backpack or legs are never played back.
async function createHeroCloth(layer) {
  const source = layer.querySelector('.hero-sprite-source');
  const plate = layer.querySelector('.hero-clean-plate');
  const body = layer.querySelector('.hero-body');
  const canvas = layer.querySelector('.hero-cape');
  await Promise.all([waitForImage(source), waitForImage(plate)]);
  const context = canvas.getContext('2d');
  if (!context) throw new Error('The sprite canvas is unavailable.');

  const cellWidth = source.naturalWidth / 4;
  const cellHeight = source.naturalHeight / 2;
  body.width = cellWidth;
  body.height = cellHeight;
  const atlas = document.createElement('canvas');
  // Only one cel is used. Avoid allocating and keying the other seven on phones.
  atlas.width = cellWidth;
  atlas.height = cellHeight;
  const atlasContext = atlas.getContext('2d', { willReadFrequently: true });
  atlasContext.drawImage(source, 0, 0, cellWidth, cellHeight, 0, 0, cellWidth, cellHeight);
  const pixels = atlasContext.getImageData(0, 0, atlas.width, atlas.height);
  for (let i = 0; i < pixels.data.length; i += 4) {
    const r = pixels.data[i], g = pixels.data[i + 1], b = pixels.data[i + 2];
    const alpha = 1 - Math.max(0, Math.min(1, (g - Math.max(r, b) - 12) / 210));
    pixels.data[i + 3] = Math.round(255 * alpha);
    if (alpha > 0 && alpha < 1) {
      pixels.data[i] = Math.min(255, r / alpha);
      pixels.data[i + 1] = Math.min(255, Math.min(g, Math.max(r, b)) / alpha);
      pixels.data[i + 2] = Math.min(255, b / alpha);
    }
  }
  atlasContext.putImageData(pixels, 0, 0);

  // This rectangle stays left of the torso and below the collar and arm.
  // Its inner mask pins the cloth against the body while the outer hem flows.
  const cape = { x: 0, y: 232, width: 158, height: 156 };
  canvas.width = cape.width;
  canvas.height = cape.height;
  Object.assign(canvas.style, {
    left: `${cape.x / cellWidth * 100}%`,
    top: `${cape.y / cellHeight * 100}%`,
    width: `${cape.width / cellWidth * 100}%`,
    height: `${cape.height / cellHeight * 100}%`,
  });
  const bodyContext = body.getContext('2d');
  bodyContext.drawImage(atlas, 0, 0, cellWidth, cellHeight, 0, 0, cellWidth, cellHeight);
  bodyContext.clearRect(cape.x, cape.y, cape.width, cape.height);
  const fixed = atlasContext.getImageData(cape.x, cape.y, cape.width, cape.height);
  const smooth = (a, b, value) => {
    const t = Math.max(0, Math.min(1, (value - a) / (b - a)));
    return t * t * (3 - 2 * t);
  };
  const weights = new Float32Array(cape.width * cape.height);
  for (let y = 0; y < cape.height; y++) {
    const sourceY = cape.y + y;
    const innerEdge = sourceY < 270 ? 120 + (sourceY - 234) * .75 : 147 - (sourceY - 270) * .29;
    for (let x = 0; x < cape.width; x++) {
      weights[y * cape.width + x] = smooth(234, 252, sourceY)
        * (1 - smooth(367, 386, sourceY)) * smooth(0, 16, innerEdge - x);
    }
  }
  // The same fabric pixels flow at every frame; no sprite swaps or dissolves.
  const draw = createCapeFlow(fixed, weights, context);

  draw(0);
  layer.classList.add('is-ready');
  return elapsed => {
    draw(elapsed);
    canvas.dataset.capeTime = (elapsed / 1000).toFixed(3);
  };
}

// One control keeps the sky, mist and hero in the same playback state.
function animateAtmosphere() {
  const scenery = document.querySelector('.scenery');
  const artwork = scenery.querySelector(':scope > img');
  const atmosphere = scenery.querySelector('.atmosphere');
  const heroLayer = scenery.querySelector('.hero-life');
  const toggle = document.querySelector('.motion-toggle');
  const clouds = scenery.querySelector('.cloud-layer img');
  const mist = scenery.querySelector('.drifting-fog img');
  let drawCape;

  function fitArtwork() {
    const width = artwork.naturalWidth || Number(artwork.getAttribute('width'));
    const height = artwork.naturalHeight || Number(artwork.getAttribute('height'));
    const scale = Math.max(scenery.clientWidth / width, scenery.clientHeight / height);
    for (const layer of [atmosphere, heroLayer]) {
      layer.style.width = `${width * scale}px`;
      layer.style.height = `${height * scale}px`;
    }
  }
  fitArtwork();
  atmosphere.classList.add('is-ready');
  if ('ResizeObserver' in window) new ResizeObserver(fitArtwork).observe(scenery);
  window.addEventListener('resize', fitArtwork);
  window.addEventListener('pageshow', fitArtwork);

  const clock = createMotionClock(elapsed => {
    // Update transforms directly: masked layers and the canvas share one clock.
    const cloudX = -5.5 * Math.cos(Math.PI * (elapsed + 22000) / 80000);
    const mistX = -10 * Math.cos(Math.PI * (elapsed + 5000) / 20000);
    clouds.style.transform = `translate3d(${cloudX}%,0,0)`;
    mist.style.transform = `translate3d(${mistX}%,${-mistX * .25}%,0) scale(1.12)`;
    try {
      drawCape?.(elapsed);
    } catch (error) {
      drawCape = undefined;
      console.warn('Cape rendering stopped; atmospheric animation remains active.', error);
    }
    scenery.dataset.motionTime = (elapsed / 1000).toFixed(3);
  });
  bindMotionControls({ clock, toggle, scenery });

  // Slow or unavailable character images must never block the sky or controls.
  createHeroCloth(heroLayer).then(draw => {
    drawCape = draw;
    drawCape(clock.time);
  }).catch(error => console.warn('Cape unavailable; atmospheric animation remains active.', error));
}
animateAtmosphere();
