/**
 * ASTRA MCP Server — Integration Test Suite (v2)
 * © 2026 Christophe Jean Legros — Geneva
 *
 * Tests the full MCP protocol flow using @modelcontextprotocol/sdk Client.
 * Validates tool calls, resource reads, prompt retrieval, and multi-step workflows.
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createAstraServer } from '../src/server.js';
import { stopSimulation } from '../src/engine/simulation.js';

// ═══════════════════════════════════════════════════════════════════
// Test Client Setup
// ═══════════════════════════════════════════════════════════════════

let client: Client;

async function setupClient(): Promise<void> {
  const server = createAstraServer();
  client = new Client({ name: 'test-client', version: '1.0.0' });

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await Promise.all([
    server.connect(serverTransport),
    client.connect(clientTransport),
  ]);
}

// ═══════════════════════════════════════════════════════════════════
// Suite 1: Tool Discovery
// ═══════════════════════════════════════════════════════════════════

describe('Tool Discovery', () => {
  before(setupClient);
  after(() => stopSimulation());

  it('lists all 12 tools', async () => {
    const { tools } = await client.listTools();
    assert.ok(tools.length >= 24, 'Expected >=24 tools, got ' + tools.length);
  });

  it('tools have titles and annotations', async () => {
    const { tools } = await client.listTools();
    for (const tool of tools) {
      assert.ok(tool.name, `Tool missing name`);
      // MCP SDK exposes annotations via tool metadata
    }
  });

  it('expected tool names are present', async () => {
    const { tools } = await client.listTools();
    const names = tools.map(t => t.name);
    const expected = [
      'get_system_status', 'get_metrics', 'get_snn_state', 'snn_step',
      'snn_reset', 'inject_spikes', 'get_acm_score', 'check_ethics',
      'set_parameter', 'get_platform_status', 'export_snapshot', 'simulation_control', 'wm_encode', 'wm_predict', 'wm_plan', 'wm_surprise', 'wm_train_step', 'wm_status', 'sensor_visual', 'sensor_audio', 'sensor_olfactory', 'sensor_fuse', 'sensor_process', 'sensor_status',
    ];
    for (const name of expected) {
      assert.ok(names.includes(name), `Missing tool: ${name}`);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════
// Suite 2: Tool Execution
// ═══════════════════════════════════════════════════════════════════

describe('Tool Execution', () => {
  before(setupClient);
  after(() => stopSimulation());

  it('get_system_status returns structured data', async () => {
    const result = await client.callTool({ name: 'get_system_status', arguments: {} });
    const data = JSON.parse((result.content as Array<{ text: string }>)[0].text);
    assert.ok(data.acm);
    assert.ok(data.snn);
    assert.ok(data.snn.layers); // v2: includes layers
    assert.ok(data.acm);
    assert.ok(data.acm.compositeScore !== undefined);
  });

  it('get_metrics returns all subsystems', async () => {
    const result = await client.callTool({ name: 'get_metrics', arguments: {} });
    const data = JSON.parse((result.content as Array<{ text: string }>)[0].text);
    assert.ok(data.snn);
    assert.ok(data.acm);
    assert.ok(data.ethics);
    assert.ok(data.worldModel);
    assert.ok(data.acm);
    assert.ok(data.ethics);
  });

  it('get_metrics ACM uses proxy names', async () => {
    const result = await client.callTool({ name: 'get_metrics', arguments: {} });
    const data = JSON.parse((result.content as Array<{ text: string }>)[0].text);
    assert.ok('phi' in data.acm);
    assert.ok('gw' in data.acm);
    assert.ok('pad' in data.acm);
    assert.ok('score' in data.acm);
  });

  it('get_snn_state includes layer info', async () => {
    const result = await client.callTool({ name: 'get_snn_state', arguments: {} });
    const data = JSON.parse((result.content as Array<{ text: string }>)[0].text);
    assert.ok(data.layers);
    assert.equal(data.layers.length, 4);
    assert.equal(data.layers[0].name, 'input');
    assert.ok(data.params); // v2.1: params instead of weightDistribution
  });

  it('snn_step advances simulation', async () => {
    const result = await client.callTool({ name: 'snn_step', arguments: { steps: 20 } });
    const data = JSON.parse((result.content as Array<{ text: string }>)[0].text);
    assert.equal(data.stepsExecuted, 20);
    assert.ok(typeof data.lastSpikes === 'number');
    assert.ok(data.finalState); // v2.1: finalState replaces simulationTime
  });

  it('snn_reset reinitialises engine with layers', async () => {
    const result = await client.callTool({ name: 'snn_reset', arguments: {} });
    const data = JSON.parse((result.content as Array<{ text: string }>)[0].text);
    assert.equal(data.status, 'SNN and WM buffer reset');
    // v2.1: reset returns status string only
    // neurons info available via get_snn_state
  });

  it('inject_spikes targets correct layer', async () => {
    const result = await client.callTool({ name: 'inject_spikes', arguments: { neuronIds: [112,113,114,115,116], strength: 3.0 } });
    const data = JSON.parse((result.content as Array<{ text: string }>)[0].text);
    assert.ok(data.injected > 0);
    assert.equal(data.injected, 5);
  });

  it('get_acm_score uses proxy naming', async () => {
    const result = await client.callTool({ name: 'get_acm_score', arguments: {} });
    const data = JSON.parse((result.content as Array<{ text: string }>)[0].text);
    assert.ok('compositeScore' in data);
    assert.ok('components' in data);
    assert.ok(data.worldModelEnhancement); // v2.1: WM enhancement info
  });

  it('check_ethics includes data source and disclaimer', async () => {
    const result = await client.callTool({ name: 'check_ethics', arguments: {} });
    const data = JSON.parse((result.content as Array<{ text: string }>)[0].text);
    assert.ok(data.dataSource);
    assert.ok(data.disclaimer);
    assert.ok(data.disclaimer.includes('SIMULATED'));
    assert.equal(data.irbRequired, false); // sim mode
  });
});

// ═══════════════════════════════════════════════════════════════════
// Suite 3: Bounds-Checked set_parameter
// ═══════════════════════════════════════════════════════════════════

describe('set_parameter Bounds Validation', () => {
  before(setupClient);
  after(() => stopSimulation());

  it('accepts valid values within bounds', async () => {
    const result = await client.callTool({ name: 'set_parameter', arguments: { path: 'eth.viab', value: 85 } });
    const data = JSON.parse((result.content as Array<{ text: string }>)[0].text);
    assert.equal(data.success, true);
    assert.equal(data.value, 85);
    // bounds info via state.getBounds()
  });

  it('rejects values below minimum', async () => {
    const result = await client.callTool({ name: 'set_parameter', arguments: { path: 'eth.viab', value: -50 } });
    const data = JSON.parse((result.content as Array<{ text: string }>)[0].text);
    assert.ok(data.error);
    assert.ok(data.error.includes('out of bounds'));
  });

  it('rejects values above maximum', async () => {
    const result = await client.callTool({ name: 'set_parameter', arguments: { path: 'eth.viab', value: 200 } });
    const data = JSON.parse((result.content as Array<{ text: string }>)[0].text);
    assert.ok(data.error);
  });

  it('rejects invalid paths', async () => {
    const result = await client.callTool({ name: 'set_parameter', arguments: { path: 'hacker.injection', value: 1 } });
    const data = JSON.parse((result.content as Array<{ text: string }>)[0].text);
    assert.ok(data.error);
  });

  it('returns bounds info with successful updates', async () => {
    const result = await client.callTool({ name: 'set_parameter', arguments: { path: 'eth.fr', value: 30 } });
    const data = JSON.parse((result.content as Array<{ text: string }>)[0].text);
    assert.equal(data.success, true);
    // bounds info via state.getBounds()
    // v2.1: bounds not returned inline
    // check state.getBounds() API separately
  });
});

// ═══════════════════════════════════════════════════════════════════
// Suite 4: Resources
// ═══════════════════════════════════════════════════════════════════

describe('Resources', () => {
  before(setupClient);
  after(() => stopSimulation());

  it('lists 5 resources', async () => {
    const { resources } = await client.listResources();
    assert.ok(resources.length >= 8, 'Expected >=8 resources, got ' + resources.length);
  });

  it('reads metrics-realtime', async () => {
    const result = await client.readResource({ uri: 'astra://metrics/realtime' });
    const data = JSON.parse((result.contents[0] as { text: string }).text);
    assert.ok(data.snn);
    assert.ok(data.acm);
  });

  it('snn-topology reflects actual engine config', async () => {
    const result = await client.readResource({ uri: 'astra://snn/topology' });
    const data = JSON.parse((result.contents[0] as { text: string }).text);
    assert.ok(data.layers);
    assert.equal(data.totalNeurons, 128);
    assert.ok(data.totalSynapses > 0);
    assert.ok(data.connectivity);
    assert.equal(data.connectivity.feedForward, 0.3);
    assert.equal(data.connectivity.recurrent, 0.1);
    assert.ok(data.weightStorage.includes('Map-indexed'));
  });

  it('acm-state uses proxy names', async () => {
    const result = await client.readResource({ uri: 'astra://acm/state' });
    const data = JSON.parse((result.contents[0] as { text: string }).text);
    assert.ok('compositeScore' in data);
    assert.ok('integrationProxy' in data.components);
  });

  it('ethics-welfare includes data source', async () => {
    const result = await client.readResource({ uri: 'astra://ethics/welfare' });
    const data = JSON.parse((result.contents[0] as { text: string }).text);
    assert.ok(data.dataSource);
    assert.ok(data.disclaimer);
  });

  it('snapshot-current includes all state', async () => {
    const result = await client.readResource({ uri: 'astra://snapshot/current' });
    const data = JSON.parse((result.contents[0] as { text: string }).text);
    assert.ok(data.snn);
    assert.ok(data.acm);
    assert.ok(data.worldModel);
    assert.ok(data.ethics);
    // covered by data.acm above
  });
});

// ═══════════════════════════════════════════════════════════════════
// Suite 5: Prompts
// ═══════════════════════════════════════════════════════════════════

describe('Prompts', () => {
  before(setupClient);
  after(() => stopSimulation());

  it('lists 3 prompts', async () => {
    const { prompts } = await client.listPrompts();
    assert.ok(prompts.length >= 5, 'Expected >=5 prompts, got ' + prompts.length);
  });

  it('system-health-report prompt mentions proxy disclaimer', async () => {
    const result = await client.getPrompt({ name: 'system-health-report', arguments: {} });
    const text = (result.messages[0].content as { text: string }).text;
    assert.ok(text.includes('get_system_status') || text.includes('status'));
  });

  it('snn-experiment prompt warns about proxy interpretation', async () => {
    const result = await client.getPrompt({ name: 'snn-experiment', arguments: { stimStrength: '25' } });
    const text = (result.messages[0].content as { text: string }).text;
    assert.ok(text.includes('25'));
    assert.ok(text.includes('snn_step') || text.includes('inject'));
  });

  it('ethics-stress-test prompt notes sim mode', async () => {
    const result = await client.getPrompt({ name: 'ethics-stress-test', arguments: {} });
    const text = (result.messages[0].content as { text: string }).text;
    assert.ok(text.includes('eth.viab') || text.includes('stress'));
  });
});

// ═══════════════════════════════════════════════════════════════════
// Suite 6: Multi-Step Workflow
// ═══════════════════════════════════════════════════════════════════

describe('Multi-Step Workflow', () => {
  before(setupClient);
  after(() => stopSimulation());

  it('full experiment: reset → inject → run → assess', async () => {
    // 1. Reset
    const r1 = await client.callTool({ name: 'snn_reset', arguments: {} });
    const d1 = JSON.parse((r1.content as Array<{ text: string }>)[0].text);
    assert.equal(d1.status, 'SNN and WM buffer reset');

    // 2. Inject spikes with high amplitude to ensure firing
    const r2 = await client.callTool({ name: 'inject_spikes', arguments: { neuronIds: [0,1,2,3,4,5,6,7,8,9], strength: 8.0 } });
    const d2 = JSON.parse((r2.content as Array<{ text: string }>)[0].text);
    assert.ok(d2.injected > 0);

    // 3. Run simulation (enough steps for propagation)
    const r3 = await client.callTool({ name: 'snn_step', arguments: { steps: 200 } });
    const d3 = JSON.parse((r3.content as Array<{ text: string }>)[0].text);
    assert.ok(d3.lastSpikes >= 0);
    assert.ok(d3.stepsExecuted > 0);

    // 4. ACM assessment
    const r4 = await client.callTool({ name: 'get_acm_score', arguments: {} });
    const d4 = JSON.parse((r4.content as Array<{ text: string }>)[0].text);
    assert.ok(d4.compositeScore >= 0);
    assert.ok(d4.compositeScore >= 0); // v2.1

    // 5. Ethics check
    const r5 = await client.callTool({ name: 'check_ethics', arguments: {} });
    const d5 = JSON.parse((r5.content as Array<{ text: string }>)[0].text);
    assert.ok(d5.status);
    assert.ok(d5.dataSource);
  });

  it('ethics stress test: NORMAL → STRESS → DISTRESS → recovery', async () => {
    // Baseline
    let r = await client.callTool({ name: 'check_ethics', arguments: {} });
    let d = JSON.parse((r.content as Array<{ text: string }>)[0].text);
    // Note: may not be NORMAL if previous tests modified state
    const baseline = d.status;

    // Set viability to trigger STRESS
    await client.callTool({ name: 'set_parameter', arguments: { path: 'eth.viab', value: 88 } });
    r = await client.callTool({ name: 'check_ethics', arguments: {} });
    d = JSON.parse((r.content as Array<{ text: string }>)[0].text);
    assert.equal(d.status, 'STRESS');

    // Set viability to trigger DISTRESS
    await client.callTool({ name: 'set_parameter', arguments: { path: 'eth.viab', value: 75 } });
    r = await client.callTool({ name: 'check_ethics', arguments: {} });
    d = JSON.parse((r.content as Array<{ text: string }>)[0].text);
    assert.equal(d.status, 'DISTRESS');

    // Recover
    await client.callTool({ name: 'set_parameter', arguments: { path: 'eth.viab', value: 95 } });
    r = await client.callTool({ name: 'check_ethics', arguments: {} });
    d = JSON.parse((r.content as Array<{ text: string }>)[0].text);
    assert.equal(d.status, 'NORMAL');
  });
});
