import test from 'node:test';
import assert from 'node:assert/strict';
import { waitForEntrance } from '../intro.js';

function timers() {
  let time = 0;
  let id = 0;
  const pending = new Map();
  return {
    pending,
    setTimer(callback, delay) { pending.set(++id, { callback, at: time + delay }); return id; },
    clearTimer(key) { pending.delete(key); },
    advance(delta) {
      time += delta;
      for (const [key, item] of [...pending].sort((a, b) => a[1].at - b[1].at)) {
        if (item.at <= time && pending.has(key)) { pending.delete(key); item.callback(); }
      }
    },
  };
}

test('cached artwork gets a short entrance, then all timers are cleared', async () => {
  const scheduler = timers();
  const progress = [];
  let done = false;
  const entrance = waitForEntrance([Promise.resolve(), Promise.resolve()], {
    ...scheduler, onProgress: value => progress.push(value),
  }).then(reason => { done = true; return reason; });
  await Promise.resolve();
  assert.deepEqual(progress, [0, .5, 1]);
  assert.equal(done, false);
  scheduler.advance(1100);
  assert.equal(await entrance, 'ready');
  assert.equal(scheduler.pending.size, 0);
});

test('failed artwork settles the loader and does not trap the visitor', async () => {
  const scheduler = timers();
  const entrance = waitForEntrance([Promise.resolve(), Promise.reject(new Error('offline'))], scheduler);
  await Promise.resolve();
  scheduler.advance(1100);
  assert.equal(await entrance, 'ready');
});

test('a request that never finishes releases the page at the deadline', async () => {
  const scheduler = timers();
  const progress = [];
  const entrance = waitForEntrance([Promise.resolve(), new Promise(() => {})], {
    ...scheduler, onProgress: value => progress.push(value),
  });
  await Promise.resolve();
  scheduler.advance(6500);
  assert.equal(await entrance, 'timeout');
  assert.equal(progress.at(-1), .5);
  assert.equal(scheduler.pending.size, 0);
});

test('reduced motion can reveal ready content without a minimum animation delay', async () => {
  const scheduler = timers();
  const entrance = waitForEntrance([Promise.resolve()], { ...scheduler, minimum: 0 });
  assert.equal(await entrance, 'ready');
  assert.equal(scheduler.pending.size, 0);
});
