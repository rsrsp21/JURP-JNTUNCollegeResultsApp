import 'server-only';

import path from 'node:path';
import { config } from 'dotenv';

let loaded = false;

export function loadProjectEnv() {
  if (loaded) return;
  loaded = true;

  config({ path: path.resolve(process.cwd(), '.env') });
  config({ path: path.resolve(process.cwd(), '.env.local'), override: true });
}

export function envValue(...names) {
  loadProjectEnv();
  for (const name of names) {
    const value = process.env[name];
    if (value && !String(value).startsWith('your_')) return value;
  }
  return '';
}
