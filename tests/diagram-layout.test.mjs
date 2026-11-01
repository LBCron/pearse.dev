// Unit tests for the diagram layout's build-time checks (src/components/diagrams/layout.ts).
// A rollback edge (#114) is a path kept ready but not taken: it may never also be the
// live flow, and it must say what it is with a label.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { prepare } from '../src/components/diagrams/layout.ts';

const layout = (edge) => ({
  w: 400,
  h: 200,
  nodes: [
    { id: 'a', x: 10, y: 10, w: 100, h: 40, label: 'A' },
    { id: 'b', x: 10, y: 140, w: 100, h: 40, label: 'B' },
  ],
  edges: [{ from: 'a', to: 'b', ...edge }],
});

test('a labelled rollback edge prepares', () => {
  const { edges } = prepare(layout({ rollback: true, label: 'rollback' }), 'ok');
  assert.equal(edges[0].rollback, true);
});

test('an edge that is both rollback and flow fails the build', () => {
  assert.throws(() => prepare(layout({ rollback: true, flow: true, label: 'rollback' }), 't'), /both rollback and flow/);
});

test('a rollback edge without a label fails the build', () => {
  assert.throws(() => prepare(layout({ rollback: true }), 't'), /rollback edge .* needs a label/);
  assert.throws(() => prepare(layout({ rollback: true, label: '' }), 't'), /needs a label/);
});
