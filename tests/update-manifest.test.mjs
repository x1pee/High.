import test from 'node:test';
import assert from 'node:assert/strict';
import { createUpdateManifest } from '../scripts/create-update-manifest.mjs';

test('release manifest points only to the signed portable Windows executable', () => {
  const signature = Buffer.from(
    'untrusted comment: test\nRWS...\ntrusted comment: timestamp:1\tversion:1.9.24\nRWS...',
    'utf8',
  ).toString('base64');
  const manifest = createUpdateManifest({
    version: '1.9.24',
    displayVersion: '1.9.9.20',
    notes: 'New chart controls',
    signature,
    publishedAt: '2026-09-25T12:00:00.000Z',
  });
  assert.equal(manifest.version, '1.9.24');
  assert.match(Buffer.from(manifest.platforms['windows-x86_64'].signature, 'base64').toString(), /version:1\.9\.24/);
  assert.equal(
    manifest.platforms['windows-x86_64'].url,
    'https://github.com/x1pee/High./releases/download/v1.9.24/High_1.9.24_x64.exe',
  );
  assert.deepEqual(Object.keys(manifest.platforms), ['windows-x86_64']);
  assert.equal(JSON.parse(JSON.stringify(manifest)).platforms['windows-x86_64'].signature, manifest.platforms['windows-x86_64'].signature);
});

test('release manifest rejects an incomplete signature or invalid version', () => {
  const input = { version: '1.9.24', displayVersion: '1.9.9.20', notes: 'Release', signature: 'sig', publishedAt: 'now' };
  assert.throws(() => createUpdateManifest({ ...input, version: 'next' }), /SemVer/);
  assert.throws(() => createUpdateManifest({ ...input, signature: ' ' }), /signature/);
});
