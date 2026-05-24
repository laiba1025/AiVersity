import { test } from 'node:test';
import assert from 'node:assert';

// This test exercises SQL-backed storage when available. If USE_SQL_STORAGE is not true
// or the module cannot be loaded, it is skipped.

async function tryImportSql() {
  try {
    // Dynamic import to avoid failing when mssql not installed/configured
    const mod = await import('../storage-sql.ts');
    return mod as any;
  } catch (e) {
    return null;
  }
}

test('user data persistence (SQL) [conditional]', async (t) => {
  if ((process.env.USE_SQL_STORAGE || '').toLowerCase() !== 'true') {
    t.skip('USE_SQL_STORAGE is not true; skipping SQL test');
    return;
  }
  const sqlMod = await tryImportSql();
  if (!sqlMod || !sqlMod.sqlStorage) {
    t.skip('SQL storage module not available; skipping');
    return;
  }

  const storage = sqlMod.sqlStorage;
  const uname = `db_it_${Date.now()}`;
  // Create user
  const created = await storage.createUser({ username: uname, password: 'hashed', fullName: 'DB User', language: 'en' });
  assert.ok(created && created.id, 'created user should have id');

  // Update language
  const updated = await storage.updateUserLanguage(created.id, 'hu');
  assert.strictEqual(updated?.language, 'hu');
});
