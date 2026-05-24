import sql from 'mssql';
import { getSqlPool } from './db/sql';
import type {
  InsertUser, User,
  InsertDocument, Document,
  InsertLocation, Location,
  InsertMessage, Message,
  InsertNotification, Notification,
  InsertEvent, Event,
  InsertContact, Contact,
  InsertCourse, Course,
  InsertCoursePrerequisite, CoursePrerequisite,
  InsertUserCompletedCourse, UserCompletedCourse,
} from '@shared/schema';
  User,
  Document,
  Message,
  Notification,
  Location,
  Event,
  Course,
  UserProfile,
  UserCompletedCourse,
  insertDocumentSchema,
  insertMessageSchema,
  insertNotificationSchema,
  insertLocationSchema,
  insertEventSchema,
  insertUserProfileSchema,
  insertUserCompletedCourseSchema
} from '../shared/schema.ts';
    const pool = await getSqlPool();
    const r = await pool.request()
      .input('username', sql.NVarChar, insertUser.username)
      .input('password', sql.NVarChar, insertUser.password)
      .input('full_name', sql.NVarChar, insertUser.fullName)
      .input('language', sql.NVarChar, insertUser.language ?? 'en')
      .query(`INSERT INTO users (username, password, full_name, language)
              OUTPUT INSERTED.id, INSERTED.username, INSERTED.password, INSERTED.full_name AS fullName, INSERTED.language
              VALUES (@username, @password, @full_name, @language);`);
    return r.recordset[0] as any;
  }

  async updateUserLanguage(userId: number, language: string): Promise<User | undefined> {
    const pool = await getSqlPool();
    const r = await pool.request()
      .input('id', sql.Int, userId)
      .input('language', sql.NVarChar, language)
      .query(`UPDATE users SET language=@language WHERE id=@id;
              SELECT id, username, password, full_name AS fullName, language FROM users WHERE id=@id;`);
    return r.recordset[0] as any;
  }

  async updateUserPassword(userId: number, hashedPassword: string): Promise<User | undefined> {
    const pool = await getSqlPool();
    const r = await pool.request()
      .input('id', sql.Int, userId)
      .input('password', sql.NVarChar, hashedPassword)
      .query(`UPDATE users SET password=@password WHERE id=@id;
              SELECT id, username, password, full_name AS fullName, language FROM users WHERE id=@id;`);
    return r.recordset[0] as any;
  }

  async getDocuments(userId: number): Promise<Document[]> {
    const pool = await getSqlPool();
    const r = await pool.request().input('uid', sql.Int, userId)
      .query(`SELECT id, user_id AS userId, title, description, filename, file_content AS fileContent, file_type AS fileType, status, deadline, created_at AS createdAt
              FROM documents WHERE user_id=@uid ORDER BY created_at DESC`);
    return r.recordset as any;
  }

  async getDocument(id: number): Promise<Document | undefined> {
    const pool = await getSqlPool();
    const r = await pool.request().input('id', sql.Int, id)
      .query(`SELECT id, user_id AS userId, title, description, filename, file_content AS fileContent, file_type AS fileType, status, deadline, created_at AS createdAt
              FROM documents WHERE id=@id`);
    return r.recordset[0] as any;
  }

  async createDocument(insertDocument: InsertDocument): Promise<Document> {
    const pool = await getSqlPool();
    const r = await pool.request()
      .input('user_id', sql.Int, insertDocument.userId)
      .input('title', sql.NVarChar, insertDocument.title)
      .input('description', sql.NVarChar, insertDocument.description ?? null)
      .input('filename', sql.NVarChar, insertDocument.filename)
      .input('file_content', sql.NVarChar, insertDocument.fileContent)
      .input('file_type', sql.NVarChar, insertDocument.fileType)
      .input('status', sql.NVarChar, insertDocument.status)
      .input('deadline', sql.Date, (insertDocument as any).deadline ?? null)
      .query(`INSERT INTO documents (user_id, title, description, filename, file_content, file_type, status, deadline)
              OUTPUT INSERTED.id, INSERTED.user_id AS userId, INSERTED.title, INSERTED.description, INSERTED.filename, INSERTED.file_content AS fileContent, INSERTED.file_type AS fileType, INSERTED.status, INSERTED.deadline, INSERTED.created_at AS createdAt
              VALUES (@user_id, @title, @description, @filename, @file_content, @file_type, @status, @deadline);`);
    return r.recordset[0] as any;
  }

  async updateDocumentStatus(id: number, status: string): Promise<Document | undefined> {
    const pool = await getSqlPool();
    const r = await pool.request().input('id', sql.Int, id).input('status', sql.NVarChar, status)
      .query(`UPDATE documents SET status=@status WHERE id=@id;
              SELECT id, user_id AS userId, title, description, filename, file_content AS fileContent, file_type AS fileType, status, deadline, created_at AS createdAt
              FROM documents WHERE id=@id;`);
    return r.recordset[0] as any;
  }

  async updateDocument(id: number, patch: Partial<InsertDocument>): Promise<Document | undefined> {
    const pool = await getSqlPool();
    // Build dynamic update set based on provided fields
    const fields: string[] = [];
    const req = pool.request().input('id', sql.Int, id);
    if (patch.title !== undefined) { fields.push('title=@title'); req.input('title', sql.NVarChar, patch.title); }
    if ((patch as any).description !== undefined) { fields.push('description=@description'); req.input('description', sql.NVarChar, (patch as any).description ?? null); }
    if (patch.filename !== undefined) { fields.push('filename=@filename'); req.input('filename', sql.NVarChar, patch.filename); }
    if (patch.fileContent !== undefined) { fields.push('file_content=@file_content'); req.input('file_content', sql.NVarChar, patch.fileContent); }
    if (patch.fileType !== undefined) { fields.push('file_type=@file_type'); req.input('file_type', sql.NVarChar, patch.fileType); }
    if (patch.status !== undefined) { fields.push('status=@status'); req.input('status', sql.NVarChar, patch.status); }
    if ((patch as any).deadline !== undefined) { fields.push('deadline=@deadline'); req.input('deadline', sql.Date, (patch as any).deadline ?? null); }
    if (!fields.length) {
      // Nothing to update; just return current row
      const cur = await pool.request().input('id', sql.Int, id).query(`SELECT id, user_id AS userId, title, description, filename, file_content AS fileContent, file_type AS fileType, status, deadline, created_at AS createdAt FROM documents WHERE id=@id`);
      return cur.recordset[0] as any;
    }
    const setClause = fields.join(', ');
    const q = `UPDATE documents SET ${setClause} WHERE id=@id;
      SELECT id, user_id AS userId, title, description, filename, file_content AS fileContent, file_type AS fileType, status, deadline, created_at AS createdAt FROM documents WHERE id=@id;`;
    const r = await (req as any).query(q);
    return r.recordset[0] as any;
  }

  // Location operations
  async getLocations(): Promise<Location[]> {
    const pool = await getSqlPool();
    const r = await pool.request().query(`
      SELECT id, name, description, building, floor, room_number AS roomNumber, hours, coordinates, location_type AS locationType
      FROM locations`);
    return r.recordset.map((row: any) => ({
      ...row,
      coordinates: safeJsonParse(row.coordinates, row.coordinates),
    }));
  }

  async getLocation(id: number): Promise<Location | undefined> {
    const pool = await getSqlPool();
    const r = await pool.request().input('id', sql.Int, id).query(`
      SELECT id, name, description, building, floor, room_number AS roomNumber, hours, coordinates, location_type AS locationType
      FROM locations WHERE id=@id`);
    const row = r.recordset[0];
    if (!row) return undefined as any;
    return { ...row, coordinates: safeJsonParse(row.coordinates, row.coordinates) } as any;
  }

  async searchLocations(query: string): Promise<Location[]> {
    const pool = await getSqlPool();
    const like = `%${query.toLowerCase()}%`;
    const r = await pool.request()
      .input('q', sql.NVarChar, like)
      .query(`
        SELECT id, name, description, building, floor, room_number AS roomNumber, hours, coordinates, location_type AS locationType
        FROM locations
        WHERE LOWER(name) LIKE @q OR LOWER(description) LIKE @q OR LOWER(building) LIKE @q OR LOWER(room_number) LIKE @q`);
    return r.recordset.map((row: any) => ({ ...row, coordinates: safeJsonParse(row.coordinates, row.coordinates) }));
  }

  async createLocation(insertLocation: InsertLocation): Promise<Location> {
    const pool = await getSqlPool();
    const r = await pool.request()
      .input('name', sql.NVarChar, insertLocation.name)
      .input('description', sql.NVarChar, insertLocation.description ?? null)
      .input('building', sql.NVarChar, insertLocation.building ?? null)
      .input('floor', sql.NVarChar, insertLocation.floor ?? null)
      .input('room_number', sql.NVarChar, insertLocation.roomNumber ?? null)
      .input('hours', sql.NVarChar, insertLocation.hours ?? null)
      .input('coordinates', sql.NVarChar, JSON.stringify(insertLocation.coordinates))
      .input('location_type', sql.NVarChar, insertLocation.locationType)
      .query(`INSERT INTO locations (name, description, building, floor, room_number, hours, coordinates, location_type)
              OUTPUT INSERTED.id, INSERTED.name, INSERTED.description, INSERTED.building, INSERTED.floor, INSERTED.room_number AS roomNumber, INSERTED.hours, INSERTED.coordinates, INSERTED.location_type AS locationType
              VALUES (@name, @description, @building, @floor, @room_number, @hours, @coordinates, @location_type);`);
    const row = r.recordset[0];
    return { ...row, coordinates: safeJsonParse(row.coordinates, row.coordinates) } as any;
  }

  // Message operations
  async getMessages(userId: number): Promise<Message[]> {
    const pool = await getSqlPool();
    const r = await pool.request().input('uid', sql.Int, userId).query(`
      SELECT id, user_id AS userId, content, is_user_message AS isUserMessage, sources, timestamp
      FROM messages WHERE user_id=@uid ORDER BY timestamp ASC`);
    return r.recordset.map((row: any) => ({ ...row, sources: safeJsonParse(row.sources, []) }));
  }

  async createMessage(insertMessage: InsertMessage): Promise<Message> {
    const pool = await getSqlPool();
    const r = await pool.request()
      .input('user_id', sql.Int, insertMessage.userId)
      .input('content', sql.NVarChar, insertMessage.content)
      .input('is_user_message', sql.Bit, insertMessage.isUserMessage ? 1 : 0)
      .input('sources', sql.NVarChar, insertMessage.sources ? JSON.stringify(insertMessage.sources) : null)
      .query(`INSERT INTO messages (user_id, content, is_user_message, sources)
              OUTPUT INSERTED.id, INSERTED.user_id AS userId, INSERTED.content, INSERTED.is_user_message AS isUserMessage, INSERTED.sources, INSERTED.timestamp
              VALUES (@user_id, @content, @is_user_message, @sources);`);
    const row = r.recordset[0];
    return { ...row, sources: safeJsonParse(row.sources, []) } as any;
  }

  // Notification operations
  async getNotifications(userId: number): Promise<Notification[]> {
    const pool = await getSqlPool();
    const r = await pool.request().input('uid', sql.Int, userId).query(`
      SELECT id, user_id AS userId, title, description, type, is_read AS [read], date, related_item_id AS relatedItemId, related_item_type AS relatedItemType
      FROM notifications WHERE user_id=@uid ORDER BY date DESC`);
    return r.recordset as any;
  }

  async getUnreadNotificationsCount(userId: number): Promise<number> {
    const pool = await getSqlPool();
    const r = await pool.request().input('uid', sql.Int, userId).query(`
      SELECT COUNT(*) AS cnt FROM notifications WHERE user_id=@uid AND is_read=0`);
    return (r.recordset[0]?.cnt as number) ?? 0;
  }

  async createNotification(n: InsertNotification): Promise<Notification> {
    const pool = await getSqlPool();
    const r = await pool.request()
      .input('user_id', sql.Int, n.userId)
      .input('title', sql.NVarChar, n.title)
      .input('description', sql.NVarChar, n.description)
      .input('type', sql.NVarChar, n.type)
      .input('is_read', sql.Bit, n.read ? 1 : 0)
      .input('related_item_id', sql.Int, n.relatedItemId ?? null)
      .input('related_item_type', sql.NVarChar, n.relatedItemType ?? null)
      .query(`INSERT INTO notifications (user_id, title, description, type, is_read, related_item_id, related_item_type)
              OUTPUT INSERTED.id, INSERTED.user_id AS userId, INSERTED.title, INSERTED.description, INSERTED.type, INSERTED.is_read AS [read], INSERTED.date, INSERTED.related_item_id AS relatedItemId, INSERTED.related_item_type AS relatedItemType
              VALUES (@user_id, @title, @description, @type, @is_read, @related_item_id, @related_item_type);`);
    return r.recordset[0] as any;
  }

  async markNotificationAsRead(id: number): Promise<Notification | undefined> {
    const pool = await getSqlPool();
    const r = await pool.request().input('id', sql.Int, id).query(`
      UPDATE notifications SET is_read=1 WHERE id=@id;
      SELECT id, user_id AS userId, title, description, type, is_read AS [read], date, related_item_id AS relatedItemId, related_item_type AS relatedItemType FROM notifications WHERE id=@id;`);
    return r.recordset[0] as any;
  }

  async markAllNotificationsAsRead(userId: number): Promise<void> {
    const pool = await getSqlPool();
    await pool.request().input('uid', sql.Int, userId).query(`UPDATE notifications SET is_read=1 WHERE user_id=@uid AND is_read=0`);
  }

  // Event operations
  async getEvents(): Promise<Event[]> {
    const pool = await getSqlPool();
    const r = await pool.request().query(`SELECT id, title, description, location, location_id AS locationId, datetime FROM events ORDER BY datetime ASC`);
    return r.recordset as any;
  }

  async getEvent(id: number): Promise<Event | undefined> {
    const pool = await getSqlPool();
    const r = await pool.request().input('id', sql.Int, id).query(`SELECT id, title, description, location, location_id AS locationId, datetime FROM events WHERE id=@id`);
    return r.recordset[0] as any;
  }

  async createEvent(e: InsertEvent): Promise<Event> {
    const pool = await getSqlPool();
    const r = await pool.request()
      .input('title', sql.NVarChar, e.title)
      .input('description', sql.NVarChar, e.description)
      .input('location', sql.NVarChar, e.location)
      .input('location_id', sql.Int, (e as any).locationId ?? null)
      .input('datetime', sql.DateTime2, e.datetime)
      .query(`INSERT INTO events (title, description, location, location_id, datetime)
              OUTPUT INSERTED.id, INSERTED.title, INSERTED.description, INSERTED.location, INSERTED.location_id AS locationId, INSERTED.datetime
              VALUES (@title, @description, @location, @location_id, @datetime);`);
    return r.recordset[0] as any;
  }

  // Contact operations
  async getContacts(): Promise<Contact[]> {
    const pool = await getSqlPool();
    const r = await pool.request().query(`
      SELECT id, name, department, role, email, phone, office, office_hours AS officeHours, tags, location_id AS locationId
      FROM contacts`);
    return r.recordset.map((row: any) => ({ ...row, tags: safeJsonParse(row.tags, []) }));
  }

  async getContact(id: number): Promise<Contact | undefined> {
    const pool = await getSqlPool();
    const r = await pool.request().input('id', sql.Int, id).query(`
      SELECT id, name, department, role, email, phone, office, office_hours AS officeHours, tags, location_id AS locationId
      FROM contacts WHERE id=@id`);
    const row = r.recordset[0];
    if (!row) return undefined as any;
    return { ...row, tags: safeJsonParse(row.tags, []) } as any;
  }

  async searchContacts(query: string): Promise<Contact[]> {
    const pool = await getSqlPool();
    const like = `%${query.toLowerCase()}%`;
    const r = await pool.request().input('q', sql.NVarChar, like).query(`
      SELECT id, name, department, role, email, phone, office, office_hours AS officeHours, tags, location_id AS locationId
      FROM contacts
      WHERE LOWER(name) LIKE @q OR LOWER(department) LIKE @q OR LOWER(role) LIKE @q OR LOWER(email) LIKE @q OR LOWER(phone) LIKE @q OR LOWER(office) LIKE @q OR LOWER(office_hours) LIKE @q`);
    return r.recordset.map((row: any) => ({ ...row, tags: safeJsonParse(row.tags, []) }));
  }

  async createContact(c: InsertContact): Promise<Contact> {
    const pool = await getSqlPool();
    const r = await pool.request()
      .input('name', sql.NVarChar, c.name)
      .input('department', sql.NVarChar, c.department)
      .input('role', sql.NVarChar, c.role)
      .input('email', sql.NVarChar, c.email)
      .input('phone', sql.NVarChar, c.phone ?? null)
      .input('office', sql.NVarChar, c.office ?? null)
      .input('office_hours', sql.NVarChar, c.officeHours ?? null)
      .input('tags', sql.NVarChar, c.tags ? JSON.stringify(c.tags) : null)
      .input('location_id', sql.Int, (c as any).locationId ?? null)
      .query(`INSERT INTO contacts (name, department, role, email, phone, office, office_hours, tags, location_id)
              OUTPUT INSERTED.id, INSERTED.name, INSERTED.department, INSERTED.role, INSERTED.email, INSERTED.phone, INSERTED.office, INSERTED.office_hours AS officeHours, INSERTED.tags, INSERTED.location_id AS locationId
              VALUES (@name, @department, @role, @email, @phone, @office, @office_hours, @tags, @location_id);`);
    const row = r.recordset[0];
    return { ...row, tags: safeJsonParse(row.tags, []) } as any;
  }

  // Course operations
  async getCourses(program?: string): Promise<Course[]> {
    const pool = await getSqlPool();
    if (program) {
      const r = await pool.request().input('program', sql.NVarChar, program).query(`
        SELECT id, code, title, program, credits, semester, required, elective FROM courses WHERE program=@program`);
      return r.recordset as any;
    }
    const r = await pool.request().query(`SELECT id, code, title, program, credits, semester, required, elective FROM courses`);
    return r.recordset as any;
  }

  async getCourse(id: number): Promise<Course | undefined> {
    const pool = await getSqlPool();
    const r = await pool.request().input('id', sql.Int, id).query(`SELECT id, code, title, program, credits, semester, required, elective FROM courses WHERE id=@id`);
    return r.recordset[0] as any;
  }

  async createCourse(c: InsertCourse): Promise<Course> {
    const pool = await getSqlPool();
    const r = await pool.request()
      .input('code', sql.NVarChar, c.code)
      .input('title', sql.NVarChar, c.title)
      .input('program', sql.NVarChar, c.program)
      .input('credits', sql.Int, c.credits)
      .input('semester', sql.Int, (c as any).semester ?? null)
      .input('required', sql.Bit, c.required ? 1 : 0)
      .input('elective', sql.Bit, c.elective ? 1 : 0)
      .query(`INSERT INTO courses (code, title, program, credits, semester, required, elective)
              OUTPUT INSERTED.id, INSERTED.code, INSERTED.title, INSERTED.program, INSERTED.credits, INSERTED.semester, INSERTED.required, INSERTED.elective
              VALUES (@code, @title, @program, @credits, @semester, @required, @elective);`);
    return r.recordset[0] as any;
  }

  async getCoursePrereqs(courseId: number): Promise<CoursePrerequisite[]> {
    const pool = await getSqlPool();
    const r = await pool.request().input('cid', sql.Int, courseId).query(`SELECT id, course_id AS courseId, prereq_course_id AS prereqCourseId FROM course_prerequisites WHERE course_id=@cid`);
    return r.recordset as any;
  }

  async createCoursePrereq(pr: InsertCoursePrerequisite): Promise<CoursePrerequisite> {
    const pool = await getSqlPool();
    const r = await pool.request().input('course_id', sql.Int, pr.courseId).input('prereq_course_id', sql.Int, pr.prereqCourseId).query(`
      INSERT INTO course_prerequisites (course_id, prereq_course_id)
      OUTPUT INSERTED.id, INSERTED.course_id AS courseId, INSERTED.prereq_course_id AS prereqCourseId
      VALUES (@course_id, @prereq_course_id);`);
    return r.recordset[0] as any;
  }

  async getUserCompletedCourses(userId: number): Promise<UserCompletedCourse[]> {
    const pool = await getSqlPool();
    const r = await pool.request().input('uid', sql.Int, userId).query(`
      SELECT id, user_id AS userId, course_id AS courseId, term, grade FROM user_completed_courses WHERE user_id=@uid`);
    return r.recordset as any;
  }

  async createUserCompletedCourse(uc: InsertUserCompletedCourse): Promise<UserCompletedCourse> {
    const pool = await getSqlPool();
    const r = await pool.request()
      .input('user_id', sql.Int, uc.userId)
      .input('course_id', sql.Int, uc.courseId)
      .input('term', sql.NVarChar, uc.term ?? null)
      .input('grade', sql.NVarChar, uc.grade ?? null)
      .query(`INSERT INTO user_completed_courses (user_id, course_id, term, grade)
              OUTPUT INSERTED.id, INSERTED.user_id AS userId, INSERTED.course_id AS courseId, INSERTED.term, INSERTED.grade
              VALUES (@user_id, @course_id, @term, @grade);`);
    return r.recordset[0] as any;
  }

  // Student profile persistence
  async getUserProfile(userId: number): Promise<any | undefined> {
    const pool = await getSqlPool();
    const r = await pool.request().input('uid', sql.Int, userId).query(`
      SELECT id, user_id AS userId, program, current_semester AS currentSemester, curriculum FROM student_profiles WHERE user_id=@uid`);
    const row = r.recordset[0];
    if (!row) return undefined;
    return { ...row, curriculum: safeJsonParse(row.curriculum, row.curriculum) } as any;
  }

  async setUserProfile(userId: number, profile: { program: string; currentSemester?: number; curriculum?: any }): Promise<any> {
    const pool = await getSqlPool();
    const rec = await pool.request()
      .input('user_id', sql.Int, userId)
      .input('program', sql.NVarChar, profile.program)
      .input('current_semester', sql.Int, profile.currentSemester ?? null)
      .input('curriculum', sql.NVarChar, profile.curriculum ? JSON.stringify(profile.curriculum) : null)
      .query(`
        IF EXISTS (SELECT 1 FROM student_profiles WHERE user_id=@user_id)
          UPDATE student_profiles SET program=@program, current_semester=@current_semester, curriculum=@curriculum WHERE user_id=@user_id;
        ELSE
          INSERT INTO student_profiles (user_id, program, current_semester, curriculum) VALUES (@user_id, @program, @current_semester, @curriculum);
        SELECT id, user_id AS userId, program, current_semester AS currentSemester, curriculum FROM student_profiles WHERE user_id=@user_id;
      `);
    const row = rec.recordset[0];
    return { ...row, curriculum: safeJsonParse(row.curriculum, row.curriculum) } as any;
  }
}

export const sqlStorage = new SqlStorage();

// Helpers
function safeJsonParse<T>(s: any, fallback: T): T {
  if (s == null) return fallback;
  try {
    if (typeof s === 'string') return JSON.parse(s);
    return s as T;
  } catch {
    return fallback;
  }
}
