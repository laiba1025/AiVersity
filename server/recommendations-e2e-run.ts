import express from 'express';
import session from 'express-session';
import MemoryStore from 'memorystore';
import { registerRoutes } from './routes';
import http from 'http';

function get(host: string, port: number, path: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: host, port, path, method: 'GET' }, res => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => { try { resolve(JSON.parse(raw)); } catch { resolve(raw); } });
    });
    req.on('error', reject);
    req.end();
  });
}

function post(host: string, port: number, path: string, data: any): Promise<any> {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(data);
    const req = http.request({ hostname: host, port, path, method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } }, res => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => { try { resolve(JSON.parse(raw)); } catch { resolve(raw); } });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

(async () => {
  try {
    process.env.NODE_ENV = process.env.NODE_ENV || 'production';

    const app = express();
    app.use(express.json());
    app.use(express.urlencoded({ extended: false }));

    const MemoryStoreSession = (MemoryStore as any)(session);
    app.use(session({
      secret: 'student-assistant-secret-key',
      resave: false,
      saveUninitialized: false,
      cookie: { secure: false, maxAge: 86400000 },
      store: new MemoryStoreSession({ checkPeriod: 86400000 })
    }));

    const httpServer = await registerRoutes(app);

    await new Promise<void>((resolve, reject) => {
      httpServer.listen({ port: 0, host: '127.0.0.1' }, () => resolve());
      httpServer.on('error', reject);
    });

    const address = httpServer.address();
    const port = typeof address === 'object' && address && 'port' in address ? (address as any).port as number : 0;
    const host = '127.0.0.1';

    const health = await get(host, port, '/api/test');
    if (!health || (typeof health === 'object' && health.status !== 'ok')) {
      console.error('Healthcheck failed:', health);
      process.exit(2);
    }

    const rec = await post(host, port, '/api/recommendations', { program: 'AI MSc', maxCredits: 18, preferElectives: false });
    console.log(JSON.stringify({ ok: true, host, port, health, recommendations: rec }, null, 2));

    httpServer.close();
    process.exit(0);
  } catch (err) {
    console.error('E2E run failed:', err);
    process.exit(1);
  }
})();
