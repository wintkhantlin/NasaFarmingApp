// Offline reproducible ablation using the repository's actual predownloaded POWER record.
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const Module = require('node:module');
const resolveFilename = Module._resolveFilename;
Module._resolveFilename = function (request, parent, ...rest) {
  return resolveFilename.call(this, request.startsWith('@/') ? fileURLToPath(new URL(`../${request.slice(2)}`, import.meta.url)) : request, parent, ...rest);
};
require.extensions['.ts'] = (module, filename) => {
  module._compile(ts.transpileModule(readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText, filename);
};
const { compareRotations } = require('../lib/engine/compare.ts');
const { rankRotations } = require('../lib/engine/mcda.ts');
const { toDailyRecords } = require('../lib/engine/climate.ts');
const { effectiveSoil } = require('../lib/engine/soil-input.ts');
const file = new URL('../data/predownload/weather/power_20.0_95.000.json', import.meta.url);
const bytes = readFileSync(file);
const { weather } = JSON.parse(bytes);
const field = {
  id: 'p8-demo', name: 'Hypothetical Magway comparison', centroid: [95, 20],
  geometry: { type: 'Point', coordinates: [95, 20] }, samplePoints: [[95, 20]],
  areaHa: null, irrigation: 'none', region: 'magway', locationConfirmed: true,
  priorities: { order: ['water'], weights: { water: 1 } },
  createdAt: '2026-11-15T00:00:00Z', updatedAt: '2026-11-15T00:00:00Z',
};
const rotation = { id: 'current', fieldId: field.id, label: 'Sesame reference sequence', source: 'farmer', cycleYears: 1,
  slots: [{ id: 'sesame', kind: 'crop', cropId: 'sesame', plantDate: '2026-05-15', harvestDate: '2026-08-15', dateConfidence: 'typical', irrigated: false }] };
const unavailable = { status: 'not-requested', provider: null, retrievedAt: null, start: null, end: null };
const records = toDailyRecords(weather).filter((r) => r.year >= 2016 && r.year <= 2025);
const data = {
  field, region: 'magway', latitude: 20, elevationM: weather.elevationM, records,
  power: { status: 'ok', version: weather.meta.apiVersion, fillValue: weather.meta.fillValue, timeStandard: weather.meta.timeStandard,
    sources: weather.meta.sources, retrievedAt: null, start: '2016-01-01', end: '2025-12-31', elevationM: weather.elevationM, units: weather.meta.units },
  imerg: [], imergInfo: { status: 'not-requested', granules: 0, partialDays: 0, retrievedAt: null, start: null, end: null },
  smap: [], smapInfo: unavailable, hls: [], hlsInfo: unavailable, slope: null, srtmInfo: unavailable,
  soil: effectiveSoil(field, null),
};
const withNasa = compareRotations(data, rotation);
const fixed = [withNasa.current, ...withNasa.alternatives.slice(0, 2)];
const withoutData = { ...data, records: [], power: { ...data.power, status: 'not-requested', start: null, end: null } };
const withoutNasa = fixed.map((o) => compareRotations(withoutData, o.rotation).current);
const summarize = (options) => ({
  options: options.map((o) => ({ id: o.id, sequence: o.rotation.slots.map((s) => s.cropId ?? 'fallow'), fit: o.fit,
    waterShortfallMmPerCrop: o.metrics['water-shortfall'] ?? null, dryYearsEvaluated: o.dryYear.evaluated, dryYearPasses: o.dryYear.passes,
    unknowns: o.unknowns })),
  ranking: rankRotations(options.map((o) => ({ rotationId: o.id, feasible: o.fit !== 'does-not-fit', values: o.metrics })), field.priorities),
});
console.log(JSON.stringify({
  input: { path: 'data/predownload/weather/power_20.0_95.000.json', sha256: createHash('sha256').update(bytes).digest('hex'),
    source: weather.source, meta: weather.meta, records: records.length, baseline: withNasa.baseline,
    note: 'Hypothetical sequence and water priority. No farmer study, initial moisture, soil test or market input. Same three rotations in both arms; withheld means unknown, not replacement weather.' },
  withNasa: summarize(fixed), withoutNasa: summarize(withoutNasa),
}, null, 2));
