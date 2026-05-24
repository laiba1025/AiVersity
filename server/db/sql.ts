import sql, { ConnectionPool } from 'mssql';
import dotenv from 'dotenv';
import path from 'path';

// Load env from root and server/.env
dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), 'server', '.env') });

let poolPromise: Promise<ConnectionPool> | undefined;

export function getSqlPool(): Promise<ConnectionPool> {
  if (!poolPromise) {
    const connStr = process.env.AZURE_SQL_CONNECTION_STRING;
    if (!connStr) throw new Error('AZURE_SQL_CONNECTION_STRING is not set');
  poolPromise = new sql.ConnectionPool(connStr as string).connect();
  }
  return poolPromise as Promise<ConnectionPool>;
}

export async function closeSqlPool(): Promise<void> {
  if (poolPromise) {
    const pool = await poolPromise;
    await pool.close();
    poolPromise = undefined;
  }
}
