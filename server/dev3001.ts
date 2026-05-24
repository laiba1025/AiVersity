// Force the server to listen on port 3001 for a parallel instance
process.env.PORT = '3001';
// Use dynamic import so the env var is set before server boot (ESM loads static imports early)
await import('./index');

export {};
