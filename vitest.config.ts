import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      'npm:jalaali-js': 'jalaali-js',
    },
  },
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary', 'html'],
      include: [
        'supabase/functions/_shared/model-registry.ts',
        'supabase/functions/ai-assistant/lib/media-contract.ts',
        'supabase/functions/ai-assistant/lib/request-contract.ts',
      ],
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 60,
        statements: 70,
      },
    },
  },
});
