import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { makeRehoster, inferExt } from './imageRehost';

const noopCapture = () => {};

test('rehostOne: skipped when image is null', async () => {
  const r = makeRehoster({
    findProduct: async () => ({ image: null }),
    download: async () => { throw new Error('should not call'); },
    upload: async () => { throw new Error('should not call'); },
    updateImage: async () => { throw new Error('should not call'); },
    captureException: noopCapture,
  });
  assert.equal(await r.rehostOne('p'), 'skipped');
});

test('rehostOne: skipped when image is not grofers', async () => {
  const r = makeRehoster({
    findProduct: async () => ({ image: 'https://supabase.co/products/x.jpg' }),
    download: async () => { throw new Error('should not call'); },
    upload: async () => { throw new Error('should not call'); },
    updateImage: async () => { throw new Error('should not call'); },
    captureException: noopCapture,
  });
  assert.equal(await r.rehostOne('p'), 'skipped');
});

test('rehostOne: ok path swaps the image', async () => {
  let updatedTo = '';
  const r = makeRehoster({
    findProduct: async () => ({ image: 'https://cdn.grofers.com/x.jpg' }),
    download: async () => ({ data: Buffer.from('img'), contentType: 'image/jpeg' }),
    upload: async () => ({ publicUrl: 'https://supabase.co/products/catalog/p.jpg' }),
    updateImage: async (_id, url) => { updatedTo = url; },
    captureException: noopCapture,
  });
  assert.equal(await r.rehostOne('p'), 'ok');
  assert.equal(updatedTo, 'https://supabase.co/products/catalog/p.jpg');
});

test('rehostOne: never throws on failure → returns "failed" + captures', async () => {
  let captured = false;
  const r = makeRehoster({
    findProduct: async () => ({ image: 'https://cdn.grofers.com/x.jpg' }),
    download: async () => { throw new Error('boom'); },
    upload: async () => { throw new Error('should not call'); },
    updateImage: async () => { throw new Error('should not call'); },
    captureException: () => { captured = true; },
  });
  assert.equal(await r.rehostOne('p'), 'failed');
  assert.equal(captured, true);
});

test('rehostMany: tallies ok across ids', async () => {
  const r = makeRehoster({
    findProduct: async () => ({ image: 'https://cdn.grofers.com/x.jpg' }),
    download: async () => ({ data: Buffer.from('img'), contentType: 'image/jpeg' }),
    upload: async () => ({ publicUrl: 'u' }),
    updateImage: async () => {},
    captureException: noopCapture,
  });
  const out = await r.rehostMany(['a', 'b', 'c']);
  assert.equal(out.ok, 3);
  assert.equal(out.failed, 0);
  assert.equal(out.skipped, 0);
});

test('inferExt: content-type and url fallbacks', () => {
  assert.equal(inferExt('image/png', 'x'), 'png');
  assert.equal(inferExt('image/webp', 'x'), 'webp');
  assert.equal(inferExt('', 'https://cdn.grofers.com/a.png'), 'png');
  assert.equal(inferExt('', 'https://cdn.grofers.com/a.jpg'), 'jpg');
  assert.equal(inferExt('application/octet-stream', 'https://cdn.grofers.com/a'), 'jpg');
});
