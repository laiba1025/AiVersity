#!/usr/bin/env node
// Run node tests with default reporter, then strip tick/arrow symbols.
import { spawn } from 'node:child_process';

const testFiles = [
  'server/tests/recommendation-engine.unit.test.ts',
  'server/tests/documents.routes.int.test.ts'
];

const child = spawn(process.execPath, ['--test', ...testFiles], { stdio: ['ignore', 'pipe', 'pipe'] });
let output = '';
child.stdout.on('data', d => output += d.toString());
child.stderr.on('data', d => output += d.toString());

child.on('close', code => {
  const cleaned = output
    .split(/\r?\n/) // process line by line
    .map(line => line.replace(/[✔▶﹣]/g, '').replace(/\s{2,}/g, ' ').replace(/^\s+/,''))
    .join('\n');
  process.stdout.write(cleaned + '\n');
  process.exitCode = code;
});
