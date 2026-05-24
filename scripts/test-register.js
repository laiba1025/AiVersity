const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

(async () => {
  const base = 'http://localhost:3000';
  const username = `test_user_${Date.now()}`;
  console.log('Registering user', username);
  // Register
  let res = await fetch(`${base}/api/auth/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username, password: 'pass123', fullName: 'Test User' })
  });
  console.log('register status', res.status);
  const setCookie = res.headers.get('set-cookie');
  const body = await res.json().catch(() => null);
  console.log('register body', body, 'set-cookie:', setCookie);

  // Save profile
  res = await fetch(`${base}/api/student/profile`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie: setCookie || '' },
    // set program CS BSc and semester 3
    body: JSON.stringify({ program: 'CS BSc', major: 'Computer Science', currentSemester: 3 })
  });
  console.log('profile status', res.status);
  const prof = await res.json().catch(() => null);
  console.log('profile body', prof);

  // Fetch student courses
  res = await fetch(`${base}/api/student/courses/by-program?program=${encodeURIComponent('CS BSc')}`, {
    method: 'GET'
  });
  const courses = await res.json().catch(() => null);
  console.log('courses:', courses);
})();
