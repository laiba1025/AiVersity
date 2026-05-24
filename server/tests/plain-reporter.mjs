// Custom plain reporter: prints each test name and PASS/FAIL/SKIP, then totals.
// Node >=20 test runner custom reporter API.

export const reporter = () => {
  let total = 0;
  let passed = 0;
  let failed = 0;
  let skipped = 0;

  function isLeaf(test) {
    // Leaf tests have a file and no subtests, type 'test'
    return test.type === 'test';
  }

  return {
    onTestFinish(test) {
      if (!isLeaf(test)) return; // ignore suites
      total++;
      let status;
      if (test.skip) {
        skipped++;
        status = 'SKIPPED';
      } else if (test.todo) {
        skipped++; // treat todo as skipped for summary
        status = 'TODO';
      } else if (test.fail) {
        failed++;
        status = 'FAILED';
      } else {
        passed++;
        status = 'PASSED';
      }
      // Plain line output
      process.stdout.write(`Test: ${test.name} - ${status}\n`);
      if (test.diagnostic) {
        process.stdout.write(`  ${test.diagnostic}\n`);
      }
    },
    onFinish() {
      process.stdout.write(`\nTotal: ${total}  Passed: ${passed}  Failed: ${failed}  Skipped: ${skipped}\n`);
      // Non-zero exit if failures
      if (failed > 0) process.exitCode = 1;
    }
  };
};
