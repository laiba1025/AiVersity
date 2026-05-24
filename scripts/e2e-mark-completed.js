// e2e-mark-completed.js
// Minimal end-to-end test: login, mark a course completed, verify, unmark, verify.
// Uses global fetch (Node 18+). Works without extra deps.

async function run() {
  const base = 'http://127.0.0.1:3000';

  const username = 'maria';
  const password = 'password123';
  const program = 'AI MSc';
  const courseIdToToggle = 1;

  console.log('Logging in...');
  let res = await fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });

  if (!res.ok) {
    console.error('Login failed', res.status, await res.text());
    process.exit(1);
  }

  const setCookie = res.headers.get('set-cookie');
  if (!setCookie) {
    console.error('No set-cookie header received; server may not be setting session cookie');
    process.exit(1);
  }

  // Use only the cookie pair (name=val) portion
  const cookie = setCookie.split(';')[0];
  console.log('Received cookie:', cookie);

  console.log('Fetching student courses for program', program);
  res = await fetch(`${base}/api/student/courses/by-program?program=${encodeURIComponent(program)}`, {
    headers: { cookie },
  });
  if (!res.ok) {
    console.error('Failed to fetch courses', res.status, await res.text());
    process.exit(1);
  }
  const dataBefore = await res.json();
  console.log('Courses fetched. Sample:', JSON.stringify(dataBefore.courses.slice(0,3), null, 2));

  console.log('Marking course', courseIdToToggle, 'as completed');
  res = await fetch(`${base}/api/student/courses/mark-completed`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({ courseId: courseIdToToggle }),
  });
  console.log('Mark response status:', res.status);
  const markBody = await res.text();
  console.log('Mark response body:', markBody);

  console.log('Fetching student courses again to verify');
  res = await fetch(`${base}/api/student/courses/by-program?program=${encodeURIComponent(program)}`, {
    headers: { cookie },
  });
  const dataAfterMark = await res.json();
  const toggled = dataAfterMark.courses.find(c => c.id === courseIdToToggle);
  console.log('Course after mark:', toggled);

  console.log('Unmarking course', courseIdToToggle);
  res = await fetch(`${base}/api/student/courses/unmark-completed`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({ courseId: courseIdToToggle }),
  });
  console.log('Unmark response status:', res.status);
  console.log('Unmark response body:', await res.text());

  console.log('Fetching student courses one more time to verify unmark');
  res = await fetch(`${base}/api/student/courses/by-program?program=${encodeURIComponent(program)}`, {
    headers: { cookie },
  });
  const dataAfterUnmark = await res.json();
  const toggledAfter = dataAfterUnmark.courses.find(c => c.id === courseIdToToggle);
  console.log('Course after unmark:', toggledAfter);

  console.log('E2E flow done.');
}

run().catch(err => {
  console.error('E2E script error:', err);
  process.exit(2);
});
