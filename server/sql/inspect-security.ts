import sql from 'mssql';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), 'server', '.env') });

function toDbConn(conn: string): string {
  return conn;
}

function toMasterConn(conn: string): string {
  return conn.replace(/Initial Catalog=([^;]+)/i, 'Initial Catalog=master');
}

async function main() {
  const admin = process.env.AZURE_SQL_ADMIN_CONNECTION_STRING || process.env.AZURE_SQL_CONNECTION_STRING;
  if (!admin) throw new Error('No SQL connection string set');

  const dbConn = toDbConn(admin);
  const masterConn = toMasterConn(admin);

  const dbPool = await new sql.ConnectionPool(dbConn).connect();
  const masterPool = await new sql.ConnectionPool(masterConn).connect();

  console.log('Connected as admin. Server version:', (await masterPool.request().query('SELECT @@VERSION AS v')).recordset[0].v);

  const dbName = (dbConn.match(/Initial Catalog=([^;]+)/i)?.[1]) || 'unknown';
  console.log('Inspecting database:', dbName);

  const principals = await dbPool.request().query(`
    SELECT name, type_desc, authentication_type_desc, sid
    FROM sys.database_principals
    WHERE name in ('appuser', 'appuser_db')
  `);
  console.table(principals.recordset);

  const roles = await dbPool.request().query(`
    SELECT m.name AS member_name, r.name AS role_name
    FROM sys.database_role_members drm
    JOIN sys.database_principals r ON drm.role_principal_id = r.principal_id
    JOIN sys.database_principals m ON drm.member_principal_id = m.principal_id
    WHERE m.name in ('appuser', 'appuser_db')
  `);
  console.table(roles.recordset);

  const logins = await masterPool.request().query(`
    SELECT name, type_desc, is_disabled FROM sys.sql_logins WHERE name = 'appuser'
  `);
  console.table(logins.recordset);

  // Test opening a connection as each user
  const server = (dbConn.match(/Server=([^;]+)/i)?.[1]) || '';
  const database = dbName;
  const testPass = process.env.AZURE_SQL_APP_PASSWORD || '';

  async function tryConnect(user: string) {
    const cs = `Server=${server};Initial Catalog=${database};Persist Security Info=False;User ID=${user};Password=${testPass};MultipleActiveResultSets=False;Encrypt=True;TrustServerCertificate=False;Connection Timeout=30;`;
    try {
      const p = await new sql.ConnectionPool(cs).connect();
      const who = await p.request().query('SELECT DB_NAME() as db, SYSTEM_USER as sys, USER_NAME() as [user]');
      console.log(`Login success as ${user}`, who.recordset[0]);
      await p.close();
    } catch (e) {
      console.error(`Login failed as ${user}:`, (e as any).message);
    }
  }

  await tryConnect('appuser');
  await tryConnect('appuser_db');

  await dbPool.close();
  await masterPool.close();
}

main().catch((e) => {
  console.error('inspect-security failed', e);
  process.exitCode = 1;
});
