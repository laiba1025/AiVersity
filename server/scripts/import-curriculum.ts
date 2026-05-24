#!/usr/bin/env tsx
/**
 * Import CS BSc curriculum JSON into server/storage-data.json, replacing existing CS BSc entries.
 * JSON shape: { program: string, courses: Array<{ code, title, credits, semester, required, elective, compulsoryElective }> }
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// __dirname isn't available in ESM; derive from import.meta.url
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const STORAGE_PATH = path.join(ROOT, 'server', 'storage-data.json');
const INPUT_PATH = path.join(ROOT, 'server', 'data', 'curricula', 'cs_bsc.json');

function readJson(p: string) {
  return JSON.parse(fs.readFileSync(p, 'utf-8'));
}

function writeJson(p: string, obj: any) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(obj, null, 2));
}

function main() {
  if (!fs.existsSync(INPUT_PATH)) {
    console.error('Input curriculum not found:', INPUT_PATH);
    process.exit(1);
  }
  if (!fs.existsSync(STORAGE_PATH)) {
    console.error('storage-data.json not found at', STORAGE_PATH);
    process.exit(1);
  }

  const input = readJson(INPUT_PATH) as { program: string; courses: any[] };
  const program = input.program || 'CS BSc';
  const newCourses: any[] = (input.courses || []).map(c => ({
    program,
    code: String(c.code || ''),
    title: String(c.title || ''),
    credits: Number.isFinite(c.credits) ? c.credits : 0,
    semester: (typeof c.semester === 'number' ? c.semester : null),
    required: !!c.required,
    elective: !!c.elective,
    compulsoryElective: !!c.compulsoryElective,
  }));

  const storage = readJson(STORAGE_PATH);
  const currentIds = storage.currentIds || (storage.currentIds = {});
  currentIds.currentCourseIds = currentIds.currentCourseIds || 1;

  // Filter out existing courses of the same program
  const prev = Array.isArray(storage.courses) ? storage.courses : [];
  const kept = prev.filter((c: any) => c && c.program !== program);

  // Assign new ids
  for (const c of newCourses) {
    c.id = currentIds.currentCourseIds++;
  }

  storage.courses = [...kept, ...newCourses];
  storage.currentIds.currentCourseIds = currentIds.currentCourseIds;

  writeJson(STORAGE_PATH, storage);
  console.log(`Imported ${newCourses.length} ${program} courses. Total now: ${storage.courses.length}`);
}

main();
