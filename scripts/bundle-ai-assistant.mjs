import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const entrypoint = resolve(root, 'supabase/functions/ai-assistant/index.ts');
const output = resolve(root, 'supabase/functions/ai-assistant/deploy.bundle.ts');
const npxCli = resolve(dirname(process.execPath), 'node_modules/npm/bin/npx-cli.js');

const result = spawnSync(process.execPath, [
  npxCli,
  '--no-install',
  'esbuild',
  entrypoint,
  '--bundle',
  '--format=esm',
  '--platform=neutral',
  '--minify',
  '--external:https://*',
  '--external:npm:*',
  '--external:jsr:*',
  `--outfile=${output}`,
], { cwd: root, encoding: 'utf8' });

if (result.stdout) process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}
if (result.status !== 0) process.exit(result.status ?? 1);

const bundle = readFileSync(output, 'utf8');
const source = readFileSync(resolve(root, 'supabase/functions/ai-assistant/lib/intent.ts'), 'utf8');
const forbidden = [
  ['truncated deployment stub', 'deployment payload truncated'],
  ['legacy temperature override', /temperature\s*:/],
  ['legacy top_p override', /top_p\s*:/],
  ['legacy top_k override', /top_k\s*:/],
  ['legacy thinking budget', /thinking_budget\s*:/],
];
const required = [
  ['Edge entrypoint', 'Deno.serve'],
  ['strict structured output', 'require_parameters'],
  ['reminder creation', 'CREATE_REMINDER'],
  ['reminder update', 'UPDATE_REMINDER'],
  ['reminder snooze', 'SNOOZE_REMINDER'],
  ['reminder read state', 'MARK_REMINDER_READ'],
  ['task update', 'UPDATE_TASK'],
  ['task reopen', 'REOPEN_TASK'],
  ['task checklist update', 'UPDATE_TASK_CHECKLIST'],
  ['habit completion', 'SET_HABIT_COMPLETION'],
  ['task-note linking', 'LINK_TASK_NOTE'],
  ['task-note unlinking', 'UNLINK_TASK_NOTE'],
  ['Undo receipts', 'agent_action_receipts'],
  ['Undo RPC', 'undo_agent_action'],
  ['server feature flag resolution', 'feature_flags'],
  ['agent write kill switch', 'agent_writes'],
  ['atomic recurring completion RPC', 'complete_recurring_task_v3'],
  ['feature exposure audit', 'feature_flag_exposures'],
  ['quota reservation RPC', 'reserve_ai_quota'],
  ['quota success finalization', 'finalize_ai_request_success'],
  ['quota failure release', 'finalize_ai_request_failure'],
  ['provider usage normalization', 'usageSource'],
];

const sourceRequired = [
  ['Persian reminder classifier', 'تنظیمش کن'],
  ['Persian reminder noun', 'یادآور'],
  ['stable recurring completion action key', 'agent:${requestId}:action:${actionIndex}'],
];

const violations = forbidden
  .filter(([, pattern]) => typeof pattern === 'string' ? bundle.includes(pattern) : pattern.test(bundle))
  .map(([label]) => `forbidden: ${label}`);
const missing = required
  .filter(([, marker]) => !bundle.includes(marker))
  .map(([label]) => `missing: ${label}`);
const missingSource = sourceRequired
  .filter(([, marker]) => !source.includes(marker)
    && !readFileSync(resolve(root, 'supabase/functions/ai-assistant/lib/action-processor.ts'), 'utf8').includes(marker))
  .map(([label]) => `missing from source: ${label}`);

if (violations.length || missing.length || missingSource.length) {
  for (const error of [...violations, ...missing, ...missingSource]) console.error(error);
  process.exit(1);
}

console.log(`Validated ai-assistant deployment bundle (${Buffer.byteLength(bundle)} bytes).`);
