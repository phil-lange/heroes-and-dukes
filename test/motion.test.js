import test from 'node:test';
import assert from 'node:assert/strict';
import { createMotionClock, bindMotionControls, waitForImage } from '../motion.js';

function frames() {
  let id = 0;
  const pending = new Map();
  return {
    pending,
    requestFrame(callback) { pending.set(++id, callback); return id; },
    cancelFrame(key) { pending.delete(key); },
    advance(time) {
      const callbacks = [...pending.values()];
      pending.clear();
      callbacks.forEach(callback => callback(time));
    },
  };
}

test('one clock advances continuously and restarts without jumping after suspension', () => {
  const scheduler = frames();
  const renders = [];
  const clock = createMotionClock(time => renders.push(time), scheduler);
  clock.setPlaying(true);
  scheduler.advance(100);
  scheduler.advance(116);
  assert.equal(clock.time, 16);
  clock.setPlaying(false);
  scheduler.advance(10000);
  assert.equal(clock.time, 16);
  clock.setPlaying(true);
  clock.setPlaying(true);
  assert.equal(scheduler.pending.size, 1);
  scheduler.advance(20000);
  scheduler.advance(20016);
  assert.equal(clock.time, 32);
  // A delayed foreground frame must not leap the cloth forward by seconds.
  scheduler.advance(30000);
  assert.equal(clock.time, 96);
  assert.deepEqual(renders.slice(0, 3), [0, 0, 16]);
});

function controls(reduced = false, stored = null) {
  const scheduler = frames();
  const clock = createMotionClock(() => {}, scheduler);
  const host = new EventTarget();
  const page = new EventTarget();
  page.hidden = false;
  const preference = new EventTarget();
  preference.matches = reduced;
  host.matchMedia = () => preference;
  const storage = new Map(stored ? [['heroes-dukes-motion', stored]] : []);
  host.sessionStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) };
  const toggle = new EventTarget();
  toggle.hidden = true;
  toggle.setAttribute = (key, value) => { toggle[key] = value; };
  const label = {};
  toggle.querySelector = () => label;
  const classes = new Set();
  const scenery = { dataset: {}, classList: { toggle: (key, on) => on ? classes.add(key) : classes.delete(key) } };
  bindMotionControls({ clock, toggle, scenery, page, host });
  return { scheduler, clock, host, page, preference, toggle, label, scenery, storage };
}

test('controls and atmosphere start immediately, without waiting for character assets', () => {
  const state = controls();
  assert.equal(state.toggle.hidden, false);
  assert.equal(state.scenery.dataset.motionState, 'playing');
  state.scheduler.advance(100);
  state.scheduler.advance(116);
  assert.equal(state.clock.time, 16);
});

test('page restore and foregrounding recover playback but never override manual pause', () => {
  const state = controls();
  state.host.dispatchEvent(new Event('pagehide'));
  assert.equal(state.scheduler.pending.size, 0);
  state.host.dispatchEvent(new Event('pageshow'));
  assert.equal(state.scheduler.pending.size, 1);
  state.page.hidden = true;
  state.page.dispatchEvent(new Event('visibilitychange'));
  assert.equal(state.scenery.dataset.motionState, 'suspended');
  state.page.hidden = false;
  state.page.dispatchEvent(new Event('visibilitychange'));
  assert.equal(state.scheduler.pending.size, 1);
  state.toggle.dispatchEvent(new Event('click'));
  state.host.dispatchEvent(new Event('focus'));
  state.host.dispatchEvent(new Event('pageshow'));
  assert.equal(state.scheduler.pending.size, 0);
  assert.equal(state.scenery.dataset.motionState, 'paused');
});

test('reduced motion has an explicit Play action, remembered across reloads', () => {
  const state = controls(true);
  assert.equal(state.scheduler.pending.size, 0);
  assert.equal(state.label.textContent, 'Play');
  state.toggle.dispatchEvent(new Event('click'));
  assert.equal(state.scheduler.pending.size, 1);
  assert.equal(state.storage.get('heroes-dukes-motion'), 'playing');
  state.preference.dispatchEvent(new Event('change'));
  assert.equal(state.scenery.dataset.motionState, 'playing');
  assert.equal(controls(true, 'playing').scheduler.pending.size, 1);
});

test('image loading works without decode and after decode rejects before load', async () => {
  for (const decode of [undefined, () => Promise.reject(new Error('early decode rejection'))]) {
    const image = new EventTarget();
    image.complete = false;
    image.naturalWidth = 0;
    image.decode = decode;
    const loaded = waitForImage(image);
    await Promise.resolve();
    image.complete = true;
    image.naturalWidth = 384;
    image.dispatchEvent(new Event('load'));
    assert.equal(await loaded, image);
  }
});

test('a failed image rejects without leaving a pending load', async () => {
  const image = new EventTarget();
  image.complete = false;
  image.naturalWidth = 0;
  const loaded = waitForImage(image);
  image.dispatchEvent(new Event('error'));
  await assert.rejects(loaded, /could not be loaded/);
});
