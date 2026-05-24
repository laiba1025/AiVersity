#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { EOL } from 'node:os';

// Test files to run (keep aligned with package.json earlier intent)
const testFiles = [
  'server/tests/recommendation-engine.unit.test.ts',
  'server/tests/documents.routes.int.test.ts'
];

const args = ['--test', '--test-reporter', 'tap', ...testFiles];
const child = spawn(process.execPath, args, { stdio: ['ignore', 'pipe', 'pipe'] });

let raw = '';
child.stdout.on('data', d => raw += d.toString());
child.stderr.on('data', d => raw += d.toString());

child.on('close', (code) => {
  const lines = raw.split(/\r?\n/);
  let total = 0, passed = 0, failed = 0, skipped = 0;
  const testLines = [];
  for (const line of lines) {
    // TAP lines: ok <num> - <name> [# SKIP]
    if (/^ok \d+ - /.test(line)) {
      const namePart = line.replace(/^ok \d+ - /, '').trim();
      let status = 'PASSED';
      if (/SKIP/i.test(namePart)) {
        status = 'SKIPPED';
        skipped++;
      } else {
        passed++;
      }
      total++;
      const nameClean = namePart.replace(/# SKIP.*/i, '').trim();
      testLines.push(`Test: ${nameClean} - ${status}`);
    } else if (/^not ok \d+ - /.test(line)) {
      const namePart = line.replace(/^not ok \d+ - /, '').trim();
      failed++; total++;
      testLines.push(`Test: ${namePart} - FAILED`);
    }
  }
  for (const tl of testLines) process.stdout.write(tl + EOL);
  process.stdout.write(EOL + `Total: ${total} Passed: ${passed} Failed: ${failed} Skipped: ${skipped}` + EOL);
  process.exitCode = failed > 0 ? 1 : 0;
});
