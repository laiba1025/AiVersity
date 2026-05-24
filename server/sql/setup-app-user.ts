import { ConnectionPool } from 'mssql';
import sql from 'mssql';
import { closeSqlPool } from '../db/sql';

function toMasterConnString(conn: string): string {
  // Replace Initial Catalog=... with master
  return conn.replace(/Initial Catalog=([^;]+)/i, 'Initial Catalog=master');
}

function getDbConnString(): string {
  const s = process.env.AZURE_SQL_CONNECTION_STRING;
  if (!s) throw new Error('AZURE_SQL_CONNECTION_STRING not set');
  return s;
}

function getAdminConnString(): string {
  const admin = process.env.AZURE_SQL_ADMIN_CONNECTION_STRING;
  return admin || getDbConnString();
}

async function main() {
  const appUser = process.env.AZURE_SQL_APP_USER || 'appuser';
  const dbUser = process.env.AZURE_SQL_APP_DB_USER || 'appuser_db';
  const appPass = process.env.AZURE_SQL_APP_PASSWORD || 'Strong#Passw0rd!2025';
  const dbNameMatch = (process.env.AZURE_SQL_CONNECTION_STRING || '').match(/Initial Catalog=([^;]+)/i);
  const dbName = dbNameMatch ? dbNameMatch[1] : 'aiversitydb';

  const adminConn = toMasterConnString(getAdminConnString());
  let masterPool: ConnectionPool | null = null;
  let dbPool: ConnectionPool | null = null;
  try {
    masterPool = await new sql.ConnectionPool(adminConn).connect();
    console.log('Connected to master');

    // Create or update LOGIN at server level
    await masterPool.request()
      .input('login', sql.NVarChar, appUser)
      .input('pwd', sql.NVarChar, appPass)
      .query(`IF NOT EXISTS (SELECT * FROM sys.sql_logins WHERE name = @login)
              BEGIN
                DECLARE @sql NVARCHAR(MAX) = 'CREATE LOGIN [' + @login + '] WITH PASSWORD = ''' + @pwd + ''';';
                EXEC (@sql);
              END
              ELSE
              BEGIN
                DECLARE @alter NVARCHAR(MAX) = 'ALTER LOGIN [' + @login + '] WITH PASSWORD = ''' + @pwd + ''';';
                EXEC (@alter);
              END;`);
    console.log('Server login ensured/updated');

    // Connect to target DB
  const dbConn = getAdminConnString();
  dbPool = await new sql.ConnectionPool(dbConn).connect();
    console.log('Connected to database', dbName);

    // Create USER mapped to LOGIN and grant roles
    await dbPool.request().input('login', sql.NVarChar, appUser).query(`
      IF NOT EXISTS (SELECT * FROM sys.database_principals WHERE name = @login)
      BEGIN
        DECLARE @sql NVARCHAR(MAX) = 'CREATE USER [' + @login + '] FOR LOGIN [' + @login + '];';
        EXEC (@sql);
      END;
    `);

    await dbPool.request().input('login', sql.NVarChar, appUser).query(`
      EXEC sp_addrolemember 'db_datareader', @login;
      EXEC sp_addrolemember 'db_datawriter', @login;
      EXEC sp_addrolemember 'db_ddladmin', @login; -- allow DDL operations like CREATE TABLE
    `);

  console.log(`App user '${appUser}' ready with reader/writer roles.`);

    // Also ensure a contained database user (no server-level login)
    await dbPool.request()
      .input('user', sql.NVarChar, dbUser)
      .input('pwd', sql.NVarChar, appPass)
      .query(`IF NOT EXISTS (SELECT * FROM sys.database_principals WHERE name = @user)
              BEGIN
                DECLARE @sql NVARCHAR(MAX) = 'CREATE USER [' + @user + '] WITH PASSWORD = ''' + @pwd + ''';';
                EXEC (@sql);
              END
              ELSE
              BEGIN
                DECLARE @alter NVARCHAR(MAX) = 'ALTER USER [' + @user + '] WITH PASSWORD = ''' + @pwd + ''';';
                EXEC (@alter);
              END;`);
    await dbPool.request().input('user', sql.NVarChar, dbUser).query(`
      EXEC sp_addrolemember 'db_datareader', @user;
      EXEC sp_addrolemember 'db_datawriter', @user;
      EXEC sp_addrolemember 'db_ddladmin', @user; -- allow DDL operations like CREATE TABLE
    `);
    console.log(`Contained DB user '${dbUser}' ready with reader/writer roles.`);
  } catch (err) {
    console.error('Setup app user failed:', err);
    process.exitCode = 1;
  } finally {
    if (dbPool) await dbPool.close();
    if (masterPool) await masterPool.close();
    await closeSqlPool();
  }
}

main();
