import { test, before } from 'node:test';
import assert from 'node:assert';
import request from 'supertest';
import express from 'express';
import session from 'express-session';
import MemoryStore from 'memorystore';
import { registerRoutes } from '../routes-lite.ts';

let app: express.Express;

before(async () => {
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

test('complete document lifecycle (metadata + SAS stub)', async () => {
  // Register and capture cookie
  const username = `lifecycle_${Date.now()}`;
  const registerRes = await request(app)
    .post('/api/auth/register')
    .send({ username, password: 'Passw0rd!', fullName: 'Lifecycle User' });
  assert.strictEqual(registerRes.status, 200);
  const cookie = registerRes.headers['set-cookie']?.[0];
  assert.ok(cookie);

  // Create document metadata
  const createRes = await request(app)
    .post('/api/documents')
    .set('Cookie', cookie)
    .send({ title: 'Thesis PDF', filename: 'thesis.pdf', status: 'pending', description: 'test upload' });
  assert.strictEqual(createRes.status, 201);
  assert.ok(createRes.body && createRes.body.id);

  // List should contain the new doc
  const listRes = await request(app)
    .get('/api/documents')
    .set('Cookie', cookie);
  assert.strictEqual(listRes.status, 200);
  const found = (listRes.body as any[]).find(d => d.id === createRes.body.id);
  assert.ok(found, 'Created document should appear in list');

  // Generate SAS URL (stub)
  const sasRes = await request(app)
    .get('/api/documents/sas')
    .set('Cookie', cookie)
    .query({ filename: 'thesis.pdf' });
  assert.strictEqual(sasRes.status, 200);
  assert.ok(sasRes.body && sasRes.body.sas, 'SAS response should include stub sas');
});
