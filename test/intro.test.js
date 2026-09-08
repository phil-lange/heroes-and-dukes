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

function frames() {
  let time = 0;
  let id = 0;
  const pending = new Map();
  return {
    pending,
    requestFrame(callback) { pending.set(++id, callback); return id; },
    cancelFrame(key) { pending.delete(key); },
    advance(ms) {
      for (let remaining = ms; remaining > 0;) {
        const delta = Math.min(16, remaining);
        remaining -= delta;
        time += delta;
        const callbacks = [...pending.values()];
        pending.clear();
        callbacks.forEach(callback => callback(time));
      }
    },
  };
}

const { createEntranceSequence } = await import('../intro.js');

test('a cold logo download gets its full visible entrance after it arrives', () => {
  const scheduler = frames();
  const events = [];
  const sequence = createEntranceSequence({
    ...scheduler,
    onMark: () => events.push('mark'),
    onReveal: () => events.push('reveal'),
    onComplete: () => events.push('complete'),
  });
  scheduler.advance(4000);
  assert.deepEqual(events, []);
  sequence.markReady();
  sequence.ready();
  scheduler.advance(1000);
  assert.deepEqual(events, ['mark']);
  scheduler.advance(400);
  assert.deepEqual(events, ['mark', 'reveal']);
  scheduler.advance(2700);
  assert.deepEqual(events, ['mark', 'reveal', 'complete']);
  assert.equal(scheduler.pending.size, 0);
});

test('assets ready in a background tab wait until the visitor can see the whole entrance', () => {
  const scheduler = frames();
  const events = [];
  const sequence = createEntranceSequence({
    ...scheduler, visible: false,
    onMark: () => events.push('mark'),
    onReveal: () => events.push('reveal'),
    onComplete: () => events.push('complete'),
  });
  sequence.ready();
  scheduler.advance(60000);
  assert.deepEqual(events, []);
  assert.equal(sequence.phase, 'loading');
  sequence.setVisible(true);
  scheduler.advance(1200);
  assert.deepEqual(events, ['mark']);
  scheduler.advance(200);
  assert.equal(sequence.phase, 'revealing');
  sequence.setVisible(false);
  scheduler.advance(30000);
  assert.equal(sequence.phase, 'revealing');
  sequence.setVisible(true);
  scheduler.advance(1000);
  assert.equal(sequence.phase, 'revealing');
  scheduler.advance(1700);
  assert.deepEqual(events, ['mark', 'reveal', 'complete']);
});

test('Skip cancels the pending entrance even if assets settle later', () => {
  const scheduler = frames();
  let completed = 0;
  let revealed = false;
  const sequence = createEntranceSequence({
    ...scheduler, onComplete: () => completed++, onReveal: () => { revealed = true; },
  });
  sequence.finish();
  sequence.ready();
  sequence.setVisible(false);
  sequence.setVisible(true);
  scheduler.advance(5000);
  assert.equal(completed, 1);
  assert.equal(revealed, false);
  assert.equal(scheduler.pending.size, 0);
});

test('repeated visibility events keep one animation clock and a single completion', () => {
  const scheduler = frames();
  let completed = 0;
  const sequence = createEntranceSequence({ ...scheduler, onComplete: () => completed++ });
  sequence.ready();
  for (let n = 0; n < 5; n++) sequence.setVisible(true);
  assert.equal(scheduler.pending.size, 1);
  scheduler.advance(4100);
  assert.equal(completed, 1);
  assert.equal(scheduler.pending.size, 0);
});
