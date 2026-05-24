import { getSqlPool, closeSqlPool } from './db/sql';

async function main() {
  try {
    const pool = await getSqlPool();
    console.log('Connected to Azure SQL');

    // Create minimal tables if they don't exist (users, documents)
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'users')
      BEGIN
        CREATE TABLE users (
          id INT IDENTITY(1,1) PRIMARY KEY,
          username NVARCHAR(100) NOT NULL UNIQUE,
          password NVARCHAR(255) NOT NULL,
          full_name NVARCHAR(200) NOT NULL,
          language NVARCHAR(10) NOT NULL DEFAULT 'en'
        );
      END;

      IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'documents')
      BEGIN
        CREATE TABLE documents (
          id INT IDENTITY(1,1) PRIMARY KEY,
          user_id INT NOT NULL,
          title NVARCHAR(200) NOT NULL,
          description NVARCHAR(1000) NULL,
          filename NVARCHAR(300) NOT NULL,
          file_content NVARCHAR(MAX) NOT NULL,
          file_type NVARCHAR(100) NOT NULL,
          status NVARCHAR(20) NOT NULL,
          deadline DATE NULL,
          created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
          CONSTRAINT FK_documents_users FOREIGN KEY (user_id) REFERENCES users(id)
        );
        CREATE INDEX IX_documents_user ON documents(user_id);
      END;
    `);

    // Seed a user if none exists
    const u = await pool.request().query(`SELECT TOP 1 * FROM users ORDER BY id`);
    if (u.recordset.length === 0) {
      await pool.request()
        .input('username', 'demo')
        .input('password', 'password123')
        .input('full_name', 'Demo User')
        .input('language', 'en')
        .query(`INSERT INTO users (username, password, full_name, language) VALUES (@username, @password, @full_name, @language);`);
      console.log('Seeded demo user');
    }

    // Fetch the user id
    const userRow = await pool.request().query(`SELECT TOP 1 id, username FROM users ORDER BY id`);
    const userId = userRow.recordset[0].id as number;

    // Insert a demo document
    await pool.request()
      .input('user_id', userId)
      .input('title', 'Test Document')
      .input('description', 'Inserted by test-sql-setup')
      .input('filename', 'test.txt')
      .input('file_content', '')
      .input('file_type', 'text/plain')
      .input('status', 'pending')
      .input('deadline', null)
      .query(`INSERT INTO documents (user_id, title, description, filename, file_content, file_type, status, deadline)
              VALUES (@user_id, @title, @description, @filename, @file_content, @file_type, @status, @deadline);`);

    const docs = await pool.request().input('user_id', userId).query(`SELECT TOP 5 id, title, status FROM documents WHERE user_id=@user_id ORDER BY created_at DESC`);
    console.log('Documents for user', userId, docs.recordset);

    console.log('Azure SQL smoke test finished successfully');
  } catch (err) {
    console.error('Azure SQL test failed:', err);
    process.exitCode = 1;
  } finally {
    await closeSqlPool();
  }
}

main();
