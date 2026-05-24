import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getSqlPool, closeSqlPool } from '../db/sql';

async function main() {
  try {
  const pool = await getSqlPool();
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const sqlPath = path.resolve(__dirname, 'schema.sql');
    const text = fs.readFileSync(sqlPath, 'utf8');
    // Execute as a single batch (no GO statements included)
    await pool.request().query(text);
    console.log('Schema applied successfully');
  } catch (err) {
    console.error('Apply schema failed:', err);
    process.exitCode = 1;
  } finally {
    await closeSqlPool();
  }
}

main();
