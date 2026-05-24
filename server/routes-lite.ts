import type { Express, Request, Response } from 'express';
import { createServer, type Server } from 'http';

interface UserRec { id: number; username: string; password: string; fullName: string; }
interface DocRec { id: number; userId: number; title: string; filename: string; status: string; description?: string; }

const users: UserRec[] = [];
const documents: DocRec[] = [];
let userIdSeq = 1;
let docIdSeq = 1;

function requireAuth(req: Request, res: Response): number | null {
  const uid = (req.session as any)?.userId;
  if (!uid) { res.status(401).json({ error: 'unauthorized' }); return null; }
  return uid;
}

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);

  app.get('/api/test', (_req, res) => {
    res.json({ status: 'ok', message: 'Server is running correctly' });
  });

  app.post('/api/auth/register', (req, res) => {
    const { username, password, fullName } = req.body || {};
    if (!username || !password || !fullName) {
      return res.status(400).json({ error: 'missing fields' });
    }
    if (users.some(u => u.username === username)) {
      return res.status(400).json({ error: 'username taken' });
    }
    const user: UserRec = { id: userIdSeq++, username, password, fullName };
    users.push(user);
    (req.session as any).userId = user.id;
    res.json({ id: user.id, username, fullName });
  });

  app.get('/api/documents', (req, res) => {
    const uid = requireAuth(req, res); if (!uid) return;
    const list = documents.filter(d => d.userId === uid);
    res.json(list);
  });

  app.post('/api/documents', (req, res) => {
    const uid = requireAuth(req, res); if (!uid) return;
    const { title, filename, status } = req.body || {};
    if (!title || !filename || !status) {
      return res.status(400).json({ error: 'missing fields' });
    }
    const rec: DocRec = { id: docIdSeq++, userId: uid, title, filename, status, description: (req.body as any).description };
    documents.push(rec);
    res.status(201).json(rec);
  });

  app.get('/api/documents/sas', (req, res) => {
    const uid = requireAuth(req, res); if (!uid) return;
    const filename = req.query.filename as string | undefined;
    if (!filename) return res.status(400).json({ error: 'filename required' });
    // Stub: would normally return SAS URL
    res.json({ filename, sas: 'stub-url' });
  });

  return httpServer;
}
