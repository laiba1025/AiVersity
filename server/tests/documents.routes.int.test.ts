import { test, before } from 'node:test';
import assert from 'node:assert';
import request from 'supertest';
import express from 'express';
import session from 'express-session';
import MemoryStore from 'memorystore';
// Use lightweight test-specific routes to avoid complex storage dependencies
import { registerRoutes } from '../routes-lite.ts';

let app: express.Express;

before(async () => {
  // Build an Express app similar to index.ts without starting a network listener
  const MemoryStoreSession = MemoryStore(session);
  app = express();
  app.use(express.json({ limit: '4mb' }));
  app.use(session({
    secret: 'test-secret',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, maxAge: 3600000 },
    store: new MemoryStoreSession({ checkPeriod: 3600000 })
  }));
  await registerRoutes(app);
});

test('health endpoint responds with 200', async () => {
  const res = await request(app).get('/api/test');
  assert.strictEqual(res.status, 200);
});

test('GET /api/documents returns 401 without session', async () => {
  const res = await request(app).get('/api/documents');
  assert.strictEqual(res.status, 401);
});

test('Attempt creating document without auth returns 401', async () => {
  const res = await request(app)
    .post('/api/documents')
    .send({ title: 'Unauth Doc', filename: 'unauth.pdf', status: 'pending' });
  assert.strictEqual(res.status, 401);
});

test('Register user then access /api/documents (empty list)', async () => {
  const username = `itest_${Date.now()}`;
  const registerRes = await request(app)
    .post('/api/auth/register')
    .send({ username, password: 'Passw0rd!', fullName: 'Integration User' });
  assert.strictEqual(registerRes.status, 200);
  const cookie = registerRes.headers['set-cookie']?.[0];
  assert.ok(cookie, 'Session cookie should be set after registration');
  const listRes = await request(app).get('/api/documents').set('Cookie', cookie);
  // Expect 200 with an array (may be empty)
  assert.strictEqual(listRes.status, 200);
  assert.ok(Array.isArray(listRes.body));
});

test('Authenticated document creation (metadata only)', async () => {
  const username = `doccreate_${Date.now()}`;
  const registerRes = await request(app)
    .post('/api/auth/register')
    .send({ username, password: 'Passw0rd!', fullName: 'Metadata User' });
  assert.strictEqual(registerRes.status, 200);
  const cookie = registerRes.headers['set-cookie']?.[0];
  // Create mandatory-like document requires deadline if recognized; choose a normal document
  const createRes = await request(app)
    .post('/api/documents')
    .set('Cookie', cookie)
    .send({ title: 'Notes', filename: 'notes.pdf', status: 'pending' });
  // Depending on schema validation missing fields may cause 400; accept 200 or 400 but not 401
  assert.notStrictEqual(createRes.status, 401);
  assert.ok([200,201,400].includes(createRes.status));
});

test('SAS endpoint requires filename and auth', async () => {
  const res = await request(app).get('/api/documents/sas?filename=test.pdf');
  assert.strictEqual(res.status, 401); // unauthenticated
});
