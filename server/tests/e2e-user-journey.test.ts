import { test, describe } from 'node:test';
import assert from 'node:assert';
import request from 'supertest';
import express from 'express';
import session from 'express-session';
import { registerRoutes } from '../routes.ts';

/**
 * End-to-End Test Suite: Complete User Journeys
 * 
 * Tests full user workflows spanning authentication, document management,
 * course recommendations, and chat interactions following real-world usage patterns.
 */

describe('E2E: Complete User Journey - New Student Onboarding', async () => {
  let app: express.Application;

  // Setup minimal Express app with routes
  app = express();
  app.use(express.json());
  app.use(session({
    secret: 'test-secret-e2e',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false }
  }));
  await registerRoutes(app);

  await test('Journey 1: Registration → Login → Profile Setup → Document Upload', async () => {
    const username = `e2e_student_${Date.now()}`;
    
    // Step 1: User registers new account
    const registerRes = await request(app)
      .post('/api/auth/register')
      .send({
        username,
        password: 'SecurePass123!',
        fullName: 'E2E Test Student',
        language: 'en'
      });
    
    assert.strictEqual(registerRes.status, 201, 'Registration should succeed');
    assert.ok(registerRes.body.id, 'Should return user ID');
    const cookie = registerRes.headers['set-cookie'];
    assert.ok(cookie, 'Should set session cookie');

    // Step 2: Verify session persists and user can access profile
    const profileRes = await request(app)
      .get('/api/user')
      .set('Cookie', cookie);
    
    assert.strictEqual(profileRes.status, 200, 'Should access profile');
    assert.strictEqual(profileRes.body.username, username, 'Profile should match registered user');
    assert.strictEqual(profileRes.body.fullName, 'E2E Test Student');

    // Step 3: Create student profile for academic planning
    const profileSetupRes = await request(app)
      .post('/api/student/profile')
      .set('Cookie', cookie)
      .send({
        program: 'AI MSc',
        currentSemester: 1
      });
    
    assert.strictEqual(profileSetupRes.status, 200, 'Profile setup should succeed');

    // Step 4: Upload mandatory document (passport simulation)
    const docRes = await request(app)
      .post('/api/documents')
      .set('Cookie', cookie)
      .send({
        title: 'Passport',
        filename: 'passport.pdf',
        fileContent: 'base64_encoded_content_stub',
        fileType: 'passport',
        status: 'completed',
        deadline: '2025-12-31'
      });
    
    assert.strictEqual(docRes.status, 201, 'Document creation should succeed');
    assert.ok(docRes.body.id, 'Should return document ID');
    assert.strictEqual(docRes.body.status, 'completed');

    // Step 5: Verify mandatory documents status
    const mandatoryRes = await request(app)
      .get('/api/mandatory-docs')
      .set('Cookie', cookie);
    
    assert.strictEqual(mandatoryRes.status, 200, 'Should retrieve mandatory docs status');
    const passportDoc = mandatoryRes.body.mandatory.find((d: any) => d.key === 'passport');
    assert.ok(passportDoc, 'Passport should be in mandatory docs');
    assert.strictEqual(passportDoc.uploaded, true, 'Passport should be marked uploaded');
  });

  await test('Journey 2: Course Recommendation Workflow', async () => {
    const username = `e2e_planner_${Date.now()}`;
    
    // Step 1: Register and login
    const registerRes = await request(app)
      .post('/api/auth/register')
      .send({
        username,
        password: 'PlannerPass456!',
        fullName: 'Course Planner User',
        language: 'en'
      });
    
    assert.strictEqual(registerRes.status, 201, 'Registration should succeed');
    const cookie = registerRes.headers['set-cookie'];

    // Step 2: Setup academic profile
    await request(app)
      .post('/api/student/profile')
      .set('Cookie', cookie)
      .send({
        program: 'AI MSc',
        currentSemester: 2
      });

    // Step 3: Get available programs
    const programsRes = await request(app)
      .get('/api/programs')
      .set('Cookie', cookie);
    
    assert.strictEqual(programsRes.status, 200, 'Should list programs');
    // Programs endpoint returns object with programs array
    const programsList = Array.isArray(programsRes.body) ? programsRes.body : programsRes.body.programs;
    assert.ok(programsList, 'Should have programs data');

    // Step 4: Get course catalog for program
    const coursesRes = await request(app)
      .get('/api/courses?program=AI MSc')
      .set('Cookie', cookie);
    
    assert.strictEqual(coursesRes.status, 200, 'Should list courses');
    assert.ok(Array.isArray(coursesRes.body), 'Courses should be an array');

    // Step 5: Request personalized recommendations
    const recsRes = await request(app)
      .post('/api/recommendations')
      .set('Cookie', cookie)
      .send({
        program: 'AI MSc',
        targetSemester: 2,
        maxCredits: 30
      });
    
    assert.strictEqual(recsRes.status, 200, 'Recommendations should succeed');
    assert.ok(Array.isArray(recsRes.body.recommendations), 'Should include recommendations array');
    assert.ok(typeof recsRes.body.totalCredits === 'number', 'Should include total credits');
  });

  await test('Journey 3: Document Management Lifecycle', async () => {
    const username = `e2e_docs_${Date.now()}`;
    
    // Step 1: Register
    const registerRes = await request(app)
      .post('/api/auth/register')
      .send({
        username,
        password: 'DocsPass789!',
        fullName: 'Document Manager User'
      });
    
    const cookie = registerRes.headers['set-cookie'];

    // Step 2: Create document with pending status
    const createRes = await request(app)
      .post('/api/documents')
      .set('Cookie', cookie)
      .send({
        title: 'Residence Permit Application',
        filename: 'residence_permit.pdf',
        fileContent: 'application_content_stub',
        fileType: 'residence_permit',
        status: 'pending',
        deadline: '2025-12-31'
      });
    
    assert.strictEqual(createRes.status, 201, 'Document creation should succeed');
    const docId = createRes.body.id;

    // Step 3: List user documents
    const listRes = await request(app)
      .get('/api/documents')
      .set('Cookie', cookie);
    
    assert.strictEqual(listRes.status, 200, 'Should list documents');
    assert.ok(Array.isArray(listRes.body), 'Documents should be an array');
    const found = listRes.body.find((d: any) => d.id === docId);
    assert.ok(found, 'Created document should appear in list');
    assert.strictEqual(found.status, 'pending');

    const updateRes = await request(app)
      .patch(`/api/documents/${docId}/status`)
      .set('Cookie', cookie)
      .send({ status: 'completed' });
    
    assert.strictEqual(updateRes.status, 200, 'Status update should succeed');
    assert.strictEqual(updateRes.body.status, 'completed');

    // Step 5: Verify updated status persists
    const verifyRes = await request(app)
      .get(`/api/documents/${docId}`)
      .set('Cookie', cookie);
    
    assert.strictEqual(verifyRes.status, 200, 'Should retrieve document');
    assert.strictEqual(verifyRes.body.status, 'completed', 'Status should persist');
  });

  await test('Journey 4: Notification System Flow', async () => {
    const username = `e2e_notif_${Date.now()}`;
    
    // Step 1: Register
    const registerRes = await request(app)
      .post('/api/auth/register')
      .send({
        username,
        password: 'NotifPass000!',
        fullName: 'Notification Test User'
      });
    
    const cookie = registerRes.headers['set-cookie'];

    // Step 2: Check initial unread count
    const countRes = await request(app)
      .get('/api/notifications/unread/count')
      .set('Cookie', cookie);
    
    assert.strictEqual(countRes.status, 200, 'Should get unread count');
    assert.ok(typeof countRes.body.count === 'number', 'Count should be a number');
    const initialCount = countRes.body.count;

    // Step 3: List all notifications
    const listRes = await request(app)
      .get('/api/notifications')
      .set('Cookie', cookie);
    
    assert.strictEqual(listRes.status, 200, 'Should list notifications');
    assert.ok(Array.isArray(listRes.body), 'Notifications should be an array');

    // Step 4: Mark all as read
    const markAllRes = await request(app)
      .post('/api/notifications/read/all')
      .set('Cookie', cookie);
    
    assert.strictEqual(markAllRes.status, 200, 'Mark all read should succeed');

    // Step 5: Verify unread count decreased
    const verifyCountRes = await request(app)
      .get('/api/notifications/unread/count')
      .set('Cookie', cookie);
    
    assert.strictEqual(verifyCountRes.status, 200);
    assert.ok(verifyCountRes.body.count <= initialCount, 'Unread count should not increase');
  });

  await test('Journey 5: Authentication & Security Flow', async () => {
    const username = `e2e_security_${Date.now()}`;
    const password = 'SecureTest999!';
    
    // Step 1: Register
    const registerRes = await request(app)
      .post('/api/auth/register')
      .send({
        username,
        password,
        fullName: 'Security Test User'
      });
    
    assert.strictEqual(registerRes.status, 201, 'Registration should succeed');
    const cookie = registerRes.headers['set-cookie'];

    // Step 2: Logout
    const logoutRes = await request(app)
      .post('/api/auth/logout')
      .set('Cookie', cookie);
    
    assert.strictEqual(logoutRes.status, 200, 'Logout should succeed');

    // Step 3: Verify session destroyed (protected endpoint should fail)
    const protectedRes = await request(app)
      .get('/api/user')
      .set('Cookie', cookie);
    
    assert.strictEqual(protectedRes.status, 401, 'Should reject after logout');

    // Step 4: Login again with same credentials
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ username, password });
    
    assert.strictEqual(loginRes.status, 200, 'Login should succeed');
    assert.ok(loginRes.body.username, 'Should return username');
    assert.strictEqual(loginRes.body.username, username);

    // Step 5: Change password
    const newPassword = 'NewSecure111!';
    const newCookie = loginRes.headers['set-cookie'];
    const changePwRes = await request(app)
      .post('/api/auth/change-password')
      .set('Cookie', newCookie)
      .send({
        currentPassword: password,
        newPassword
      });
    
    assert.strictEqual(changePwRes.status, 200, 'Password change should succeed');

    // Step 6: Verify old password no longer works
    await request(app).post('/api/auth/logout').set('Cookie', newCookie);
    
    const oldPwLoginRes = await request(app)
      .post('/api/auth/login')
      .send({ username, password });
    
    assert.strictEqual(oldPwLoginRes.status, 401, 'Old password should be rejected');

    // Step 7: Verify new password works
    const newPwLoginRes = await request(app)
      .post('/api/auth/login')
      .send({ username, password: newPassword });
    
    assert.strictEqual(newPwLoginRes.status, 200, 'New password should work');
  });
});

describe('E2E: Error Handling & Edge Cases', async () => {
  let app: express.Application;

  app = express();
  app.use(express.json());
  app.use(session({
    secret: 'test-secret-edge',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false }
  }));
  await registerRoutes(app);

  await test('Duplicate registration should fail gracefully', async () => {
    const username = `e2e_dup_${Date.now()}`;
    
    // First registration
    const firstRes = await request(app)
      .post('/api/auth/register')
      .send({
        username,
        password: 'Password123!',
        fullName: 'First User'
      });
    
    assert.strictEqual(firstRes.status, 201);

    // Duplicate registration attempt
    const dupRes = await request(app)
      .post('/api/auth/register')
      .send({
        username,
        password: 'DifferentPass456!',
        fullName: 'Second User'
      });
    
    assert.strictEqual(dupRes.status, 409, 'Should return conflict status');
    assert.ok(dupRes.body.message, 'Should include error message');
  });

  await test('Accessing protected routes without authentication', async () => {
    const endpoints = [
      { method: 'get', path: '/api/user' },
      { method: 'get', path: '/api/documents' },
      { method: 'post', path: '/api/documents' },
      { method: 'get', path: '/api/notifications' },
      { method: 'post', path: '/api/messages' }
    ];

    for (const endpoint of endpoints) {
      const res = await (request(app) as any)[endpoint.method](endpoint.path);
      assert.strictEqual(res.status, 401, `${endpoint.path} should require authentication`);
    }
  });

  await test('Invalid login credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        username: 'nonexistent_user',
        password: 'wrong_password'
      });
    
    assert.ok([401, 404].includes(res.status), 'Should reject invalid credentials');
  });

  await test('Document access control (user isolation)', async () => {
    // User 1 creates document
    const user1Res = await request(app)
      .post('/api/auth/register')
      .send({
        username: `e2e_user1_${Date.now()}`,
        password: 'User1Pass!',
        fullName: 'User One'
      });
    
    const user1Cookie = user1Res.headers['set-cookie'];
    
    const docRes = await request(app)
      .post('/api/documents')
      .set('Cookie', user1Cookie)
      .send({
        title: 'Private Document',
        filename: 'private.pdf',
        fileContent: 'secret_content',
        fileType: 'application/pdf',
        status: 'completed'
      });
    
    const docId = docRes.body.id;

    // User 2 tries to access User 1's document
    const user2Res = await request(app)
      .post('/api/auth/register')
      .send({
        username: `e2e_user2_${Date.now()}`,
        password: 'User2Pass!',
        fullName: 'User Two'
      });
    
    const user2Cookie = user2Res.headers['set-cookie'];
    
    const accessRes = await request(app)
      .get(`/api/documents/${docId}`)
      .set('Cookie', user2Cookie);
    
    // Should either return 404 (not found) or 403 (forbidden)
    assert.ok([403, 404].includes(accessRes.status), 'Should prevent cross-user document access');
  });
});
