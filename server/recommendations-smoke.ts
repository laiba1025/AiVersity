import http from 'http';

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const HOST = process.env.HOST || '127.0.0.1';

function get(path: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: HOST, port: PORT, path, method: 'GET' }, res => {
      let raw = '';
      res.on('data', chunk => raw += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(raw)); } catch { resolve(raw); }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

function post(path: string, data: any): Promise<any> {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(data);
    const req = http.request({
      hostname: HOST,
      port: PORT,
      path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    }, res => {
      let raw = '';
      res.on('data', chunk => raw += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(raw)); } catch { resolve(raw); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

(async () => {
  try {
    const health = await get('/api/test');
    if (!health || (typeof health === 'object' && health.status !== 'ok')) {
      console.error('Healthcheck failed:', health);
      process.exit(2);
    }

    const result = await post('/api/recommendations', { program: 'AI MSc', maxCredits: 18, preferElectives: false });
    console.log(JSON.stringify({ ok: true, host: HOST, port: PORT, result }, null, 2));
  } catch (e) {
    console.error('Test failed:', e);
    process.exit(1);
  }
})();
