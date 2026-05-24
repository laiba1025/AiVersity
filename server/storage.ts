import fs from 'fs';
import path from 'path';

import {
  users, type User, type InsertUser,
  documents, type Document, type InsertDocument,
  locations, type Location, type InsertLocation,
  messages, type Message, type InsertMessage,
  notifications, type Notification, type InsertNotification,
  events, type Event, type InsertEvent,
  contacts, type Contact, type InsertContact,
  courses, type Course, type InsertCourse,
  coursePrerequisites, type CoursePrerequisite, type InsertCoursePrerequisite,
  userCompletedCourses, type UserCompletedCourse, type InsertUserCompletedCourse
} from "@shared/schema";

export interface IStorage {
  // Location operations
  getLocations(): Promise<Location[]>;
  getLocation(id: number): Promise<Location | undefined>;
  searchLocations(query: string): Promise<Location[]>;
  createLocation(location: InsertLocation): Promise<Location>;

  // Message operations
  getMessages(userId: number): Promise<Message[]>;
  createMessage(message: InsertMessage): Promise<Message>;

  // Notification operations
  getNotifications(userId: number): Promise<Notification[]>;
  getUnreadNotificationsCount(userId: number): Promise<number>;
  createNotification(notification: InsertNotification): Promise<Notification>;
  markNotificationAsRead(id: number): Promise<Notification | undefined>;
  markAllNotificationsAsRead(userId: number): Promise<void>;
  
  // Event operations
  getEvents(): Promise<Event[]>;
  getEvent(id: number): Promise<Event | undefined>;
  createEvent(event: InsertEvent): Promise<Event>;

  // Contact operations
  getContacts(): Promise<Contact[]>;
  getContact(id: number): Promise<Contact | undefined>;
  searchContacts(query: string): Promise<Contact[]>;
  createContact(contact: InsertContact): Promise<Contact>;

  // Course operations
  getCourses(program?: string): Promise<Course[]>;
  getCourse(id: number): Promise<Course | undefined>;
  createCourse(course: InsertCourse): Promise<Course>;
  getCoursePrereqs(courseId: number): Promise<CoursePrerequisite[]>;
  createCoursePrereq(pr: InsertCoursePrerequisite): Promise<CoursePrerequisite>;
  getUserCompletedCourses(userId: number): Promise<UserCompletedCourse[]>;
  createUserCompletedCourse(uc: InsertUserCompletedCourse): Promise<UserCompletedCourse>;
  deleteUserCompletedCourse(userId: number, courseId: number): Promise<boolean>;

  // Student profile (simple in-memory profile for demo)
  getUserProfile(userId: number): Promise<any | undefined>;
  setUserProfile(userId: number, profile: any): Promise<any>;
}

// Toggle SQL storage via env flag or automatically enable when an Azure SQL connection string exists
const USE_SQL_ENV = (process.env.USE_SQL_STORAGE || '').toLowerCase() === 'true';
const AZURE_SQL_CONN = !!process.env.AZURE_SQL_CONNECTION_STRING;
const USE_SQL = USE_SQL_ENV || AZURE_SQL_CONN;
let SqlStorageImpl: any = null;
if (USE_SQL) {
  try {
    // Dynamically import to avoid requiring mssql types in non-SQL builds
    SqlStorageImpl = (await import('./storage-sql')).sqlStorage;
  } catch (e) {
    console.warn('SQL storage requested but could not load storage-sql:', e);
  }
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private documents: Map<number, Document>;
  private locations: Map<number, Location>;
  private messages: Map<number, Message>;
  private notifications: Map<number, Notification>;
  private events: Map<number, Event>;
  private contacts: Map<number, Contact>;
  private courses: Map<number, Course>;
  private coursePrereqs: Map<number, CoursePrerequisite>;
  private userCompleted: Map<number, UserCompletedCourse>;
  private userProfiles: Map<number, any>;

  private currentUserIds: number;
  private currentDocumentIds: number;
  private currentLocationIds: number;
  private currentMessageIds: number;
  private currentNotificationIds: number;
  private currentEventIds: number;
  private currentContactIds: number;
  private currentCourseIds: number;
  private currentCoursePrereqIds: number;
  private currentUserCompletedIds: number;

  constructor() {
    this.users = new Map();
    this.documents = new Map();
    this.locations = new Map();
    this.messages = new Map();
    this.notifications = new Map();
    this.events = new Map();
  this.contacts = new Map();
  this.courses = new Map();
  this.coursePrereqs = new Map();
  this.userCompleted = new Map();
  this.userProfiles = new Map();

    this.currentUserIds = 1;
    this.currentDocumentIds = 1;
    this.currentLocationIds = 1;
    this.currentMessageIds = 1;
    this.currentNotificationIds = 1;
    this.currentEventIds = 1;
  this.currentContactIds = 1;
  this.currentCourseIds = 1;
  this.currentCoursePrereqIds = 1;
  this.currentUserCompletedIds = 1;
    // If a snapshot exists, load it. Otherwise seed initial data and persist.
    try {
      const snapshotPath = path.resolve(process.cwd(), 'server', 'storage-data.json');
      if (fs.existsSync(snapshotPath)) {
        const raw = fs.readFileSync(snapshotPath, 'utf8');
        const obj = JSON.parse(raw);
        this.loadSnapshot(obj);
      } else {
        // Add seed data and save snapshot
        this.seedData();
        try { this.saveSnapshotSync(); } catch (e) { /* non-fatal */ }
      }
    } catch (e) {
      // If loading fails, fall back to seeded data
      console.warn('Failed to load storage snapshot, using seeded in-memory data:', e);
      this.seedData();
    }
  }

  private snapshotFilePath(): string {
    return path.resolve(process.cwd(), 'server', 'storage-data.json');
  }

  private saveSnapshotSync() {
    const obj: any = {
      users: Array.from(this.users.values()),
      documents: Array.from(this.documents.values()),
      locations: Array.from(this.locations.values()),
      messages: Array.from(this.messages.values()),
      notifications: Array.from(this.notifications.values()),
      events: Array.from(this.events.values()),
      contacts: Array.from(this.contacts.values()),
      courses: Array.from(this.courses.values()),
      coursePrereqs: Array.from(this.coursePrereqs.values()),
      userCompleted: Array.from(this.userCompleted.values()),
      userProfiles: Array.from(this.userProfiles.entries()),
      currentIds: {
        currentUserIds: this.currentUserIds,
        currentDocumentIds: this.currentDocumentIds,
        currentLocationIds: this.currentLocationIds,
        currentMessageIds: this.currentMessageIds,
        currentNotificationIds: this.currentNotificationIds,
        currentEventIds: this.currentEventIds,
        currentContactIds: this.currentContactIds,
        currentCourseIds: this.currentCourseIds,
        currentCoursePrereqIds: this.currentCoursePrereqIds,
        currentUserCompletedIds: this.currentUserCompletedIds,
      }
    };
    try {
      fs.writeFileSync(this.snapshotFilePath(), JSON.stringify(obj, null, 2), 'utf8');
    } catch (e) {
      console.warn('Failed to write storage snapshot:', e);
    }
  }

  private loadSnapshot(obj: any) {
    // Load primitive arrays back into maps
    this.users = new Map((obj.users || []).map((u: any) => [u.id, u]));
    this.documents = new Map((obj.documents || []).map((d: any) => [d.id, { ...d, createdAt: d.createdAt ? new Date(d.createdAt) : new Date() }]));
    this.locations = new Map((obj.locations || []).map((l: any) => [l.id, l]));
    this.messages = new Map((obj.messages || []).map((m: any) => [m.id, { ...m, timestamp: m.timestamp ? new Date(m.timestamp) : new Date(), sources: m.sources || [] }]));
    this.notifications = new Map((obj.notifications || []).map((n: any) => [n.id, { ...n, date: n.date ? new Date(n.date) : new Date() }]));
    this.events = new Map((obj.events || []).map((e: any) => [e.id, { ...e, datetime: e.datetime ? new Date(e.datetime) : new Date() }]));
    this.contacts = new Map((obj.contacts || []).map((c: any) => [c.id, c]));
    this.courses = new Map((obj.courses || []).map((c: any) => [c.id, c]));
    this.coursePrereqs = new Map((obj.coursePrereqs || []).map((p: any) => [p.id, p]));
    this.userCompleted = new Map((obj.userCompleted || []).map((uc: any) => [uc.id, uc]));
    this.userProfiles = new Map((obj.userProfiles || []).map((entry: any[]) => [entry[0], entry[1]]));

    if (obj.currentIds) {
      this.currentUserIds = obj.currentIds.currentUserIds || 1;
      this.currentDocumentIds = obj.currentIds.currentDocumentIds || 1;
      this.currentLocationIds = obj.currentIds.currentLocationIds || 1;
      this.currentMessageIds = obj.currentIds.currentMessageIds || 1;
      this.currentNotificationIds = obj.currentIds.currentNotificationIds || 1;
      this.currentEventIds = obj.currentIds.currentEventIds || 1;
      this.currentContactIds = obj.currentIds.currentContactIds || 1;
      this.currentCourseIds = obj.currentIds.currentCourseIds || 1;
      this.currentCoursePrereqIds = obj.currentIds.currentCoursePrereqIds || 1;
      this.currentUserCompletedIds = obj.currentIds.currentUserCompletedIds || 1;
    }
  }

  // User operations
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.currentUserIds++;
    const user: User = { id, username: insertUser.username, password: insertUser.password, fullName: insertUser.fullName, language: insertUser.language ?? "en" };
    this.users.set(id, user);
    try { this.saveSnapshotSync(); } catch (e) { /* ignore */ }
    return user;
  }

  async updateUserLanguage(userId: number, language: string): Promise<User | undefined> {
    const user = await this.getUser(userId);
    if (!user) return undefined;

    const updatedUser = { ...user, language };
    this.users.set(userId, updatedUser);
    return updatedUser;
  }

  async updateUserPassword(userId: number, hashedPassword: string): Promise<User | undefined> {
    const user = await this.getUser(userId);
    if (!user) return undefined;
    const updatedUser = { ...user, password: hashedPassword };
    this.users.set(userId, updatedUser);
    try { this.saveSnapshotSync(); } catch (e) { /* ignore */ }
    return updatedUser;
  }

  // Document operations
  async getDocuments(userId: number): Promise<Document[]> {
    return Array.from(this.documents.values()).filter(
      (document) => document.userId === userId
    );
  }

  async getDocument(id: number): Promise<Document | undefined> {
    return this.documents.get(id);
  }

  async createDocument(insertDocument: InsertDocument): Promise<Document> {
    const id = this.currentDocumentIds++;
    const now = new Date();
    const document: Document = {
      id,
      userId: insertDocument.userId,
      title: insertDocument.title,
      description: insertDocument.description ?? null,
      filename: insertDocument.filename,
      fileContent: insertDocument.fileContent,
      fileType: insertDocument.fileType,
      status: insertDocument.status,
      deadline: (insertDocument.deadline as any) ?? null,
      createdAt: now,
    };
    this.documents.set(id, document);
    try { this.saveSnapshotSync(); } catch (e) { /* ignore */ }
    return document;
  }

  async updateDocumentStatus(id: number, status: string): Promise<Document | undefined> {
    const document = await this.getDocument(id);
    if (!document) return undefined;

    const updatedDocument = { ...document, status };
    this.documents.set(id, updatedDocument);
    try { this.saveSnapshotSync(); } catch (e) { /* ignore */ }
    return updatedDocument;
  }

  async updateDocument(id: number, patch: Partial<InsertDocument>): Promise<Document | undefined> {
    const existing = await this.getDocument(id);
    if (!existing) return undefined;
    const merged: Document = {
      ...existing,
      title: patch.title ?? existing.title,
      description: (patch as any).description ?? existing.description,
      filename: patch.filename ?? existing.filename,
      fileContent: patch.fileContent ?? existing.fileContent,
      fileType: patch.fileType ?? existing.fileType,
      status: patch.status ?? existing.status,
      deadline: (patch as any).deadline !== undefined ? (patch as any).deadline : existing.deadline,
    } as any;
    this.documents.set(id, merged);
    try { this.saveSnapshotSync(); } catch (e) { /* ignore */ }
    return merged;
  }

  // Location operations
  async getLocations(): Promise<Location[]> {
    return Array.from(this.locations.values());
  }

  async getLocation(id: number): Promise<Location | undefined> {
    return this.locations.get(id);
  }

  async searchLocations(query: string): Promise<Location[]> {
    const lowercaseQuery = query.toLowerCase();
    return Array.from(this.locations.values()).filter(
      (location) => 
        location.name.toLowerCase().includes(lowercaseQuery) ||
        (location.description && location.description.toLowerCase().includes(lowercaseQuery)) ||
        (location.building && location.building.toLowerCase().includes(lowercaseQuery)) ||
        (location.roomNumber && location.roomNumber.toLowerCase().includes(lowercaseQuery))
    );
  }

  async createLocation(insertLocation: InsertLocation): Promise<Location> {
    const id = this.currentLocationIds++;
    const location: Location = {
      id,
      name: insertLocation.name,
      description: insertLocation.description ?? null,
      building: insertLocation.building ?? null,
      floor: insertLocation.floor ?? null,
      roomNumber: insertLocation.roomNumber ?? null,
      hours: insertLocation.hours ?? null,
      coordinates: insertLocation.coordinates as any,
      locationType: insertLocation.locationType,
    };
    this.locations.set(id, location);
    return location;
  }

  // Message operations
  async getMessages(userId: number): Promise<Message[]> {
    return Array.from(this.messages.values())
      .filter((message) => message.userId === userId)
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  async createMessage(insertMessage: InsertMessage): Promise<Message> {
    const id = this.currentMessageIds++;
    const now = new Date();
    const message: Message = {
      ...insertMessage,
      id,
      timestamp: now,
      sources: insertMessage.sources ?? [] // ✅ default to empty array
    };
    this.messages.set(id, message);
    return message;
  }
  

  // Notification operations
  async getNotifications(userId: number): Promise<Notification[]> {
    return Array.from(this.notifications.values())
      .filter((notification) => notification.userId === userId)
      .sort((a, b) => b.date.getTime() - a.date.getTime());
  }

  async getUnreadNotificationsCount(userId: number): Promise<number> {
    return Array.from(this.notifications.values()).filter(
      (notification) => notification.userId === userId && !notification.read
    ).length;
  }

  async createNotification(insertNotification: InsertNotification): Promise<Notification> {
    const id = this.currentNotificationIds++;
    const now = new Date();
    const notification: Notification = {
      id,
      userId: insertNotification.userId,
      title: insertNotification.title,
      description: insertNotification.description,
      type: insertNotification.type,
      read: insertNotification.read ?? false,
      date: now,
      relatedItemId: insertNotification.relatedItemId ?? null,
      relatedItemType: insertNotification.relatedItemType ?? null,
    };
    this.notifications.set(id, notification);
    return notification;
  }

  async markNotificationAsRead(id: number): Promise<Notification | undefined> {
    const notification = this.notifications.get(id);
    if (!notification) return undefined;

    const updatedNotification = { ...notification, read: true };
    this.notifications.set(id, updatedNotification);
    return updatedNotification;
  }

  async markAllNotificationsAsRead(userId: number): Promise<void> {
    const userNotifications = Array.from(this.notifications.values()).filter(
      (notification) => notification.userId === userId
    );

    for (const notification of userNotifications) {
      this.notifications.set(notification.id, { ...notification, read: true });
    }
  }

  // Event operations
  async getEvents(): Promise<Event[]> {
    return Array.from(this.events.values())
      .sort((a, b) => a.datetime.getTime() - b.datetime.getTime());
  }

  async getEvent(id: number): Promise<Event | undefined> {
    return this.events.get(id);
  }

  async createEvent(insertEvent: InsertEvent): Promise<Event> {
    const id = this.currentEventIds++;
    const event: Event = {
      id,
      title: insertEvent.title,
      description: insertEvent.description,
      location: insertEvent.location,
      locationId: (insertEvent.locationId as any) ?? null,
      datetime: insertEvent.datetime,
    };
    this.events.set(id, event);
    return event;
  }

  // Course operations
  async getCourses(program?: string): Promise<Course[]> {
    const all = Array.from(this.courses.values());
    if (!program) return all;
    const norm = program.trim().toLowerCase();
    return all.filter(c => ((c.program || '') as string).toString().trim().toLowerCase() === norm);
  }

  async getCourse(id: number): Promise<Course | undefined> {
    return this.courses.get(id);
  }

  async createCourse(insertCourse: InsertCourse): Promise<Course> {
    const id = this.currentCourseIds++;
    const course: Course = {
      id,
      code: insertCourse.code,
      title: insertCourse.title,
      program: insertCourse.program,
      credits: insertCourse.credits,
      semester: insertCourse.semester ?? null,
      required: insertCourse.required ?? false,
      elective: insertCourse.elective ?? false,
    };
    this.courses.set(id, course);
    return course;
  }

  async getCoursePrereqs(courseId: number): Promise<CoursePrerequisite[]> {
    return Array.from(this.coursePrereqs.values()).filter(pr => pr.courseId === courseId);
  }

  async createCoursePrereq(pr: InsertCoursePrerequisite): Promise<CoursePrerequisite> {
    const id = this.currentCoursePrereqIds++;
    const rec: CoursePrerequisite = { ...pr, id };
    this.coursePrereqs.set(id, rec);
    return rec;
  }

  async getUserCompletedCourses(userId: number): Promise<UserCompletedCourse[]> {
    return Array.from(this.userCompleted.values()).filter(uc => uc.userId === userId);
  }

  async createUserCompletedCourse(uc: InsertUserCompletedCourse): Promise<UserCompletedCourse> {
    const id = this.currentUserCompletedIds++;
    const rec: UserCompletedCourse = {
      id,
      userId: uc.userId,
      courseId: uc.courseId,
      term: uc.term ?? null,
      grade: uc.grade ?? null,
    };
    this.userCompleted.set(id, rec);
    try { this.saveSnapshotSync(); } catch (e) { /* ignore */ }
    return rec;
  }

  async deleteUserCompletedCourse(userId: number, courseId: number): Promise<boolean> {
    for (const [id, rec] of this.userCompleted.entries()) {
      if (rec.userId === userId && rec.courseId === courseId) {
        this.userCompleted.delete(id);
        try { this.saveSnapshotSync(); } catch (e) { /* ignore */ }
        return true;
      }
    }
    return false;
  }

  // Simple profile operations
  async getUserProfile(userId: number): Promise<any | undefined> {
    return this.userProfiles.get(userId);
  }

  async setUserProfile(userId: number, profile: any): Promise<any> {
    const rec = { ...profile, userId };
    this.userProfiles.set(userId, rec);
    try { this.saveSnapshotSync(); } catch (e) { /* ignore */ }
    return rec;
  }

  // Contact operations
  async getContacts(): Promise<Contact[]> {
    return Array.from(this.contacts.values());
  }

  async getContact(id: number): Promise<Contact | undefined> {
    return this.contacts.get(id);
  }

  async searchContacts(query: string): Promise<Contact[]> {
    const q = query.toLowerCase();
    return Array.from(this.contacts.values()).filter((c) =>
      c.name.toLowerCase().includes(q) ||
      c.department.toLowerCase().includes(q) ||
      c.role.toLowerCase().includes(q) ||
      (c.email && c.email.toLowerCase().includes(q)) ||
      (c.phone && c.phone.toLowerCase().includes(q)) ||
      (c.office && c.office.toLowerCase().includes(q)) ||
      (c.officeHours && c.officeHours.toLowerCase().includes(q)) ||
      (Array.isArray(c.tags) && c.tags.some((t: string) => t.toLowerCase().includes(q)))
    );
  }

  async createContact(insertContact: InsertContact): Promise<Contact> {
    const id = this.currentContactIds++;
    const contact: Contact = {
      id,
      name: insertContact.name,
      department: insertContact.department,
      role: insertContact.role,
      email: insertContact.email,
      phone: insertContact.phone ?? null,
      office: insertContact.office ?? null,
      officeHours: insertContact.officeHours ?? null,
      tags: insertContact.tags as any,
      locationId: (insertContact.locationId as any) ?? null,
    };
    this.contacts.set(id, contact);
    return contact;
  }

  // Seed initial data for testing
  private seedData() {
    // Create a test user
    const user: User = {
      id: this.currentUserIds++,
      username: "maria",
      password: "password123",
      fullName: "Maria Smith",
      language: "en"
    };
    this.users.set(user.id, user);

    // Create locations
    const locations: InsertLocation[] = [
      {
        name: "Main Building",
        description: "Main university administrative building",
        building: "A",
        floor: "All floors",
        roomNumber: null,
        hours: "Mon-Fri, 8:00 AM - 6:00 PM",
        coordinates: { lat: 47.492647, lng: 19.051399 },
        locationType: "building"
      },
      {
        name: "International Office",
        description: "Office for international student services",
        building: "C",
        floor: "2nd Floor",
        roomNumber: "Room 203",
        hours: "Mon-Fri, 9:00 AM - 4:00 PM",
        coordinates: { lat: 47.493647, lng: 19.052399 },
        locationType: "office"
      },
      {
        name: "Dormitory",
        description: "Student housing facility",
        building: "D",
        floor: "All floors",
        roomNumber: null,
        hours: "24/7",
        coordinates: { lat: 47.494647, lng: 19.053399 },
        locationType: "dormitory"
      },
      {
        name: "Main Auditorium",
        description: "Large lecture hall for events",
        building: "A",
        floor: "Ground Floor",
        roomNumber: "A001",
        hours: "Mon-Fri, 8:00 AM - 8:00 PM",
        coordinates: { lat: 47.492847, lng: 19.051599 },
        locationType: "lecture_hall"
      }
    ];

    for (const location of locations) {
      const id = this.currentLocationIds++;
      const loc: Location = {
        id,
        name: location.name,
        description: location.description ?? null,
        building: location.building ?? null,
        floor: location.floor ?? null,
        roomNumber: location.roomNumber ?? null,
        hours: location.hours ?? null,
        coordinates: location.coordinates as any,
        locationType: location.locationType,
      };
      this.locations.set(id, loc);
    }

    // Create events
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(14, 0, 0, 0);

    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    nextWeek.setHours(10, 0, 0, 0);

    const events: InsertEvent[] = [
      {
        title: "International Student Orientation",
        description: "Welcome event for all new international students",
        location: "Main Auditorium, Building A",
        locationId: 4,
        datetime: tomorrow
      },
      {
        title: "Residence Permit Workshop",
        description: "Workshop on how to apply for and renew residence permits",
        location: "International Office, Building C",
        locationId: 2,
        datetime: nextWeek
      }
    ];

    for (const event of events) {
      const id = this.currentEventIds++;
      const ev: Event = {
        id,
        title: event.title,
        description: event.description,
        location: event.location,
        locationId: (event.locationId as any) ?? null,
        datetime: event.datetime,
      };
      this.events.set(id, ev);
    }

    // Create documents
    const documents: InsertDocument[] = [
      {
        userId: user.id,
        title: "Passport Copy",
        description: "Valid passport first page with photo",
        filename: "passport.pdf",
        fileContent: "base64_encoded_content", // Simulated base64
        fileType: "application/pdf",
        status: "completed",
        deadline: null
      },
      {
        userId: user.id,
        title: "Acceptance Letter",
        description: "Official university acceptance letter",
        filename: "acceptance_letter.pdf",
        fileContent: "base64_encoded_content", // Simulated base64
        fileType: "application/pdf",
        status: "completed",
        deadline: null
      },
      {
        userId: user.id,
        title: "Health Insurance",
        description: "Valid international health insurance",
        filename: "health_insurance.pdf",
        fileContent: "base64_encoded_content", // Simulated base64
        fileType: "application/pdf",
        status: "completed",
        deadline: null
      },
      {
        userId: user.id,
        title: "Housing Contract",
        description: "Signed dormitory or rental contract",
        filename: "",
        fileContent: "",
        fileType: "",
        status: "pending",
        deadline: null
      },
      {
        userId: user.id,
        title: "Financial Statement",
        description: "Bank statement or scholarship proof",
        filename: "",
        fileContent: "",
        fileType: "",
        status: "required",
        deadline: "2023-09-25" // Sep 25, 2023
      },
      {
        userId: user.id,
        title: "Certificate of Enrollment",
        description: "Proof of current university enrollment",
        filename: "",
        fileContent: "",
        fileType: "",
        status: "required",
        deadline: "2023-09-15" // Sep 15, 2023
      },
      {
        userId: user.id,
        title: "Passport Photo",
        description: "Biometric passport-sized photograph",
        filename: "",
        fileContent: "",
        fileType: "",
        status: "required",
        deadline: "2023-09-25" // Sep 25, 2023
      }
    ];

    for (const document of documents) {
      const id = this.currentDocumentIds++;
      const now = new Date();
      const doc: Document = {
        id,
        userId: document.userId,
        title: document.title,
        description: document.description ?? null,
        filename: document.filename,
        fileContent: document.fileContent,
        fileType: document.fileType,
        status: document.status,
        deadline: (document.deadline as any) ?? null,
        createdAt: now,
      };
      this.documents.set(id, doc);
    }

    // Create chat messages
    const messages: InsertMessage[] = [
      {
        userId: user.id,
        content: "Hi Maria! I'm your university assistant. How can I help you today?",
        isUserMessage: false
      },
      {
        userId: user.id,
        content: "Hi! Where can I find the International Office?",
        isUserMessage: true
      },
      {
        userId: user.id,
        content: "The International Office is located in Building C, 2nd floor, Room 203. Office hours are Monday to Friday, 9:00 AM to 4:00 PM.",
        isUserMessage: false,
        sources: ["Campus Map Guide", "Student Handbook, Section 2.1"]
      },
      {
        userId: user.id,
        content: "What documents do I need for visa renewal?",
        isUserMessage: true
      },
      {
        userId: user.id,
        content: "For visa renewal, you need: Valid passport, Current residence permit, Proof of enrollment, Proof of accommodation, Proof of financial means, Health insurance.",
        isUserMessage: false,
        sources: ["Visa FAQ Document", "Hungarian Immigration Website"]
      }
    ];

    let prevTime = new Date();
    prevTime.setMinutes(prevTime.getMinutes() - messages.length * 2);

    for (const message of messages) {
      const id = this.currentMessageIds++;
      const timestamp = new Date(prevTime);
      this.messages.set(id, { ...message, id, timestamp, sources: message.sources ?? [] });
      prevTime.setMinutes(prevTime.getMinutes() + 2);
    }


    // Create notifications
    const notifications: InsertNotification[] = [
      {
        userId: user.id,
        title: "Visa Renewal Deadline",
        description: "Your student visa expires in 3 days. Submit renewal documents before September 15.",
        type: "deadline",
        read: false,
        relatedItemId: null,
        relatedItemType: null
      },
      {
        userId: user.id,
        title: "Orientation Reminder",
        description: "International Student Orientation is tomorrow at 14:00 in the Main Auditorium.",
        type: "event",
        read: false,
        relatedItemId: 1,
        relatedItemType: "event"
      },
      {
        userId: user.id,
        title: "Document Approved",
        description: "Your health insurance document has been verified and approved.",
        type: "document",
        read: true,
        relatedItemId: 3,
        relatedItemType: "document"
      },
      {
        userId: user.id,
        title: "Housing Payment",
        description: "Your dormitory payment for October is due by September 20.",
        type: "info",
        read: true,
        relatedItemId: null,
        relatedItemType: null
      },
      {
        userId: user.id,
        title: "Course Registration",
        description: "Course registration for the Fall semester is now open.",
        type: "info",
        read: true,
        relatedItemId: null,
        relatedItemType: null
      }
    ];

    let notifTime = new Date();
    for (const notification of notifications) {
      const id = this.currentNotificationIds++;
      const n: Notification = {
        id,
        userId: notification.userId,
        title: notification.title,
        description: notification.description,
        type: notification.type,
        read: notification.read ?? false,
        date: new Date(notifTime),
        relatedItemId: notification.relatedItemId ?? null,
        relatedItemType: notification.relatedItemType ?? null,
      };
      this.notifications.set(id, n);
      notifTime.setHours(notifTime.getHours() - 2);
    }

    // Seed contacts (faculty and administration)
    const contacts: InsertContact[] = [
      {
        name: "Dr. Anna Kovacs",
        department: "Computer Science",
        role: "Associate Professor",
        email: "anna.kovacs@university.hu",
        phone: "+36 1 234 5678",
        office: "Building B, Room 312",
        officeHours: "Tue 10:00-12:00, Thu 14:00-16:00",
        tags: ["algorithms", "advising", "thesis"],
        locationId: 1
      },
      {
        name: "Peter Szabo",
        department: "International Office",
        role: "Student Services Coordinator",
        email: "peter.szabo@university.hu",
        phone: "+36 1 555 1122",
        office: "Building C, 2nd Floor, Room 203",
        officeHours: "Mon-Fri 09:00-16:00",
        tags: ["visa", "residence permit", "documents", "scholarship"],
        locationId: 2
      },
      {
        name: "Dr. Eva Nagy",
        department: "Mathematics",
        role: "Lecturer",
        email: "eva.nagy@university.hu",
        phone: "+36 1 987 6543",
        office: "Building A, Room 120",
        officeHours: "Wed 13:00-15:00",
        tags: ["calculus", "linear algebra"],
        locationId: 1
      }
    ];

    for (const c of contacts) {
      const id = this.currentContactIds++;
      this.contacts.set(id, {
        id,
        name: c.name,
        department: c.department,
        role: c.role,
        email: c.email,
        phone: c.phone ?? null,
        office: c.office ?? null,
        officeHours: c.officeHours ?? null,
        tags: c.tags as any,
        locationId: (c.locationId as any) ?? null,
      });
    }

    // Seed courses (AI MSc example)
  const aiCourses: any[] = [
      { code: "IPM-22fmiDAAE", title: "Design and Analysis of Algorithms", program: "AI MSc", credits: 4, semester: 2, required: true, elective: false },
      { code: "IPM-22fmiMLEG", title: "Machine Learning", program: "AI MSc", credits: 6, semester: 2, required: true, elective: false },
      { code: "IPM-22fmiDRLEG", title: "Deep Reinforcement Learning", program: "AI MSc", credits: 6, semester: 3, required: false, elective: true, compulsoryElective: true },
      { code: "IPM-22fmiRME", title: "Research Methodology", program: "AI MSc", credits: 5, semester: 1, required: true, elective: false },
      { code: "IPM-22fmiTAEG", title: "Topics in Applied Mathematics", program: "AI MSc", credits: 5, semester: 1, required: true, elective: false },
      { code: "IPM-22fmiDL", title: "Deep Learning", program: "AI MSc", credits: 6, semester: 3, required: false, elective: true, compulsoryElective: false },
    ];
    // Seed CS BSc curriculum for testing (semesters 1..6)
  const csCourses: any[] = [
      { code: 'CS-101-ALG', title: 'Intro to Algorithms', program: 'CS BSc', credits: 5, semester: 1, required: true, elective: false },
      { code: 'CS-101-PROG', title: 'Programming I', program: 'CS BSc', credits: 5, semester: 1, required: true, elective: false },
      { code: 'CS-102-DATA', title: 'Data Structures', program: 'CS BSc', credits: 6, semester: 2, required: true, elective: false },
      { code: 'CS-102-MATH', title: 'Discrete Mathematics', program: 'CS BSc', credits: 4, semester: 2, required: true, elective: false },
      { code: 'CS-201-DB', title: 'Databases', program: 'CS BSc', credits: 5, semester: 3, required: true, elective: false },
      { code: 'CS-201-OS', title: 'Operating Systems', program: 'CS BSc', credits: 6, semester: 3, required: true, elective: false },
      { code: 'CS-202-NET', title: 'Computer Networks', program: 'CS BSc', credits: 5, semester: 4, required: true, elective: false },
      { code: 'CS-202-SEC', title: 'Cybersecurity Fundamentals', program: 'CS BSc', credits: 4, semester: 4, required: false, elective: true, compulsoryElective: true },
      { code: 'CS-301-AI', title: 'Introduction to AI', program: 'CS BSc', credits: 5, semester: 5, required: false, elective: true, compulsoryElective: false },
      { code: 'CS-301-ML', title: 'Machine Learning Basics', program: 'CS BSc', credits: 6, semester: 5, required: false, elective: true, compulsoryElective: false },
      { code: 'CS-302-SOFT', title: 'Software Engineering', program: 'CS BSc', credits: 6, semester: 6, required: true, elective: false },
      { code: 'CS-302-PROJ', title: 'Capstone Project', program: 'CS BSc', credits: 10, semester: 6, required: true, elective: false },
    ];
      // Additional MSc programs (4-semester masters)
      const mscDataScience: any[] = [
        { code: 'DS-101-PROG', title: 'Scientific Programming', program: 'MSc Data Science', credits: 5, semester: 1, required: true, elective: false },
        { code: 'DS-101-STATS', title: 'Statistical Methods', program: 'MSc Data Science', credits: 5, semester: 1, required: true, elective: false },
        { code: 'DS-201-ML', title: 'Machine Learning for Data Science', program: 'MSc Data Science', credits: 6, semester: 2, required: true, elective: false },
        { code: 'DS-202-DM', title: 'Data Mining', program: 'MSc Data Science', credits: 5, semester: 2, required: false, elective: true, compulsoryElective: true },
        { code: 'DS-301-NLP', title: 'NLP Techniques', program: 'MSc Data Science', credits: 5, semester: 3, required: false, elective: true, compulsoryElective: false },
        { code: 'DS-302-PROJ', title: 'Data Science Project', program: 'MSc Data Science', credits: 10, semester: 4, required: true, elective: false },
      ];

      const mscDigitalFactory: any[] = [
        { code: 'DF-101-IOT', title: 'IoT Systems', program: 'MSc Digital Factory', credits: 5, semester: 1, required: true, elective: false },
        { code: 'DF-101-AUTO', title: 'Automation Basics', program: 'MSc Digital Factory', credits: 5, semester: 1, required: true, elective: false },
        { code: 'DF-201-PLANT', title: 'Plant Engineering', program: 'MSc Digital Factory', credits: 6, semester: 2, required: true, elective: false },
        { code: 'DF-202-DIG', title: 'Digital Twins', program: 'MSc Digital Factory', credits: 5, semester: 2, required: false, elective: true, compulsoryElective: true },
        { code: 'DF-301-ROB', title: 'Industrial Robotics', program: 'MSc Digital Factory', credits: 5, semester: 3, required: false, elective: true, compulsoryElective: false },
        { code: 'DF-302-PROJ', title: 'Factory Integration Project', program: 'MSc Digital Factory', credits: 10, semester: 4, required: true, elective: false },
      ];

      const mscSoftwareArch: any[] = [
        { code: 'SA-101-ARCH', title: 'Software Architecture Principles', program: 'MSc Software Architecture', credits: 5, semester: 1, required: true, elective: false },
        { code: 'SA-101-MODELS', title: 'Model-driven Engineering', program: 'MSc Software Architecture', credits: 5, semester: 1, required: true, elective: false },
        { code: 'SA-201-DIST', title: 'Distributed Systems', program: 'MSc Software Architecture', credits: 6, semester: 2, required: true, elective: false },
        { code: 'SA-202-CLOUD', title: 'Cloud Native Design', program: 'MSc Software Architecture', credits: 5, semester: 2, required: false, elective: true, compulsoryElective: true },
        { code: 'SA-301-SCAL', title: 'Scalable Systems', program: 'MSc Software Architecture', credits: 5, semester: 3, required: false, elective: true, compulsoryElective: false },
        { code: 'SA-302-PROJ', title: 'Architecture Capstone', program: 'MSc Software Architecture', credits: 10, semester: 4, required: true, elective: false },
      ];

      const mscCyber: any[] = [
        { code: 'CY-101-FOUND', title: 'Cybersecurity Foundations', program: 'MSc Cybersecurity', credits: 5, semester: 1, required: true, elective: false },
        { code: 'CY-101-NETSEC', title: 'Network Security', program: 'MSc Cybersecurity', credits: 5, semester: 1, required: true, elective: false },
        { code: 'CY-201-CRYPTO', title: 'Cryptography', program: 'MSc Cybersecurity', credits: 6, semester: 2, required: true, elective: false },
        { code: 'CY-202-FORENS', title: 'Digital Forensics', program: 'MSc Cybersecurity', credits: 5, semester: 2, required: false, elective: true, compulsoryElective: true },
        { code: 'CY-301-ADV', title: 'Advanced Security Topics', program: 'MSc Cybersecurity', credits: 5, semester: 3, required: false, elective: true, compulsoryElective: false },
        { code: 'CY-302-PROJ', title: 'Security Project', program: 'MSc Cybersecurity', credits: 10, semester: 4, required: true, elective: false },
      ];

      const mscAutonomous: any[] = [
        { code: 'AS-101-ROB', title: 'Robotics Foundations', program: 'MSc Autonomous Systems', credits: 5, semester: 1, required: true, elective: false },
        { code: 'AS-101-SIG', title: 'Signals and Systems', program: 'MSc Autonomous Systems', credits: 5, semester: 1, required: true, elective: false },
        { code: 'AS-201-AV', title: 'Autonomous Vehicles', program: 'MSc Autonomous Systems', credits: 6, semester: 2, required: true, elective: false },
        { code: 'AS-202-SENS', title: 'Sensor Fusion', program: 'MSc Autonomous Systems', credits: 5, semester: 2, required: false, elective: true, compulsoryElective: true },
        { code: 'AS-301-PLN', title: 'Motion Planning', program: 'MSc Autonomous Systems', credits: 5, semester: 3, required: false, elective: true, compulsoryElective: false },
        { code: 'AS-302-PROJ', title: 'Autonomy Project', program: 'MSc Autonomous Systems', credits: 10, semester: 4, required: true, elective: false },
      ];

  // Combine and insert all MSc program courses
  const otherMscs = [...mscDataScience, ...mscDigitalFactory, ...mscSoftwareArch, ...mscCyber, ...mscAutonomous];
  const courseIdByCode: Record<string, number> = {};
  for (const c of otherMscs) {
        const id = this.currentCourseIds++;
        const rec: any = {
          id,
          code: c.code,
          title: c.title,
          program: c.program,
          credits: c.credits,
          semester: c.semester ?? null,
          required: c.required ?? false,
          elective: c.elective ?? false,
        };
        rec.compulsoryElective = (c as any).compulsoryElective ?? false;
        this.courses.set(id, rec as Course);
        courseIdByCode[c.code] = id;
      }
  for (const c of aiCourses) {
      const id = this.currentCourseIds++;
      const rec: any = {
        id,
        code: c.code,
        title: c.title,
        program: c.program,
        credits: c.credits,
        semester: c.semester ?? null,
        required: c.required ?? false,
        elective: c.elective ?? false,
      };
      rec.compulsoryElective = (c as any).compulsoryElective ?? false;
      this.courses.set(id, rec as Course);
      courseIdByCode[c.code] = id;
    }

    // Add CS BSc courses
    for (const c of csCourses) {
      const id = this.currentCourseIds++;
      const rec: any = {
        id,
        code: c.code,
        title: c.title,
        program: c.program,
        credits: c.credits,
        semester: c.semester ?? null,
        required: c.required ?? false,
        elective: c.elective ?? false,
      };
      rec.compulsoryElective = (c as any).compulsoryElective ?? false;
      this.courses.set(id, rec as Course);
      courseIdByCode[c.code] = id;
    }

    const prereqs: Array<[string, string]> = [
      ["IPM-22fmiMLEG", "IPM-22fmiTAEG"], // ML requires Topics in Applied Math
      ["IPM-22fmiDAAE", "IPM-22fmiTAEG"], // Algorithms requires Topics in Applied Math
      ["IPM-22fmiDL", "IPM-22fmiMLEG"],   // Deep Learning requires ML
      ["IPM-22fmiDRLEG", "IPM-22fmiMLEG"], // DRL requires ML
    ];
    for (const [courseCode, prereqCode] of prereqs) {
      const courseId = courseIdByCode[courseCode];
      const prereqId = courseIdByCode[prereqCode];
      const id = this.currentCoursePrereqIds++;
      this.coursePrereqs.set(id, { id, courseId, prereqCourseId: prereqId });
    }

    // Seed completed courses for user id=1 (Maria)
    const mariaId = 1;
    const completedCodes = ["IPM-22fmiRME", "IPM-22fmiTAEG"]; // Research Methodology, Topics in Applied Math
    for (const cc of completedCodes) {
      const courseId = courseIdByCode[cc];
      const id = this.currentUserCompletedIds++;
      this.userCompleted.set(id, { id, userId: mariaId, courseId, term: "2024-fall", grade: "A" });
    }
  }
}

export const storage: IStorage = SqlStorageImpl ?? new MemStorage();
