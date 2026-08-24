import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const directory = path.resolve('tests/scenarios');
const files = (await readdir(directory)).filter((file) => file.endsWith('.json'));

if (files.length === 0) {
  throw new Error('No scenario manifests found');
}

const ids = new Set();
for (const file of files) {
  const manifest = JSON.parse(await readFile(path.join(directory, file), 'utf8'));
  const minimum = Number(manifest.minimumScenarios ?? 20);
  if (minimum < 20) throw new Error(`${file}: minimumScenarios cannot be below 20`);
  if (!Array.isArray(manifest.scenarios) || manifest.scenarios.length < minimum) {
    throw new Error(`${file}: expected at least ${minimum} scenarios`);
  }

  for (const [index, scenario] of manifest.scenarios.entries()) {
    if (!scenario?.id || typeof scenario.id !== 'string') {
      throw new Error(`${file}: scenario ${index + 1} has no stable id`);
    }
    if (ids.has(scenario.id)) throw new Error(`Duplicate scenario id: ${scenario.id}`);
    ids.add(scenario.id);
    const hasInput = Object.hasOwn(scenario, 'input') || Object.hasOwn(scenario, 'path');
    if (!hasInput) throw new Error(`${scenario.id}: missing input`);
    if (!Object.hasOwn(scenario, 'expected') && !Object.hasOwn(scenario, 'error')) {
      throw new Error(`${scenario.id}: missing expected or error contract`);
    }
  }
}

console.log(`Validated ${ids.size} scenarios across ${files.length} behavior manifests.`);
