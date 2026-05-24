import { test, describe } from 'node:test';
import assert from 'node:assert';

// Exemplar pure functions (could be extracted from routes.ts logic)
// These mirror expected recommendation and utility behaviors for unit testing demonstration.
export interface Course {
  id: number;
  code: string;
  title: string;
  credits: number;
  semester?: number;
  required: boolean;
  elective: boolean;
  prerequisites?: number[];
}

export interface StudentProfile {
  currentSemester?: number;
  completedCourseIds: number[];
  program?: string;
}

/** Scores a course for recommendation prioritization. */
export function scoreCourse(course: Course, profile: StudentProfile): number {
  let score = 0;
  // Required courses prioritized
  if (course.required) score += 50;
  // Electives get a modest base if still within credit planning scope
  if (course.elective) score += 10;
  // Semester proximity bonus (closer to current semester = higher)
  if (course.semester && profile.currentSemester) {
    const diff = Math.abs(course.semester - profile.currentSemester);
    score += Math.max(0, 30 - diff * 8);
  }
  // Completed prerequisites bonus
  const prereqs = course.prerequisites || [];
  const satisfied = prereqs.every(id => profile.completedCourseIds.includes(id));
  if (prereqs.length && satisfied) score += 25;
  // Penalize if prerequisites unmet
  if (prereqs.length && !satisfied) score -= 40;
  return score;
}

/** Normalizes deadlines to YYYY-MM-DD plain date string. */
export function normalizeDeadline(input: string | Date): string {
  const date = (input instanceof Date) ? input : new Date(input);
  // Ensure valid date
  if (isNaN(date.getTime())) throw new Error('Invalid date');
  return date.toISOString().split('T')[0];
}

/** Evaluates password strength (simple illustrative heuristic). */
export function evaluatePasswordStrength(pwd: string): 'weak' | 'medium' | 'strong' {
  let score = 0;
  if (pwd.length >= 12) score += 2; else if (pwd.length >= 8) score += 1;
  if (/[A-Z]/.test(pwd)) score += 1;
  if (/[a-z]/.test(pwd)) score += 1;
  if (/\d/.test(pwd)) score += 1;
  if (/[^A-Za-z0-9]/.test(pwd)) score += 1;
  return score >= 5 ? 'strong' : score >= 3 ? 'medium' : 'weak';
}

// ---- Tests ----

describe('scoreCourse()', () => {
  test('prioritizes required over elective', () => {
    const profile: StudentProfile = { currentSemester: 3, completedCourseIds: [] };
    const required = scoreCourse({ id:1, code:'C1', title:'Req', credits:6, required:true, elective:false }, profile);
    const elective = scoreCourse({ id:2, code:'E1', title:'Elec', credits:3, required:false, elective:true }, profile);
    assert.ok(required > elective);
  });

  test('semester proximity boosts score', () => {
    const profile: StudentProfile = { currentSemester: 4, completedCourseIds: [] };
    const near = scoreCourse({ id:10, code:'S4', title:'Near', credits:4, semester:4, required:false, elective:true }, profile);
    const far = scoreCourse({ id:11, code:'S1', title:'Far', credits:4, semester:1, required:false, elective:true }, profile);
    assert.ok(near > far);
  });

  test('prerequisite satisfaction adds bonus', () => {
    const profile: StudentProfile = { currentSemester: 5, completedCourseIds: [100,101] };
    const withPrereqs = scoreCourse({ id:20, code:'ADV', title:'Advanced', credits:6, required:true, elective:false, prerequisites:[100,101] }, profile);
    const withoutPrereqs = scoreCourse({ id:21, code:'ADV2', title:'Advanced2', credits:6, required:true, elective:false, prerequisites:[100,999] }, profile);
    assert.ok(withPrereqs > withoutPrereqs);
  });

  test('unsatisfied prerequisites apply penalty even if required', () => {
    const profile: StudentProfile = { currentSemester: 3, completedCourseIds: [200] };
    const course = scoreCourse({ id:30, code:'REQX', title:'ReqX', credits:5, required:true, elective:false, prerequisites:[999] }, profile);
    // Required gives +50; unmet prereq subtracts 40 => net 10 (no semester proximity included)
    assert.strictEqual(course, 10);
  });

  test('semester distance reduces proximity bonus', () => {
    const profile: StudentProfile = { currentSemester: 2, completedCourseIds: [] };
    const near = scoreCourse({ id:40, code:'NEAR', title:'Near', credits:4, semester:2, required:false, elective:true }, profile);
    const far = scoreCourse({ id:41, code:'FAR', title:'Far', credits:4, semester:8, required:false, elective:true }, profile);
    assert.ok(near > far);
  });
});

describe('normalizeDeadline()', () => {
  test('formats date string input', () => {
    const normalized = normalizeDeadline('2025-11-20T15:30:00Z');
    assert.strictEqual(normalized, '2025-11-20');
  });

  test('formats Date object input', () => {
    const normalized = normalizeDeadline(new Date('2026-01-05'));
    assert.strictEqual(normalized, '2026-01-05');
  });

  test('throws on invalid date', () => {
    assert.throws(() => normalizeDeadline('not-a-date'));
  });
});

describe('evaluatePasswordStrength()', () => {
  test('classifies weak', () => {
    assert.strictEqual(evaluatePasswordStrength('abc123'), 'weak');
  });
  test('classifies medium', () => {
    assert.strictEqual(evaluatePasswordStrength('Abcdef123'), 'medium');
  });
  test('classifies strong', () => {
    assert.strictEqual(evaluatePasswordStrength('A!bcdef12345'), 'strong');
  });

  test('very long complex password remains strong', () => {
    assert.strictEqual(evaluatePasswordStrength('Str0ng!Passw0rd#2025_Extra'), 'strong');
  });
});
