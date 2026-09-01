import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const source = resolve(root, 'supabase');
const targetRoot = resolve(root, '.tmp/local-supabase');
const target = resolve(targetRoot, 'supabase');
const productionUrl = 'https://rvgiidesehuaqqncqilu.supabase.co';
const localUrl = 'http://host.docker.internal:54321';

rmSync(targetRoot, { recursive: true, force: true });
mkdirSync(targetRoot, { recursive: true });
cpSync(source, target, { recursive: true });

const baseline = readFileSync(resolve(source, 'bootstrap/production_baseline.sql'), 'utf8');
writeFileSync(resolve(target, 'migrations/00000000000000_production_baseline.sql'), baseline);

for (const relative of [
  'migrations/20260819092305_secure_worker_transport.sql',
  'migrations/20260820164302_schedule_outbox_dispatch.sql',
  'migrations/20260820173617_schedule_memory_indexer.sql',
]) {
  const path = resolve(target, relative);
  const sql = readFileSync(path, 'utf8').replaceAll(productionUrl, localUrl);
  writeFileSync(path, sql);
}

const configPath = resolve(target, 'config.toml');
const config = readFileSync(configPath, 'utf8')
  .replace('project_id = "Hexer-last"', 'project_id = "hexer-last-local"')
  .replace(/(\[db\.seed\][\s\S]*?enabled\s*=\s*)true/, '$1false')
  .replace(/sql_paths\s*=\s*\["\.\/seed\.sql"\]/, 'sql_paths = []');
writeFileSync(configPath, config);

console.log(targetRoot);
