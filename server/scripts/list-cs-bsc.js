// Print CS BSc curriculum per semester from server/data/curricula/cs_bsc.json
const fs = require('fs');
const path = require('path');

const jsonPath = path.join(process.cwd(), 'server', 'data', 'curricula', 'cs_bsc.json');
const raw = fs.readFileSync(jsonPath, 'utf8');
const data = JSON.parse(raw);

const bySem = {};
for (const c of data.courses) {
  const s = (typeof c.semester === 'number') ? c.semester : 'Unassigned';
  (bySem[s] || (bySem[s] = [])).push(c);
}

const order = Object.keys(bySem).sort((a,b)=> (a==='Unassigned')?1:(b==='Unassigned')?-1:(Number(a)-Number(b)));
for (const k of order) {
  const arr = bySem[k];
  const req = arr.filter(x => x.required);
  const comp = arr.filter(x => x.compulsoryElective);
  const ele = arr.filter(x => x.elective && !x.compulsoryElective);
  console.log(`\nSemester ${k}:`);
  if (req.length) {
    console.log('  Required:');
    for (const r of req) console.log(`    - ${r.code} ${r.title} (${r.credits} cr)`);
  }
  if (comp.length) {
    console.log('  Compulsory electives:');
    for (const r of comp) console.log(`    - ${r.code} ${r.title} (${r.credits} cr)`);
  }
  if (ele.length) {
    console.log('  Electives:');
    for (const r of ele) console.log(`    - ${r.code} ${r.title} (${r.credits} cr)`);
  }
}
