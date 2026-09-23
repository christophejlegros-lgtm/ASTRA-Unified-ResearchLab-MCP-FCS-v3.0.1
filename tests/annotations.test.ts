/**
 * ASTRA — MCP tool annotations contract
 * © 2026 Christophe Jean Legros — Geneva · Assistance Multi IA
 *
 * The table in src/tool-annotations.ts must match the live tools/list exactly,
 * every tool must carry the four hints plus a title, and the hints must obey
 * the classification rules documented in that file.
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { createAstraServer } from '../src/server.js';
import { stopSimulation } from '../src/engine/simulation.js';
import { TOOL_ANNOTATIONS } from '../src/tool-annotations.js';

let tools: Tool[] = [];
const byName = (n: string): Tool => {
  const t = tools.find((x) => x.name === n);
  assert.ok(t, `tool ${n} not registered`);
  return t;
};

describe('MCP tool annotations', () => {
  before(async () => {
    const server = createAstraServer();
    const client = new Client({ name: 'annotations-test', version: '1.0.0' });
    const [c, s] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(s), client.connect(c)]);
    tools = (await client.listTools()).tools;
  });
  after(() => stopSimulation());

  it('the table and tools/list name exactly the same 70 tools', () => {
    const live = tools.map((t) => t.name).sort();
    const table = Object.keys(TOOL_ANNOTATIONS).sort();
    assert.equal(live.length, 70);
    assert.deepEqual(live, table);
  });

  it('every tool carries a title and all four boolean hints', () => {
    for (const t of tools) {
      const a = t.annotations;
      assert.ok(a, `${t.name}: no annotations`);
      assert.ok(typeof a.title === 'string' && a.title.length > 0, `${t.name}: no title`);
      for (const k of ['readOnlyHint', 'destructiveHint', 'idempotentHint', 'openWorldHint'] as const) {
        assert.equal(typeof a[k], 'boolean', `${t.name}: ${k} missing`);
      }
    }
  });

  it('a read-only tool is never destructive', () => {
    for (const t of tools) {
      if (t.annotations?.readOnlyHint) assert.equal(t.annotations.destructiveHint, false, t.name);
    }
  });

  it('resets, overwrites and stimulation are flagged destructive', () => {
    for (const n of ['snn_reset', 'tcai_reset', 'set_parameter', 'np_configure_stim', 'np_send_trigger', 'np_closed_loop']) {
      const a = byName(n).annotations;
      assert.equal(a?.readOnlyHint, false, n);
      assert.equal(a?.destructiveHint, true, n);
    }
  });

  it('stateful computations are not advertised as read-only', () => {
    // wm_encode feeds the history wm_surprise reads; tcai_curiosity trains its predictor;
    // np_count_spikes advances the simulated MEA clock.
    for (const n of ['wm_encode', 'wm_predict', 'wm_plan', 'wm_surprise', 'tcai_curiosity', 'tcai_emotion_appraise', 'np_count_spikes']) {
      assert.equal(byName(n).annotations?.readOnlyHint, false, n);
    }
  });

  it('the FCS layer is read-only and closed-world', () => {
    const fcs = tools.filter((t) => t.name.startsWith('fcs_'));
    assert.equal(fcs.length, 8);
    for (const t of fcs) {
      assert.equal(t.annotations?.readOnlyHint, true, t.name);
      assert.equal(t.annotations?.openWorldHint, false, t.name);
    }
  });

  it('only the OVOMIND reads are open-world; NeuroPlatform (simulate mode) is not', () => {
    const open = tools.filter((t) => t.annotations?.openWorldHint).map((t) => t.name).sort();
    assert.deepEqual(open, ['orch_cycle', 'ovo_cycle', 'ovo_read']);
  });
});
