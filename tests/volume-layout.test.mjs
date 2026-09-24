import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_VOLUME_PANEL_HEIGHT,
  getVolumePanelHeight,
  resetVolumePanelHeight,
  setVolumePanelHeight,
  volumePanelBounds,
} from '../src/volume-layout.mjs';

test('volume panel height is clamped to preserve a usable price plot', () => {
  assert.equal(getVolumePanelHeight(355), DEFAULT_VOLUME_PANEL_HEIGHT);
  assert.deepEqual(volumePanelBounds(355), { min: 56, max: 163 });
  assert.equal(setVolumePanelHeight(210, 355), 163);
  assert.equal(setVolumePanelHeight(10, 355), 56);
  assert.equal(resetVolumePanelHeight(), DEFAULT_VOLUME_PANEL_HEIGHT);
});
