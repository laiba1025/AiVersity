import express from 'express';
import path from 'path';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const port = 5000;

// Serve static files
app.use(express.static(path.join(__dirname, '../client')));

// Simple test API endpoint
app.get('/api/test', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running correctly' });
});

// Health check route
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

// Serve a simple HTML page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/test.html'));
});

app.listen(port, 'localhost', () => {
  console.log(`Test server running at http://localhost:${port}`);
});