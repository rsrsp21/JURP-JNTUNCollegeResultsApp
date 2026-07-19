import path from 'node:path';
import fs from 'node:fs';

for (const file of ['.env', '.env.local']) {
  const filePath = path.resolve(process.cwd(), file);
  if (!fs.existsSync(filePath)) continue;
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match) process.env[match[1]] = match[2].trim();
  }
}

const accountId = process.env.D1_ACCOUNT_ID;
const databaseId = process.env.D1_DATABASE_ID;
const apiToken = process.env.D1_API_TOKEN;

if (!accountId || !databaseId || !apiToken) {
  console.error('Missing D1 credentials in .env');
  process.exit(1);
}

async function run(sql) {
  const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ sql, params: [] })
  });
  const data = await response.json();
  if (!response.ok || data.success === false) {
    throw new Error((data.errors || []).map((e) => e.message).join('; ') || response.statusText);
  }
  return data.result;
}

const columns = await run(`PRAGMA table_info(student_cgpa)`);
const existing = new Set((columns?.[0]?.results || []).map((c) => c.name));
const columnDefs = {
  name: 'TEXT',
  email: 'TEXT',
  name_status: 'TEXT',
  pending_email: 'TEXT',
  grade_card_name: 'TEXT',
  name_edit_used: 'INTEGER DEFAULT 0',
  email_edit_used: 'INTEGER DEFAULT 0'
};
for (const [column, type] of Object.entries(columnDefs)) {
  if (existing.has(column)) {
    console.log(`Column "${column}" already exists on student_cgpa. Nothing to do.`);
  } else {
    await run(`ALTER TABLE student_cgpa ADD COLUMN ${column} ${type}`);
    console.log(`Added "${column}" column to student_cgpa.`);
  }
}
