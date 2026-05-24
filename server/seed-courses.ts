import sql from 'mssql';
import dotenv from 'dotenv';
import path from 'path';

// Load env vars
dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), 'server', '.env') });

// Sample course curriculum data for different programs
const COURSE_DATA = {
  'AI MSc': [
    { code: 'AI501', title: 'Machine Learning Fundamentals', credits: 3, semester: 1, required: true },
    { code: 'AI502', title: 'Deep Learning', credits: 3, semester: 1, required: true },
    { code: 'AI503', title: 'Natural Language Processing', credits: 3, semester: 1, required: false, elective: true },
    { code: 'AI504', title: 'Computer Vision', credits: 3, semester: 2, required: false, elective: true },
    { code: 'AI505', title: 'Reinforcement Learning', credits: 3, semester: 2, required: false, elective: true },
    { code: 'AI506', title: 'AI Ethics & Safety', credits: 2, semester: 2, required: true },
    { code: 'THESIS', title: 'Master Thesis', credits: 6, semester: 3, required: true },
  ],
  'CS BSc': [
    { code: 'CS101', title: 'Introduction to Programming', credits: 3, semester: 1, required: true },
    { code: 'CS102', title: 'Data Structures', credits: 3, semester: 1, required: true },
    { code: 'CS103', title: 'Web Development', credits: 3, semester: 2, required: false, elective: true },
    { code: 'CS104', title: 'Databases', credits: 3, semester: 2, required: true },
    { code: 'CS105', title: 'Operating Systems', credits: 3, semester: 3, required: true },
    { code: 'CS106', title: 'Software Engineering', credits: 3, semester: 3, required: false, elective: true },
    { code: 'CS107', title: 'Cybersecurity Basics', credits: 3, semester: 4, required: false, elective: true },
  ],
  'Data Science MSc': [
    { code: 'DS501', title: 'Statistics & Probability', credits: 3, semester: 1, required: true },
    { code: 'DS502', title: 'Data Mining', credits: 3, semester: 1, required: true },
    { code: 'DS503', title: 'Big Data Technologies', credits: 3, semester: 1, required: false, elective: true },
    { code: 'DS504', title: 'Data Visualization', credits: 3, semester: 2, required: false, elective: true },
    { code: 'DS505', title: 'Advanced Analytics', credits: 3, semester: 2, required: true },
    { code: 'DS506', title: 'Capstone Project', credits: 6, semester: 3, required: true },
  ],
  'Engineering BSc': [
    { code: 'ENG101', title: 'Calculus I', credits: 4, semester: 1, required: true },
    { code: 'ENG102', title: 'Physics I', credits: 4, semester: 1, required: true },
    { code: 'ENG103', title: 'Circuit Theory', credits: 3, semester: 2, required: true },
    { code: 'ENG104', title: 'Mechanics', credits: 3, semester: 2, required: true },
    { code: 'ENG105', title: 'Materials Science', credits: 3, semester: 3, required: false, elective: true },
    { code: 'ENG106', title: 'Control Systems', credits: 3, semester: 3, required: false, elective: true },
  ],
  'Cybersecurity MSc': [
    { code: 'CS601', title: 'Cryptography Fundamentals', credits: 3, semester: 1, required: true },
    { code: 'CS602', title: 'Network Security', credits: 3, semester: 1, required: true },
    { code: 'CS603', title: 'Penetration Testing', credits: 3, semester: 2, required: false, elective: true },
    { code: 'CS604', title: 'Malware Analysis', credits: 3, semester: 2, required: false, elective: true },
    { code: 'CS605', title: 'Cloud Security', credits: 3, semester: 2, required: true },
    { code: 'CS606', title: 'Security Operations', credits: 3, semester: 3, required: false, elective: true },
    { code: 'THESIS', title: 'Master Thesis', credits: 6, semester: 3, required: true },
  ],
};

// Prerequisites mapping (courseCode -> list of prerequisite courseCodes)
const PREREQUISITES: Record<string, string[]> = {
  'AI502': ['AI501'], // Deep Learning requires Machine Learning Fundamentals
  'AI503': ['AI501'], // NLP requires Machine Learning
  'CS104': ['CS102'], // Databases requires Data Structures
  'CS105': ['CS101'], // OS requires Programming
  'DS505': ['DS502'], // Advanced Analytics requires Data Mining
  'CS603': ['CS601'], // Penetration Testing requires Cryptography
  'CS604': ['CS601'], // Malware Analysis requires Cryptography
};

async function seedCourses() {
  const connStr = process.env.AZURE_SQL_CONNECTION_STRING;
  if (!connStr) throw new Error('AZURE_SQL_CONNECTION_STRING is not set');

  const pool = new sql.ConnectionPool(connStr);
  await pool.connect();
  
  try {
    console.log('🌱 Starting course seeding...');
    
    // Track course IDs for prerequisites
    const courseIdMap: Record<string, number> = {};
    
    // Seed courses for each program
    for (const [program, courses] of Object.entries(COURSE_DATA)) {
      console.log(`\n📚 Seeding courses for ${program}...`);
      
      for (const course of courses) {
        try {
          const request = pool.request();
          const result = await request
            .input('code', course.code)
            .input('title', course.title)
            .input('program', program)
            .input('credits', course.credits)
            .input('semester', course.semester || null)
            .input('required', course.required ? 1 : 0)
            .input('elective', course.elective ? 1 : 0)
            .query(`
              INSERT INTO courses (code, title, program, credits, semester, required, elective)
              VALUES (@code, @title, @program, @credits, @semester, @required, @elective)
            `);
          
          // Get the inserted ID
          const idResult = await pool.request()
            .input('code', course.code)
            .query('SELECT id FROM courses WHERE code = @code ORDER BY id DESC');
          
          const courseId = idResult.recordset[0]?.id;
          if (courseId) {
            courseIdMap[`${program}_${course.code}`] = courseId;
          }
          console.log(`  ✓ Created ${course.code} (${course.credits} credits)`);
        } catch (error: any) {
          // If course already exists, just fetch its ID
          if (error.message?.includes('UNIQUE') || error.message?.includes('unique') || error.message?.includes('violation')) {
            const result = await pool.request()
              .input('code', course.code)
              .query('SELECT id FROM courses WHERE code = @code');
            
            if (result.recordset.length > 0) {
              courseIdMap[`${program}_${course.code}`] = result.recordset[0].id;
              console.log(`  ℹ Course ${course.code} already exists`);
            }
          } else {
            console.error(`  ✗ Error creating ${course.code}:`, error.message);
          }
        }
      }
    }
    
    // Seed prerequisites
    console.log('\n\n🔗 Seeding course prerequisites...');
    for (const [courseCode, prereqs] of Object.entries(PREREQUISITES)) {
      try {
        // Find the course ID
        const courseResult = await pool.request()
          .input('code', courseCode)
          .query('SELECT id FROM courses WHERE code = @code');
        
        if (courseResult.recordset.length === 0) {
          console.log(`  ⚠ Course ${courseCode} not found, skipping prerequisites`);
          continue;
        }
        
        const courseId = courseResult.recordset[0].id;
        
        for (const prereqCode of prereqs) {
          try {
            const prereqResult = await pool.request()
              .input('code', prereqCode)
              .query('SELECT id FROM courses WHERE code = @code');
            
            if (prereqResult.recordset.length === 0) {
              console.log(`  ⚠ Prerequisite course ${prereqCode} not found`);
              continue;
            }
            
            const prereqId = prereqResult.recordset[0].id;
            
            await pool.request()
              .input('courseId', courseId)
              .input('prereqCourseId', prereqId)
              .query(`
                IF NOT EXISTS (SELECT 1 FROM course_prerequisites WHERE course_id = @courseId AND prereq_course_id = @prereqCourseId)
                  INSERT INTO course_prerequisites (course_id, prereq_course_id)
                  VALUES (@courseId, @prereqCourseId)
              `);
            
            console.log(`  ✓ Set ${prereqCode} as prerequisite for ${courseCode}`);
          } catch (error) {
            console.error(`  ✗ Error setting prerequisite:`, error);
          }
        }
      } catch (error) {
        console.error(`  ✗ Error processing prerequisites for ${courseCode}:`, error);
      }
    }
    
    console.log('\n✅ Course seeding completed!');
  } catch (error) {
    console.error('❌ Error during course seeding:', error);
    throw error;
  } finally {
    await pool.close();
  }
}

// Run as main script
seedCourses()
  .then(() => {
    console.log('\n🎉 All done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });

export { seedCourses };
