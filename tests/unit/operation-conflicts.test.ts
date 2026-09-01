import { describe, expect, it } from 'vitest';
import manifest from '../scenarios/operation-conflicts.json';
import { compareEntityVersions, diffConflictFields, recommendedResolution, type FieldConflict } from '../../services/offline/conflicts';

describe('versioned operation conflict contracts', () => {
  for (const scenario of manifest.scenarios) {
    it(scenario.id, () => {
      if (scenario.kind === 'version') {
        expect(compareEntityVersions({
          baseVersion: scenario.input.baseVersion,
          serverVersion: scenario.input.serverVersion,
        })).toBe(scenario.expected);
      } else if (scenario.kind === 'field') {
        if (!scenario.input.base || !scenario.input.local || !scenario.input.server || !scenario.input.fields) {
          throw new Error('Invalid field scenario');
        }
        const [field] = diffConflictFields({
          base: scenario.input.base,
          local: scenario.input.local,
          server: scenario.input.server,
          fields: scenario.input.fields,
        });
        expect(field.kind).toBe(scenario.expected);
      } else {
        if (!scenario.input.conflicts) throw new Error('Invalid recommendation scenario');
        const conflicts = scenario.input.conflicts.map((kind, index) => ({ field: String(index), base: null, local: null, server: null, kind })) as FieldConflict[];
        expect(recommendedResolution(conflicts)).toBe(scenario.expected);
      }
    });
  }

  it('deduplicates requested fields', () => {
    expect(diffConflictFields({ base: {}, local: {}, server: {}, fields: ['title', 'title'] })).toHaveLength(1);
  });
});
