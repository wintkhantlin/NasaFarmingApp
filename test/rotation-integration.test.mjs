import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const Module = require('node:module');
const resolveFilename = Module._resolveFilename;
Module._resolveFilename = function (request, parent, ...rest) {
  const mapped = request.startsWith('@/') ? path.join(root, request.slice(2)) : request;
  return resolveFilename.call(this, mapped, parent, ...rest);
};
require.extensions['.ts'] = (module, filename) => {
  const output = ts.transpileModule(readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  module._compile(output, filename);
};
const source = await readFile(path.join(root, 'app/api/rotation/route.ts'), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText;
const routeModule = { exports: {} };
new Function('require', 'module', 'exports', compiled)(require, routeModule, routeModule.exports);
const { POST } = routeModule.exports;
const { POST: explore } = require(path.join(root, 'app/api/rotation/explore/route.ts'));
const { GET: searchLocations } = require(path.join(root, 'app/api/locations/route.ts'));
const { buildEngineRequest } = require(path.join(root, 'lib/rotation/farmer-request.ts'));
const { resolveEnvironment } = require(path.join(root, 'lib/rotation/environment.ts'));
const { suggestPlanningWindow } = require(path.join(root, 'lib/rotation/planning.ts'));
const { plainReason } = require(path.join(root, 'lib/rotation/presentation.ts'));

async function fixture(name) {
  return JSON.parse(await readFile(path.join(root, 'rotation-engine/examples', name), 'utf8'));
}

async function recommend(body) {
  const response = await POST(new Request('http://localhost/api/rotation', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  }));
  return { status: response.status, body: await response.json() };
}

test('Next route runs the TypeScript engine and preserves provenance and explanations', async () => {
  const { status, body } = await recommend(await fixture('dryzone_demo.json'));
  assert.equal(status, 200);
  assert.equal(body.version, '0.1.0');
  assert.equal(body.scenario_count_total, 6);
  assert.equal(body.location.lat, 20.148);
  assert.equal(body.input_environment_basis, 'synthetic');
  assert.match(body.global_warnings.join(' '), /synthetic demo data/i);
  assert.ok(body.scenarios.every((scenario) => scenario.explanations.length > 0));
  assert.ok(body.scenarios.some((scenario) => scenario.evidence.some((item) => item.source.startsWith('https://'))));
});

for (const name of ['dryzone', 'ayeyarwady', 'two_crop']) {
  test(`TypeScript screens the labeled ${name} example without claiming a score`, async () => {
    const input = await fixture(`${name}_demo.json`);
    const { status, body } = await recommend(input);
    assert.equal(status, 200);
    assert.equal(body.scenario_count_total, body.scenarios.length);
    assert.ok(body.scenarios.every((scenario) => scenario.priority_alignment === null && scenario.priority_coverage === 0));
    assert.match(body.ranking.method, /No scientific score/);
  });
}

test('farmer soil input changes feasibility without changing the engine output contract', async () => {
  const request = await fixture('ayeyarwady_demo.json');
  const baseline = await recommend(request);
  request.farm.soil_ph = 9.2;
  const changed = await recommend(request);
  assert.equal(baseline.status, 200);
  assert.equal(changed.status, 200);
  const sesameBefore = baseline.body.scenarios.find((scenario) => scenario.proposed_crops.join() === 'sesame');
  const sesameAfter = changed.body.scenarios.find((scenario) => scenario.proposed_crops.join() === 'sesame');
  assert.notEqual(sesameBefore.status, 'infeasible');
  assert.equal(sesameAfter.status, 'infeasible');
  assert.ok(sesameAfter.hard_constraints.some((reason) => reason.includes('pH')));
});

test('two crop planning returns actual crop sequences', async () => {
  const { status, body } = await recommend(await fixture('two_crop_demo.json'));
  assert.equal(status, 200);
  assert.equal(body.scenario_count_total, 13);
  assert.ok(body.scenarios.some((scenario) => scenario.proposed_crops.length === 2));
  assert.ok(body.scenarios.filter((scenario) => scenario.proposed_crops.length === 2).every((scenario) => scenario.sequence_reasoning.length === 2 && scenario.sequence_reasoning[1].previous_crop === scenario.proposed_crops[0]));
});

test('sequence reasoning identifies a family change and conditional legume fixation without a nitrogen credit', async () => {
  const result = (await recommend(await fixture('ayeyarwady_demo.json'))).body;
  const green = result.scenarios.find((scenario) => scenario.proposed_crops.join() === 'green_gram');
  const step = green.sequence_reasoning[0];
  assert.deepEqual([step.previous_crop, step.next_crop], ['rice', 'green_gram']);
  assert.ok(step.benefits.some((item) => /different plant family/.test(item)));
  assert.ok(step.benefits.some((item) => /may fix atmospheric nitrogen/.test(item)));
  assert.ok(step.unknowns.some((item) => /net nitrogen left/.test(item)));
  assert.ok(step.unknowns.some((item) => /Stored soil water/.test(item)));
  assert.ok(step.evidence.some((item) => item.source.includes('fao.org')));
  assert.equal(green.priority_alignment, null);
  assert.doesNotMatch(JSON.stringify(step), /\b\d+\s*(kg|mm)\b/);
});

test('only documented green-gram and black-gram host overlap names a specific disease', async () => {
  const input = await fixture('ayeyarwady_demo.json');
  input.history = ['green_gram'];
  const result = (await recommend(input)).body;
  const black = result.scenarios.find((scenario) => scenario.proposed_crops.join() === 'black_gram').sequence_reasoning[0];
  const rice = result.scenarios.find((scenario) => scenario.proposed_crops.join() === 'rice').sequence_reasoning[0];
  assert.ok(black.risks.some((item) => /yellow mosaic viruses/.test(item) && /does not establish infection/.test(item)));
  assert.ok(black.evidence.some((item) => item.source.includes('10.3389/fmicb.2024.1451986')));
  assert.ok(rice.unknowns.some((item) => /No specific shared pest-host relationship/.test(item)));
  assert.doesNotMatch(JSON.stringify(rice), /yellow mosaic|rootworm/i);
});

test('recorded residue changes only conditional cover reasoning, not feasibility or ranking', async () => {
  const input = await fixture('ayeyarwady_demo.json');
  input.farm.previous_residue = 'retained';
  const retained = (await recommend(input)).body;
  input.farm.previous_residue = 'removed';
  const removed = (await recommend(input)).body;
  const pick = (body) => body.scenarios.find((scenario) => scenario.proposed_crops.join() === 'sesame');
  assert.ok(pick(retained).sequence_reasoning[0].benefits.some((item) => /may help cover soil/.test(item)));
  assert.ok(pick(removed).sequence_reasoning[0].risks.some((item) => /cannot be assumed to protect/.test(item)));
  assert.equal(pick(retained).status, pick(removed).status);
  assert.deepEqual(retained.scenarios.map((item) => item.proposed_crops), removed.scenarios.map((item) => item.proposed_crops));
  assert.ok(pick(retained).sequence_reasoning[0].unknowns.some((item) => /Actual surface cover/.test(item)));
});

test('missing climate stays unknown and a known extreme temperature excludes a crop', async () => {
  const missing = await fixture('ayeyarwady_demo.json');
  missing.environment.monthly = missing.environment.monthly.filter((row) => row.month !== '2026-12');
  const unknown = await recommend(missing);
  const green = unknown.body.scenarios.find((scenario) => scenario.proposed_crops.join() === 'green_gram');
  assert.ok(green.missing_information.some((item) => item.includes('2026-12')));

  const hot = await fixture('ayeyarwady_demo.json');
  hot.environment.monthly[1].temp_c = 45;
  const checked = await recommend(hot);
  const black = checked.body.scenarios.find((scenario) => scenario.proposed_crops.join() === 'black_gram');
  assert.equal(black.status, 'infeasible');
  assert.ok(black.hard_constraints.some((item) => item.includes('45°C')));
});

test('water and income stay unsupported without comparable sourced metrics', async () => {
  const input = await fixture('ayeyarwady_demo.json');
  const result = await recommend(input);
  assert.equal(result.status, 200);
  for (const scenario of result.body.scenarios.filter((item) => item.status !== 'infeasible')) {
    assert.equal(scenario.signals.water_conservation, null);
    assert.equal(scenario.signals.income, null);
  }
  input.farmer.crop_metrics = { fallow: { net_margin_per_ha: 0 } };
  const invalid = await recommend(input);
  assert.equal(invalid.status, 400);
  assert.match(invalid.body.error, /metrics_source/);
});

test('rainfall changes are visible as evidence but cannot create an unsupported water ranking', async () => {
  const dry = await fixture('ayeyarwady_demo.json');
  dry.farmer.priorities = { water_conservation: 1 };
  dry.environment.monthly.forEach((month) => { month.rain_mm = 0; });
  const wet = structuredClone(dry);
  wet.environment.monthly.forEach((month) => { month.rain_mm = 500; });
  const dryResult = (await recommend(dry)).body;
  const wetResult = (await recommend(wet)).body;
  const comparison = (body) => body.scenarios.map((scenario) => [scenario.proposed_crops, scenario.status, scenario.priority_alignment, scenario.priority_coverage]);
  assert.deepEqual(comparison(dryResult), comparison(wetResult));
  assert.ok(dryResult.scenarios.some((scenario) => scenario.observations_used.some((row) => row.rain_mm === 0)));
  assert.ok(wetResult.scenarios.some((scenario) => scenario.observations_used.some((row) => row.rain_mm === 500)));
  assert.ok(dryResult.scenarios.every((scenario) => scenario.signals.water_conservation === null));
});

test('biological descriptors do not turn into unsupported soil-health scores', async () => {
  const legume = await fixture('ayeyarwady_demo.json');
  legume.farmer.priorities = { legume_inclusion: 1 };
  const cover = structuredClone(legume);
  cover.farmer.priorities = { living_cover: 1 };
  const legumeResult = (await recommend(legume)).body;
  const coverResult = (await recommend(cover)).body;
  const crop = (body, id) => body.scenarios.find((scenario) => scenario.proposed_crops.join() === id);
  assert.equal(crop(legumeResult, 'sesame').priority_alignment, null);
  assert.equal(crop(coverResult, 'sesame').priority_alignment, null);
  assert.equal(crop(legumeResult, 'green_gram').signals.legume_inclusion, 1);
  assert.equal(crop(coverResult, 'green_gram').signals.living_cover, null);
  assert.deepEqual(legumeResult.scenarios.map((s) => s.proposed_crops), coverResult.scenarios.map((s) => s.proposed_crops));
});

test('unknown cultivar duration screens later possible heat without a definite exclusion', async () => {
  const input = {
    planning: { start_date: '2027-01-01', end_date: '2027-06-01', include_fallow: false },
    history: ['rice'],
    farm: { available_crops: ['maize'], soil_ph: 6, drainage: 'well', irrigation: 'available' },
    environment: { source: 'Synthetic reasoning test', basis: 'synthetic', monthly: [
      { month: '2027-01', temp_c: 25, rain_mm: 40 },
      { month: '2027-02', temp_c: 25, rain_mm: 40 },
      { month: '2027-03', temp_c: 25, rain_mm: 40 },
      { month: '2027-04', temp_c: 25, rain_mm: 40 },
      { month: '2027-05', temp_c: 50, rain_mm: 40 },
    ] },
  };
  const { status, body } = await recommend(input);
  assert.equal(status, 200);
  const maize = body.scenarios[0];
  assert.equal(maize.status, 'requires_review');
  assert.equal(maize.temperature_screen, 'uncertain');
  assert.ok(maize.missing_information.some((item) => /no cultivar-specific duration/i.test(item)));
  assert.ok(maize.observations_used.some((row) => row.month === '2027-05'));
  assert.ok(maize.missing_information.some((item) => /2027-05.*possible longer cycle/i.test(item)));
  assert.equal(maize.hard_constraints.length, 0);
  input.environment.monthly[0].temp_c = 50;
  const definite = (await recommend(input)).body.scenarios[0];
  assert.equal(definite.status, 'infeasible');
  assert.equal(definite.temperature_screen, 'outside_range');
  assert.ok(definite.hard_constraints.some((item) => /2027-01/.test(item)));
  input.environment.monthly[0].temp_c = 25;
  input.planning.end_date = '2027-04-01';
  const shortened = (await recommend(input)).body.scenarios[0];
  assert.ok(shortened.missing_information.some((item) => /temperature.*2027-05/.test(item)) === false);
  assert.ok(shortened.observations_used.some((row) => row.month === '2027-05'));
  input.environment.monthly = Array.from({ length: 12 }, (_, index) => ({ month: `2027-${String(index + 1).padStart(2, '0')}`, temp_c: 25, rain_mm: 40 }));
  const within = (await recommend(input)).body.scenarios[0];
  assert.equal(within.temperature_screen, 'within_range');
});

test('missing temperature and rainfall produce separate warnings and preserve known evidence', async () => {
  const input = await fixture('ayeyarwady_demo.json');
  input.environment.monthly[0].temp_c = null;
  input.environment.monthly[0].rain_mm = null;
  const result = (await recommend(input)).body;
  const green = result.scenarios.find((scenario) => scenario.proposed_crops.join() === 'green_gram');
  assert.ok(green.missing_information.some((item) => /temperature.*2026-11/.test(item)));
  assert.ok(green.missing_information.some((item) => /rainfall.*2026-11/.test(item)));
  assert.ok(green.observations_used.some((row) => row.month === '2026-11' && row.temp_c === null && row.rain_mm === null));
});

test('unsupported priorities and absent preferences never create a hidden ranking', async () => {
  const input = await fixture('ayeyarwady_demo.json');
  input.farmer.priorities = { water_conservation: 10, income: 5 };
  const result = (await recommend(input)).body;
  assert.deepEqual(result.scenarios.map((item) => item.proposed_crops), [...result.scenarios].sort((a, b) => Number(a.status === 'infeasible') - Number(b.status === 'infeasible') || a.proposed_crops.join().localeCompare(b.proposed_crops.join())).map((item) => item.proposed_crops));
  assert.ok(result.scenarios.every((item) => item.priority_alignment === null && item.priority_coverage === 0));
  assert.ok(result.scenarios.every((item) => item.unsupported_priorities.includes('water_conservation') && item.unsupported_priorities.includes('income')));
  input.farmer.priorities = {};
  const unspecified = (await recommend(input)).body;
  assert.deepEqual(unspecified.ranking.selected_priorities, []);
  assert.ok(unspecified.scenarios.every((item) => item.unsupported_priorities.length === 0));
});

test('unverified per-crop income figures cannot create a winner', async () => {
  const input = await fixture('ayeyarwady_demo.json');
  input.farmer.priorities = { income: 10 };
  input.farmer.metrics_source = 'Synthetic comparison example, NOT market data';
  input.farmer.crop_metrics = {
    fallow: { net_margin_per_ha: 0 }, green_gram: { net_margin_per_ha: 100 },
    black_gram: { net_margin_per_ha: 50 }, sesame: { net_margin_per_ha: 150 },
    rice: { net_margin_per_ha: 80 },
  };
  const result = await recommend(input);
  assert.equal(result.status, 200);
  assert.ok(result.body.scenarios.every((scenario) => scenario.priority_alignment === null));
  assert.ok(result.body.scenarios.every((scenario) => scenario.signals.income === null));
  assert.ok(result.body.scenarios.every((scenario) => scenario.unsupported_priorities?.includes('income')));
});

test('changing a location label alone does not change the ranking', async () => {
  const input = await fixture('ayeyarwady_demo.json');
  const baseline = await recommend(input);
  input.location = { label: 'Another field', lat: 20.15, lon: 94.93 };
  const renamed = await recommend(input);
  const summary = (body) => body.scenarios.map((scenario) => [scenario.proposed_crops, scenario.status, scenario.priority_alignment]);
  assert.deepEqual(summary(renamed.body), summary(baseline.body));
});

test('bad JSON and invalid engine inputs return actionable client errors', async () => {
  const malformed = await recommend('{');
  assert.equal(malformed.status, 400);
  assert.match(malformed.body.error, /valid JSON/);
  const request = await fixture('dryzone_demo.json');
  request.planning.end_date = request.planning.start_date;
  const invalid = await recommend(request);
  assert.equal(invalid.status, 400);
  assert.match(invalid.body.error, /start_date must precede/);
});

const farmerInput = {
  location: { kind: 'demo', demoId: 'dryzone', label: 'Magway example farm', lat: 20.148, lon: 94.932 },
  previousCrop: 'sesame',
  irrigation: 'sometimes',
  priority: 'soil_health',
  planning: { startDate: '2026-11-20', endDate: '2027-04-15' },
  advanced: { soilPh: null, drainage: 'unknown', equipment: '', availableCrops: ['green_gram', 'black_gram', 'sesame'] },
};

async function exploreCrops(body) {
  const response = await explore(new Request('http://localhost/api/rotation/explore', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  }));
  return { status: response.status, body: await response.json() };
}

test('simple farmer inputs become a valid engine request with explicit demo data', async () => {
  const { status, body } = await exploreCrops(farmerInput);
  assert.equal(status, 200);
  assert.equal(body.environment.state, 'demo');
  assert.equal(body.recommendation.input_environment_basis, 'synthetic');
  assert.match(body.recommendation.input_environment_source, /NOT NASA observations/);
  assert.equal(body.recommendation.scenario_count_total, 4);
  assert.equal(body.recommendation.location.lat, 20.148);
  assert.ok(body.recommendation.scenarios.every((scenario) => scenario.explanations.length > 0));
});

test('a real farm without coordinates keeps climate unknown instead of borrowing demo values', async () => {
  const previous = process.env.FIELDSHIFT_ENVIRONMENT_URL;
  delete process.env.FIELDSHIFT_ENVIRONMENT_URL;
  try {
    const request = structuredClone(farmerInput);
    request.location = { kind: 'farm', label: 'My field' };
    const { status, body } = await exploreCrops(request);
    assert.equal(status, 200);
    assert.equal(body.environment.state, 'unavailable');
    assert.equal(body.recommendation.input_environment_basis, null);
    assert.match(body.recommendation.global_warnings.join(' '), /No monthly environment data supplied/);
    assert.doesNotMatch(body.recommendation.global_warnings.join(' '), /SYNTHETIC DEMO DATA/);
  } finally {
    if (previous !== undefined) process.env.FIELDSHIFT_ENVIRONMENT_URL = previous;
  }
});

test('NASA POWER complete historical months feed the explorer as normals, not a forecast', async () => {
  const previous = process.env.FIELDSHIFT_ENVIRONMENT_URL;
  delete process.env.FIELDSHIFT_ENVIRONMENT_URL;
  try {
    const request = structuredClone(farmerInput);
    request.location = { kind: 'farm', label: 'My field', lat: 20.2, lon: 95.1 };
    request.planning = { startDate: '2027-01-01', endDate: '2027-03-01' };
    const dates = Array.from({ length: 31 }, (_, i) => `2025-01-${String(i + 1).padStart(2, '0')}`);
    dates.push('2025-02-01');
    const weather = {
      dates,
      series: { T2M: dates.map(() => 26), PRECTOTCORR: dates.map(() => 2) },
      source: { dataset: 'NASA POWER', resolution: 'about 0.5 degrees', version: 'test-version' },
    };
    const result = await resolveEnvironment(request, fetch, async () => ({ weather, retrievedAt: '2026-11-14T00:00:00Z', error: null, cached: false }));
    assert.equal(result.state, 'connected');
    assert.equal(result.snapshot.basis, 'historical_normals');
    assert.match(result.snapshot.source, /NASA POWER/);
    assert.deepEqual(result.snapshot.monthly, [
      { month: '2027-01', temp_c: 26, rain_mm: 62, soil_moisture_anomaly: null },
      { month: '2027-02', temp_c: null, rain_mm: null, soil_moisture_anomaly: null },
    ]);
    assert.match(result.note, /not a forecast/);
  } finally {
    if (previous !== undefined) process.env.FIELDSHIFT_ENVIRONMENT_URL = previous;
  }
});

test('a failed NASA POWER lookup leaves climate unavailable without using demo values', async () => {
  const previous = process.env.FIELDSHIFT_ENVIRONMENT_URL;
  delete process.env.FIELDSHIFT_ENVIRONMENT_URL;
  try {
    const request = structuredClone(farmerInput);
    request.location = { kind: 'farm', label: 'My field', lat: 20.2, lon: 95.1 };
    const result = await resolveEnvironment(request, fetch, async () => ({ weather: null, retrievedAt: null, error: 'Unavailable', cached: false }));
    assert.equal(result.state, 'unavailable');
    assert.deepEqual(result.snapshot.monthly, []);
    assert.notEqual(result.snapshot.basis, 'synthetic');
  } finally {
    if (previous !== undefined) process.env.FIELDSHIFT_ENVIRONMENT_URL = previous;
  }
});

test('the SI adapter sends location and dates and accepts sourced monthly data', async () => {
  const previousUrl = process.env.FIELDSHIFT_ENVIRONMENT_URL;
  const previousFetch = global.fetch;
  process.env.FIELDSHIFT_ENVIRONMENT_URL = 'https://si.example.test/monthly';
  let sent;
  global.fetch = async (_url, options) => {
    sent = JSON.parse(options.body);
    return new Response(JSON.stringify({ source: 'NASA POWER SI sample', basis: 'historical_normals', observation_period: { start_date: '2025-01-01', end_date: '2025-12-31' }, units: { temp_c: 'C', rain_mm: 'mm' }, spatial_resolution_km: null, monthly: [] }), { status: 200 });
  };
  try {
    const request = structuredClone(farmerInput);
    request.location = { kind: 'farm', label: 'My field', lat: 20.2, lon: 95.1 };
    const { status, body } = await exploreCrops(request);
    assert.equal(status, 200);
    assert.equal(body.environment.state, 'unavailable');
    assert.equal(body.recommendation.input_environment_basis, 'historical_normals');
    assert.deepEqual(sent.location, { label: 'My field', lat: 20.2, lon: 95.1 });
    assert.deepEqual(sent.planning, { start_date: '2026-11-20', end_date: '2027-04-15' });
  } finally {
    global.fetch = previousFetch;
    if (previousUrl === undefined) delete process.env.FIELDSHIFT_ENVIRONMENT_URL;
    else process.env.FIELDSHIFT_ENVIRONMENT_URL = previousUrl;
  }
});

test('SI environmental data rejects missing provenance, wrong units, duplicate months and disguised synthetic data', async () => {
  const request = structuredClone(farmerInput);
  request.location = { kind: 'farm', label: 'My field', lat: 20.2, lon: 95.1 };
  const previous = process.env.FIELDSHIFT_ENVIRONMENT_URL;
  process.env.FIELDSHIFT_ENVIRONMENT_URL = 'https://si.example.test/monthly';
  const base = { source: 'SI weather service', basis: 'forecast', observation_period: { start_date: '2026-11-01', end_date: '2027-04-30' }, units: { temp_c: 'C', rain_mm: 'mm' }, spatial_resolution_km: null, monthly: [{ month: '2026-11', temp_c: 25, rain_mm: null }] };
  try {
    const fetcher = async () => new Response(JSON.stringify(base), { status: 200 });
    const valid = await resolveEnvironment(request, fetcher);
    assert.equal(valid.snapshot.basis, 'forecast');
    assert.equal(valid.snapshot.monthly[0].rain_mm, null);
    for (const [change, message] of [
      [(item) => { delete item.observation_period; }, /observation period/],
      [(item) => { item.units.rain_mm = 'inches'; }, /temperature in C and rainfall in mm/],
      [(item) => { delete item.spatial_resolution_km; }, /spatial resolution/],
      [(item) => { item.monthly.push({ ...item.monthly[0] }); }, /invalid monthly value/],
      [(item) => { item.source = 'Synthetic demo climate'; }, /conflicts/],
      [(item) => { item.observation_period.start_date = '2026-10-01'; item.observation_period.end_date = '2026-10-31'; }, /outside its observation or forecast period/],
      [(item) => { item.monthly[0].soil_moisture_anomaly = 0.2; }, /anomaly units/],
    ]) {
      const invalid = structuredClone(base);
      change(invalid);
      await assert.rejects(resolveEnvironment(request, async () => new Response(JSON.stringify(invalid), { status: 200 })), message);
    }
  } finally {
    if (previous === undefined) delete process.env.FIELDSHIFT_ENVIRONMENT_URL;
    else process.env.FIELDSHIFT_ENVIRONMENT_URL = previous;
  }
});

test('location search exposes only labeled demo places without a search provider', async () => {
  const previous = process.env.FIELDSHIFT_LOCATION_SEARCH_URL;
  const previousToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  delete process.env.FIELDSHIFT_LOCATION_SEARCH_URL;
  delete process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  try {
    const response = await searchLocations(new Request('http://localhost/api/locations?q=Magway'));
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.mode, 'demo_only');
    assert.equal(body.locations.length, 1);
    assert.equal(body.locations[0].kind, 'demo');
  } finally {
    if (previous !== undefined) process.env.FIELDSHIFT_LOCATION_SEARCH_URL = previous;
    if (previousToken !== undefined) process.env.NEXT_PUBLIC_MAPBOX_TOKEN = previousToken;
  }
});

test('Mapbox search from the new app supplies real locations with coordinates', async () => {
  const previousUrl = process.env.FIELDSHIFT_LOCATION_SEARCH_URL;
  const previousToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  const previousFetch = global.fetch;
  delete process.env.FIELDSHIFT_LOCATION_SEARCH_URL;
  process.env.NEXT_PUBLIC_MAPBOX_TOKEN = 'pk.test';
  global.fetch = async (url) => {
    assert.equal(new URL(url).searchParams.get('q'), 'My township');
    return new Response(JSON.stringify({ features: [{
      geometry: { coordinates: [95.1, 20.2] },
      properties: { mapbox_id: 'place-1', name: 'My township', place_formatted: 'Magway, Myanmar' },
    }] }), { status: 200 });
  };
  try {
    const response = await searchLocations(new Request('http://localhost/api/locations?q=My%20township'));
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.mode, 'connected');
    assert.deepEqual(body.locations[0], { id: 'place-1', kind: 'farm', label: 'My township, Magway, Myanmar', lat: 20.2, lon: 95.1 });
  } finally {
    global.fetch = previousFetch;
    if (previousUrl === undefined) delete process.env.FIELDSHIFT_LOCATION_SEARCH_URL;
    else process.env.FIELDSHIFT_LOCATION_SEARCH_URL = previousUrl;
    if (previousToken === undefined) delete process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    else process.env.NEXT_PUBLIC_MAPBOX_TOKEN = previousToken;
  }
});

test('invalid simple inputs are rejected before reaching the recommendation engine', async () => {
  const request = structuredClone(farmerInput);
  request.previousCrop = 'invented_crop';
  const { status, body } = await exploreCrops(request);
  assert.equal(status, 400);
  assert.match(body.error, /crop last grown/);
});

test('a failed SI response does not silently switch a real farm to demo climate', async () => {
  const previousUrl = process.env.FIELDSHIFT_ENVIRONMENT_URL;
  const previousFetch = global.fetch;
  const previousConsoleError = console.error;
  process.env.FIELDSHIFT_ENVIRONMENT_URL = 'https://si.example.test/monthly';
  global.fetch = async () => new Response('Unavailable', { status: 503 });
  console.error = () => {};
  try {
    const request = structuredClone(farmerInput);
    request.location = { kind: 'farm', label: 'My field', lat: 20.2, lon: 95.1 };
    const { status, body } = await exploreCrops(request);
    assert.equal(status, 502);
    assert.match(body.error, /environmental data service is unavailable/);
    assert.equal(body.recommendation, undefined);
  } finally {
    console.error = previousConsoleError;
    global.fetch = previousFetch;
    if (previousUrl === undefined) delete process.env.FIELDSHIFT_ENVIRONMENT_URL;
    else process.env.FIELDSHIFT_ENVIRONMENT_URL = previousUrl;
  }
});

test('a location provider returns searchable real places with coordinates', async () => {
  const previousUrl = process.env.FIELDSHIFT_LOCATION_SEARCH_URL;
  const previousFetch = global.fetch;
  process.env.FIELDSHIFT_LOCATION_SEARCH_URL = 'https://si.example.test/locations';
  global.fetch = async (url) => {
    assert.equal(new URL(url).searchParams.get('q'), 'My township');
    return new Response(JSON.stringify({ locations: [{ id: 'place-1', label: 'My township, Myanmar', lat: 20.2, lon: 95.1 }] }), { status: 200 });
  };
  try {
    const response = await searchLocations(new Request('http://localhost/api/locations?q=My%20township'));
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.mode, 'connected');
    assert.deepEqual(body.locations[0], { id: 'place-1', kind: 'farm', label: 'My township, Myanmar', lat: 20.2, lon: 95.1 });
  } finally {
    global.fetch = previousFetch;
    if (previousUrl === undefined) delete process.env.FIELDSHIFT_LOCATION_SEARCH_URL;
    else process.env.FIELDSHIFT_LOCATION_SEARCH_URL = previousUrl;
  }
});

test('the suggested period is a date offset and simple choices map without invented measurements', () => {
  const period = suggestPlanningWindow(new Date('2026-11-14T00:00:00Z'));
  assert.equal(period.startDate, '2026-11-21');
  assert.equal(period.endDate, '2027-05-20');
  const request = structuredClone(farmerInput);
  request.location = { kind: 'farm', label: 'My field' };
  request.priority = 'water_conservation';
  delete request.advanced;
  const engineInput = buildEngineRequest(request, { source: 'No environmental data connected', monthly: [] });
  assert.deepEqual(engineInput.environment.monthly, []);
  assert.equal(engineInput.environment.basis, undefined);
  assert.equal(engineInput.farm.soil_ph, null);
  assert.equal(engineInput.farm.drainage, 'unknown');
  assert.equal(engineInput.farm.irrigation, 'unknown');
  assert.deepEqual(engineInput.farmer.priorities, { water_conservation: 1 });
  assert.equal(engineInput.location.lat, undefined);
});

test('missing soil information is described as unknown, not as a failed soil test', () => {
  assert.match(plainReason('Black gram: soil pH is unknown.'), /unknown/i);
  assert.doesNotMatch(plainReason('Black gram: soil pH is unknown.'), /outside/i);
  assert.match(plainReason('Black gram: measured soil pH 9.2 outside ECOCROP absolute envelope.'), /outside/i);
});
