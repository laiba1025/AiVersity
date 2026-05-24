import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage.ts";
import { WebSocketServer } from "ws";
import { z } from "zod";
import multer from "multer";
import {
  insertUserSchema,
  insertDocumentSchema,
  insertMessageSchema,
  insertNotificationSchema,
  insertLocationSchema,
  insertEventSchema
} from "../shared/schema.ts";
import { getChatResponse, getDocumentInfo, translateText, getRAGResponse, searchPoliciesGuides } from "./openai.ts";
import bcrypt from 'bcryptjs';
import { getSqlPool } from "./db/sql.ts";

// Simple password strength check: length >=8, includes letter & number
function isStrongPassword(pw: string): boolean {
  if (pw.length < 8) return false;
  const hasLetter = /[A-Za-z]/.test(pw);
  const hasNumber = /[0-9]/.test(pw);
  return hasLetter && hasNumber;
}

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);
  // Multer for handling multipart/form-data uploads (in-memory)
  const upload = multer();
  
  // Simple test endpoint
  app.get('/api/test', (req, res) => {
    res.json({ status: 'ok', message: 'Server is running correctly' });
  });
  
  // Set up WebSocket server for real-time notifications
  const wss = new WebSocketServer({ server: httpServer });
  const clients = new Map();

  wss.on("connection", (ws) => {
    const id = Math.random().toString(36).substring(2, 10);
    clients.set(id, ws);

    ws.on("message", async (message) => {
      try {
        const data = JSON.parse(message.toString());
        if (data.type === "authenticate" && data.userId) {
          clients.set(id, { ws, userId: data.userId });
        }
      } catch (error) {
        console.error("WebSocket message error:", error);
      }
    });

    ws.on("close", () => {
      clients.delete(id);
    });
  });

  // Helper function to send notifications to a specific user
  const notifyUser = (userId: number, data: any) => {
    for (const [_, client] of clients.entries()) {
      if (client.userId === userId) {
        client.ws.send(JSON.stringify(data));
      }
    }
  };

  // Auth routes
  app.post("/api/auth/login", async (req: Request, res: Response) => {
    try {
      // Accept either email or username; repo currently stores only username.
      // For email-based login, we treat the provided email as username.
      const { email, username: uname, password } = req.body || {};
      const username = (email ?? uname) as string;
      if (!username || typeof password !== 'string') {
        return res.status(400).send("Email/username and password are required");
      }

      const user = await storage.getUserByUsername(username);
      if (!user || !user.password) {
        return res.status(404).send("User is not registered");
      }

      // First try bcrypt compare (normal case when passwords are hashed).
      let passwordMatches = false;
      try {
        passwordMatches = await bcrypt.compare(password, user.password);
      } catch (e) {
        passwordMatches = false;
      }

      // Backwards-compatibility: if bcrypt compare failed, allow plaintext match for seeded/dev users.
      if (!passwordMatches) {
        if (password !== user.password) {
          return res.status(401).send("Incorrect password");
        }
      }

      // Store user in session
      req.session.userId = user.id;
      
      return res.status(200).json({
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        language: user.language
      });
    } catch (error) {
      console.error("Login error:", error);
      return res.status(500).send("An error occurred during login");
    }
  });

  app.post("/api/auth/logout", (req: Request, res: Response) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ message: "Failed to logout" });
      }
      res.status(200).json({ message: "Logged out successfully" });
    });
  });

  app.post("/api/auth/register", async (req: Request, res: Response) => {
    try {
      const validationResult = insertUserSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ message: "Invalid user data", errors: validationResult.error.errors });
      }

      const userData = validationResult.data;

      // Check if username already exists
      const existingUser = await storage.getUserByUsername(userData.username);
      if (existingUser) {
        return res.status(409).json({ message: "Username already exists" });
      }

      // Hash password before persisting so server-side storage never stores plaintext
      const hashed = await bcrypt.hash(userData.password, 10);
      const toCreate = { ...userData, password: hashed };

      const user = await storage.createUser(toCreate as any);
      
      // Store user in session
      req.session.userId = user.id;
      
      return res.status(201).json({
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        language: user.language
      });
    } catch (error) {
      console.error("Registration error:", error);
      return res.status(500).json({ message: "An error occurred during registration" });
    }
  });

  app.post("/api/auth/change-password", async (req: Request, res: Response) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    try {
      const { currentPassword, newPassword } = req.body || {};
      if (typeof currentPassword !== 'string' || typeof newPassword !== 'string') {
        return res.status(400).json({ message: "currentPassword and newPassword are required" });
      }
      if (!isStrongPassword(newPassword)) {
        return res.status(400).json({ message: "Password must be at least 8 chars and include letters and numbers" });
      }
      const user = await storage.getUser(req.session.userId);
      if (!user || !user.password) {
        return res.status(404).json({ message: "User not found" });
      }
      let matches = false;
      try { matches = await bcrypt.compare(currentPassword, user.password); } catch (e) { matches = false; }
      if (!matches) {
        // Allow plaintext fallback for legacy seeded users
        if (currentPassword !== user.password) {
          return res.status(401).json({ message: "Current password is incorrect" });
        }
      }
      if (currentPassword === newPassword) {
        return res.status(400).json({ message: "New password must differ from current password" });
      }
      const hashed = await bcrypt.hash(newPassword, 10);
      await storage.updateUserPassword(user.id, hashed);
      return res.status(200).json({ message: "Password updated" });
    } catch (e) {
      console.error("Change password error:", e);
      return res.status(500).json({ message: "Failed to change password" });
    }
  });

  // User routes
  app.get("/api/user", async (req: Request, res: Response) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    try {
      const user = await storage.getUser(req.session.userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      return res.status(200).json({
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        language: user.language
      });
    } catch (error) {
      console.error("Get user error:", error);
      return res.status(500).json({ message: "Failed to get user information" });
    }
  });

  app.patch("/api/user/language", async (req: Request, res: Response) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    try {
      const { language } = req.body;
      if (language !== "en" && language !== "hu") {
        return res.status(400).json({ message: "Invalid language (supported: en, hu)" });
      }

      const user = await storage.updateUserLanguage(req.session.userId, language);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      return res.status(200).json({
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        language: user.language
      });
    } catch (error) {
      console.error("Update language error:", error);
      return res.status(500).json({ message: "Failed to update language preference" });
    }
  });

  // Document routes
  // Mandatory document definitions (local storage only)
  const MANDATORY_DOCS: Array<{ key: string; title: string; description: string }> = [
    { key: 'passport', title: 'Passport', description: 'Official personal identification document.' },
    { key: 'residence_permit', title: 'Residence Permit', description: 'Permit authorizing stay for study purposes.' },
    { key: 'student_card', title: 'Student Card', description: 'University issued student identification card.' },
    { key: 'taj_card', title: 'TAJ Card', description: 'Hungarian health insurance (TAJ) card.' }
  ];

  // List mandatory documents status for the authenticated user
  app.get('/api/mandatory-docs', async (req: Request, res: Response) => {
    if (!req.session.userId) return res.status(401).json({ message: 'Not authenticated' });
    try {
      const docs = await storage.getDocuments(req.session.userId);
      const byType = new Map<string, any>();
      for (const d of docs) {
        // We map mandatory documents by filename prefix or status tags; here we use fileType OR normalized title keyword.
        const normalizedTitle = (d.title || '').toLowerCase();
        for (const mand of MANDATORY_DOCS) {
          if (normalizedTitle.includes(mand.key.replace('_', ' ')) || normalizedTitle.includes(mand.key)) {
            byType.set(mand.key, d);
          }
        }
        // Also allow explicit fileType match (e.g., custom client sets fileType = passport)
        const ft = (d.fileType || '').toLowerCase();
        if (MANDATORY_DOCS.some(m => m.key === ft)) {
          byType.set(ft, d);
        }
      }
      const result = MANDATORY_DOCS.map(m => {
        const found = byType.get(m.key);
        const hasInline = !!(found?.fileContent);
        const hasBlob = !hasInline && !!(found?.filename);
        return {
          key: m.key,
          title: m.title,
          description: m.description,
          uploaded: !!found,
          documentId: found?.id ?? null,
          filename: found?.filename ?? null,
          expiryDate: found?.deadline ?? null,
          status: found?.status ?? null,
          hasBlob,
          hasInline
        };
      });
      return res.status(200).json({ mandatory: result });
    } catch (e) {
      console.error('List mandatory docs error:', e);
      return res.status(500).json({ message: 'Failed to list mandatory documents' });
    }
  });
  // New: Upload a document file to Azure Blob Storage and create a record
  app.post("/api/documents/upload", upload.single("file"), async (req: Request, res: Response) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    try {
      const upFile = (req as any).file as { originalname: string; buffer: Buffer; mimetype?: string } | undefined;
      if (!upFile) {
        return res.status(400).json({ message: "Missing file" });
      }

      const [{ storageService }] = await Promise.all([
        import("./services/storage-service")
      ]);

      const originalName = upFile.originalname || "upload.bin";
      const buffer = upFile.buffer;
      const blobUrl = await storageService.uploadDocument(originalName, buffer);

      // Create a minimal document record in current storage (base64 fields unused)
      const document = await storage.createDocument({
        userId: (req.session as any).userId,
        title: originalName,
        description: `Uploaded to Blob Storage`,
        filename: originalName,
        fileContent: "", // kept for schema compatibility
        fileType: upFile.mimetype || "application/octet-stream",
        status: "pending",
        deadline: null,
      });

      return res.status(201).json({ ...document, blobUrl });
    } catch (error) {
      console.error("Upload error:", error);
      return res.status(500).json({ message: "Failed to upload document" });
    }
  });

  // Generate a short-lived SAS URL for a blob so it can be viewed/downloaded securely
  app.get("/api/documents/sas", async (req: Request, res: Response) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    try {
      const filename = (req.query.filename as string) || "";
      if (!filename) return res.status(400).json({ message: "filename is required" });

      const [{ storageService }] = await Promise.all([
        import("./services/storage-service"),
      ]);

      // Check existence to avoid BlobNotFound when opening the SAS URL
      const exists = await storageService.exists(filename);
      if (!exists) {
        return res.status(404).json({ message: "Blob not found for filename", filename });
      }

      const sasUrl = await storageService.generateSasUrl(filename, 20);
      return res.status(200).json({ sasUrl });
    } catch (error) {
      console.error("Generate SAS error:", error);
      return res.status(500).json({ message: "Failed to generate SAS URL" });
    }
  });

  app.get("/api/documents", async (req: Request, res: Response) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    try {
      const documents = await storage.getDocuments(req.session.userId);
      return res.status(200).json(documents);
    } catch (error) {
      console.error("Get documents error:", error);
      return res.status(500).json({ message: "Failed to get documents" });
    }
  });

  app.get("/api/documents/:id", async (req: Request, res: Response) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    try {
      const document = await storage.getDocument(parseInt(req.params.id));
      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }

      if (document.userId !== req.session.userId) {
        return res.status(403).json({ message: "Access denied" });
      }

      return res.status(200).json(document);
    } catch (error) {
      console.error("Get document error:", error);
      return res.status(500).json({ message: "Failed to get document" });
    }
  });

  app.post("/api/documents", async (req: Request, res: Response) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    try {
      const documentData = {
        ...req.body,
        userId: req.session.userId
      };
      // Normalize deadline to a plain YYYY-MM-DD string BEFORE validation.
      // Some clients may send a Date object (in memory) which serializes to ISO string, but in rare cases
      // middleware/tests can rehydrate it to a Date. We defensively coerce anything date-like.
      const rawDeadline: any = (documentData as any).deadline;
      if (rawDeadline) {
        // If it's a Date instance or has toISOString, convert
        if (rawDeadline instanceof Date || (typeof rawDeadline === 'object' && typeof rawDeadline.toISOString === 'function')) {
          try {
            (documentData as any).deadline = rawDeadline.toISOString().split('T')[0];
          } catch (_) {
            // fallback: remove invalid deadline so validation can catch missing value if mandatory
            delete (documentData as any).deadline;
          }
        } else if (typeof rawDeadline === 'string') {
          // Accept strings; if full ISO (contains 'T'), trim to date part
          if (/^\d{4}-\d{2}-\d{2}T/.test(rawDeadline)) {
            (documentData as any).deadline = rawDeadline.split('T')[0];
          }
          // If it's already YYYY-MM-DD, leave as-is
        } else {
          // Unknown type -> drop to avoid Zod type mismatch
          delete (documentData as any).deadline;
        }
      }
      // Debug log for deadline normalization (short output to avoid noise)
      try {
        console.log('[documents POST] deadline normalized =>', typeof (documentData as any).deadline, (documentData as any).deadline);
      } catch (_) {}
      
      const validationResult = insertDocumentSchema.safeParse(documentData);
      if (!validationResult.success) {
        return res.status(400).json({ message: "Invalid document data", errors: validationResult.error.errors });
      }

      // Enforce expiry (deadline) for mandatory documents & perform UPSERT instead of duplicate creation.
      const mandKeys = new Set(MANDATORY_DOCS.map(m => m.key));
      const titleLower = (validationResult.data.title || '').toLowerCase();
      const mandatoryKeyRaw = (req.body.mandatoryKey || '').toLowerCase().trim();
      let matchedKey: string | null = null;
      for (const k of mandKeys) {
        const kTitle = k.replace('_', ' ');
        if ((mandatoryKeyRaw && mandatoryKeyRaw === k) || titleLower.includes(k) || titleLower.includes(kTitle)) {
          matchedKey = k;
          break;
        }
      }
      const isMandatory = matchedKey !== null;
      if (isMandatory && !validationResult.data.deadline) {
        return res.status(400).json({ message: 'expiryDate is required for mandatory documents', mandatoryKeys: Array.from(mandKeys) });
      }

  let document: any;
      if (isMandatory && matchedKey) {
        // Attempt to find existing mandatory doc for this user with the SAME matched key
        const existingDocs = await storage.getDocuments(req.session.userId);
        const existing = existingDocs.find(d => {
          const t = (d.title || '').toLowerCase();
          const kTitle = matchedKey!.replace('_',' ');
          return t.includes(matchedKey!) || t.includes(kTitle);
        });
        if (existing) {
          document = await storage.updateDocument(existing.id, {
            title: validationResult.data.title,
            description: validationResult.data.description,
            filename: validationResult.data.filename,
            fileContent: validationResult.data.fileContent,
            fileType: validationResult.data.fileType,
            status: validationResult.data.status, // keep incoming status (e.g., required/completed)
            deadline: (validationResult.data as any).deadline,
            userId: existing.userId
          } as any);
        } else {
          document = await storage.createDocument(validationResult.data);
        }
      } else {
        document = await storage.createDocument(validationResult.data);
      }
      
      if (document) {
        // Create a notification for the uploaded document
        await storage.createNotification({
          userId: req.session.userId,
          title: "Document Uploaded",
          description: `You've successfully uploaded ${document.title}`,
          type: "document",
          read: false,
          relatedItemId: document.id,
          relatedItemType: "document"
        });
      }
      
      // Notify connected user
      notifyUser(req.session.userId, {
        type: "DOCUMENT_UPLOADED",
        document: document
      });

      return res.status(201).json(document);
    } catch (error) {
      console.error("Create document error:", error);
      return res.status(500).json({ message: "Failed to create document" });
    }
  });

  app.patch("/api/documents/:id/status", async (req: Request, res: Response) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    try {
      const { status } = req.body;
      if (!status || !["completed", "pending", "required"].includes(status)) {
        return res.status(400).json({ message: "Invalid status" });
      }

      const document = await storage.getDocument(parseInt(req.params.id));
      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }

      if (document.userId !== req.session.userId) {
        return res.status(403).json({ message: "Access denied" });
      }

      const updatedDocument = await storage.updateDocumentStatus(document.id, status);
      return res.status(200).json(updatedDocument);
    } catch (error) {
      console.error("Update document status error:", error);
      return res.status(500).json({ message: "Failed to update document status" });
    }
  });

  app.get("/api/documents/:id/info", async (req: Request, res: Response) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    try {
      const document = await storage.getDocument(parseInt(req.params.id));
      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }

      const info = await getDocumentInfo(document.title);
      return res.status(200).json({ info });
    } catch (error) {
      console.error("Get document info error:", error);
      return res.status(500).json({ message: "Failed to get document information" });
    }
  });

  // Location routes
  app.get("/api/locations", async (req: Request, res: Response) => {
    try {
      const locations = await storage.getLocations();
      return res.status(200).json(locations);
    } catch (error) {
      console.error("Get locations error:", error);
      return res.status(500).json({ message: "Failed to get locations" });
    }
  });

  // Contact routes
  app.get("/api/contacts", async (_req: Request, res: Response) => {
    try {
      const contacts = await storage.getContacts();
      return res.status(200).json(contacts);
    } catch (error) {
      console.error("Get contacts error:", error);
      return res.status(500).json({ message: "Failed to get contacts" });
    }
  });

  app.get("/api/contacts/:id", async (req: Request, res: Response) => {
    try {
      const contact = await storage.getContact(parseInt(req.params.id));
      if (!contact) return res.status(404).json({ message: "Contact not found" });
      return res.status(200).json(contact);
    } catch (error) {
      console.error("Get contact error:", error);
      return res.status(500).json({ message: "Failed to get contact" });
    }
  });

  app.get("/api/contacts/search", async (req: Request, res: Response) => {
    try {
      const q = (req.query.q as string) || "";
      if (!q) return res.status(400).json({ message: "Search query is required" });
      const contacts = await storage.searchContacts(q);
      return res.status(200).json(contacts);
    } catch (error) {
      console.error("Search contacts error:", error);
      return res.status(500).json({ message: "Failed to search contacts" });
    }
  });

  app.get("/api/locations/:id", async (req: Request, res: Response) => {
    try {
      const location = await storage.getLocation(parseInt(req.params.id));
      if (!location) {
        return res.status(404).json({ message: "Location not found" });
      }
      
      return res.status(200).json(location);
    } catch (error) {
      console.error("Get location error:", error);
      return res.status(500).json({ message: "Failed to get location" });
    }
  });

  app.get("/api/locations/search", async (req: Request, res: Response) => {
    try {
      const query = req.query.q as string;
      if (!query) {
        return res.status(400).json({ message: "Search query is required" });
      }

      const locations = await storage.searchLocations(query);
      return res.status(200).json(locations);
    } catch (error) {
      console.error("Search locations error:", error);
      return res.status(500).json({ message: "Failed to search locations" });
    }
  });

  // Message routes
  app.get("/api/messages", async (req: Request, res: Response) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    try {
      const messages = await storage.getMessages(req.session.userId);
      return res.status(200).json(messages);
    } catch (error) {
      console.error("Get messages error:", error);
      return res.status(500).json({ message: "Failed to get messages" });
    }
  });

  app.post("/api/messages", async (req: Request, res: Response) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    try {
      const { content } = req.body;
      if (!content) {
        return res.status(400).json({ message: "Message content is required" });
      }

      // Create user message
      const userMessage = await storage.createMessage({
        userId: req.session.userId,
        content,
        isUserMessage: true
      });

      // Get all messages for context
      const messages = await storage.getMessages(req.session.userId);
      
      // Intent: course planning for next semester
      const asksForNextSemester = /\b(next\s*semester|upcoming\s*semester)\b.*\b(course|register|enroll|take)s?/i.test(content) || /\bwhich\s+courses\s+should\s+i\s+(register|take|enroll)\b/i.test(content);
      if (asksForNextSemester) {
        try {
          const profile = await storage.getUserProfile(req.session.userId);
          if (!profile || !profile.program || !profile.currentSemester) {
            const note = !profile ? 'No student profile found.' : (!profile.program ? 'Program is missing in your profile.' : 'Current semester is missing in your profile.');
            const msg = `${note}\n\nPlease set your profile first under Settings → Profile (program and current semester).`;
            const botMessage = await storage.createMessage({ userId: req.session.userId, content: msg, isUserMessage: false, sources: [] });
            return res.status(201).json([userMessage, botMessage]);
          }

          const program = String(profile.program);
          const currentSemester = Number(profile.currentSemester) || 0;
          const nextSemester = currentSemester + 1;
          const all = await storage.getCourses(program);
          const done = await storage.getUserCompletedCourses(req.session.userId);
          const doneSet = new Set<number>(done.map((d) => d.courseId));

          // helper to check prereqs
          const prereqsSatisfied = async (courseId: number): Promise<boolean> => {
            const prs = await storage.getCoursePrereqs(courseId);
            return prs.every(pr => doneSet.has(pr.prereqCourseId));
          };

          // choose courses in next semester first; if few, also include without semester or later semesters when prereqs satisfied
          const candidates = all.filter(c => !doneSet.has(c.id));
          const next = candidates.filter(c => (c.semester === nextSemester));
          const sameOrOpen = candidates.filter(c => c.semester === null || c.semester === undefined);
          const later = candidates.filter(c => typeof c.semester === 'number' && (c.semester as number) > nextSemester);

          const pickFrom = [...next, ...sameOrOpen, ...later];
          const picked: Array<{ c: typeof pickFrom[number]; reason: string }>= [];
          let credits = 0;
          const MAX = 30;
          for (const c of pickFrom) {
            if (credits + c.credits > MAX) continue;
            if (!(await prereqsSatisfied(c.id))) continue;
            picked.push({ c, reason: `${c.required ? 'required' : (c.elective ? 'elective' : 'optional')}${typeof c.semester === 'number' ? `; semester ${c.semester}` : ''}` });
            credits += c.credits;
            if (credits >= MAX) break;
          }

          if (!picked.length) {
            const msg = `Based on your profile (program: ${program}, current semester: ${currentSemester}), I couldn't find courses with prerequisites satisfied for next semester. Please verify completed courses and prerequisites.`;
            const botMessage = await storage.createMessage({ userId: req.session.userId, content: msg, isUserMessage: false, sources: [] });
            return res.status(201).json([userMessage, botMessage]);
          }

          const lines = picked.map(p => `- ${p.c.code} ${p.c.title} (${p.c.credits} credits) — ${p.reason}`);
          const header = `Recommended courses for semester ${nextSemester} (max ~${MAX} credits):`;
          const msg = `${header}\n${lines.join('\n')}\n\nTip: You can adjust your profile or ask for elective-heavy options.`;
          const botMessage = await storage.createMessage({ userId: req.session.userId, content: msg, isUserMessage: false, sources: [] });
          return res.status(201).json([userMessage, botMessage]);
        } catch (e) {
          console.error('Next semester recommendation error:', e);
          // fall through to generic RAG below
        }
      }
      
      // Get response from OpenAI
      // const botResponse = await getChatResponse(
      //   messages.map(msg => ({ content: msg.content, isUserMessage: msg.isUserMessage }))
      // );

      const botResponse = await getRAGResponse(
        content,
        messages.map(msg => ({ content: msg.content, isUserMessage: msg.isUserMessage }))
      );

      // Save bot response
      const botMessage = await storage.createMessage({
        userId: req.session.userId,
        content: botResponse.answer,
        isUserMessage: false,
        sources: botResponse.sources
      });

      return res.status(201).json([userMessage, botMessage]);
    } catch (error) {
      console.error("Create message error:", error);
      return res.status(500).json({ message: "Failed to process message" });
    }
  });

  // Notification routes
  app.get("/api/notifications", async (req: Request, res: Response) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    try {
      const notifications = await storage.getNotifications(req.session.userId);
      return res.status(200).json(notifications);
    } catch (error) {
      console.error("Get notifications error:", error);
      return res.status(500).json({ message: "Failed to get notifications" });
    }
  });

  app.get("/api/notifications/unread/count", async (req: Request, res: Response) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    try {
      const count = await storage.getUnreadNotificationsCount(req.session.userId);
      return res.status(200).json({ count });
    } catch (error) {
      console.error("Get unread notifications count error:", error);
      return res.status(500).json({ message: "Failed to get unread notifications count" });
    }
  });

  app.patch("/api/notifications/:id/read", async (req: Request, res: Response) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    try {
      const notification = await storage.markNotificationAsRead(parseInt(req.params.id));
      if (!notification) {
        return res.status(404).json({ message: "Notification not found" });
      }

      return res.status(200).json(notification);
    } catch (error) {
      console.error("Mark notification as read error:", error);
      return res.status(500).json({ message: "Failed to mark notification as read" });
    }
  });

  app.post("/api/notifications/read/all", async (req: Request, res: Response) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    try {
      await storage.markAllNotificationsAsRead(req.session.userId);
      return res.status(200).json({ message: "All notifications marked as read" });
    } catch (error) {
      console.error("Mark all notifications as read error:", error);
      return res.status(500).json({ message: "Failed to mark all notifications as read" });
    }
  });

  // Event routes
  app.get("/api/events", async (req: Request, res: Response) => {
    try {
      const events = await storage.getEvents();
      return res.status(200).json(events);
    } catch (error) {
      console.error("Get events error:", error);
      return res.status(500).json({ message: "Failed to get events" });
    }
  });

  app.get("/api/events/:id", async (req: Request, res: Response) => {
    try {
      const event = await storage.getEvent(parseInt(req.params.id));
      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }
      
      return res.status(200).json(event);
    } catch (error) {
      console.error("Get event error:", error);
      return res.status(500).json({ message: "Failed to get event" });
    }
  });

  // Translation route
  app.post("/api/translate", async (req: Request, res: Response) => {
    try {
      const { text, targetLanguage } = req.body;
      if (!text || !targetLanguage) {
        return res.status(400).json({ message: "Text and target language are required" });
      }

      if (targetLanguage !== "en" && targetLanguage !== "hu") {
        return res.status(400).json({ message: "Invalid target language (supported: en, hu)" });
      }

      const translatedText = await translateText(text, targetLanguage);
      return res.status(200).json({ translatedText });
    } catch (error) {
      console.error("Translation error:", error);
      return res.status(500).json({ message: "Failed to translate text" });
    }
  });

  // Smart Search route (policies & guides + contacts)
  app.get("/api/search", async (req: Request, res: Response) => {
    try {
      const q = (req.query.q as string) || "";
      if (!q) return res.status(400).json({ message: "Search query is required" });

      const [policies, contacts] = await Promise.all([
        searchPoliciesGuides(q),
        storage.searchContacts(q)
      ]);

      return res.status(200).json({ policies, contacts });
    } catch (error) {
      console.error("Smart search error:", error);
      return res.status(500).json({ message: "Failed to perform search" });
    }
  });

  // Courses and recommendations
  app.get("/api/programs", async (req: Request, res: Response) => {
    try {
      // Prefer SQL-backed list when available
      const pool = await getSqlPool();
      const result = await pool.request()
        .query(`
          SELECT DISTINCT program FROM courses ORDER BY program
        `);
      const programs = result.recordset.map((r: any) => r.program);
      return res.status(200).json({ programs });
    } catch (error) {
      // Fallback to in-memory storage if SQL is unavailable or not configured
      try {
        console.warn('SQL programs lookup failed, falling back to storage.getCourses():', error);
        const all = await storage.getCourses();
        const programs = Array.from(new Set((all || []).map((c: any) => c.program))).filter(Boolean).sort();
        return res.status(200).json({ programs });
      } catch (e) {
        console.error("Get programs error:", error, e);
        return res.status(500).json({ message: "Failed to get programs" });
      }
    }
  });

  app.get("/api/courses", async (req: Request, res: Response) => {
    try {
      const program = (req.query.program as string) || undefined;
      const courses = await storage.getCourses(program);
      return res.status(200).json(courses);
    } catch (error) {
      console.error("Get courses error:", error);
      return res.status(500).json({ message: "Failed to get courses" });
    }
  });

  // Student-facing courses by program (annotated with completed flag for the session user)
  app.get("/api/student/courses/by-program", async (req: Request, res: Response) => {
    try {
      const programRaw = (req.query.program as string) || '';
      const program = programRaw.trim();
      if (!program) return res.status(400).json({ message: "program query parameter is required" });

      const courses = await storage.getCourses(program);

      let completedIds = new Set<number>();
      const sessionUserId = (req.session as any)?.userId as number | undefined;
      if (sessionUserId) {
        const done = await storage.getUserCompletedCourses(sessionUserId);
        for (const d of done) completedIds.add(d.courseId);
      }

      const annotated = courses.map(c => ({ ...c, completed: completedIds.has(c.id) }));

      // Compute program credits from available course list
      const sumCredits = (courses || []).reduce((s, c) => s + (c.credits || 0), 0);
      // If sum is suspiciously small for a master's program, fall back to a sensible default (120)
      let programTotalCredits = sumCredits;
      try {
        if (programTotalCredits < 60 && /msc|master/i.test(program || '')) {
          programTotalCredits = 120; // typical master's program credit total
        }
      } catch (e) {
        // ignore and use sumCredits
      }

      return res.status(200).json({ program, programTotalCredits, courses: annotated });
    } catch (error) {
      console.error("Get student courses by program error:", error);
      return res.status(500).json({ message: "Failed to get student courses" });
    }
  });

  // Student profile endpoints (get/set simple profile stored in memory for demo)
  app.get('/api/student/profile', async (req: Request, res: Response) => {
    if (!req.session.userId) return res.status(401).json({ message: 'Not authenticated' });
    try {
      const profile = await storage.getUserProfile(req.session.userId);
      return res.status(200).json(profile ?? {});
    } catch (error) {
      console.error('Get student profile error:', error);
      return res.status(500).json({ message: 'Failed to get student profile' });
    }
  });

  app.post('/api/student/profile', async (req: Request, res: Response) => {
    if (!req.session.userId) return res.status(401).json({ message: 'Not authenticated' });
    try {
      const { program, currentSemester, curriculum, major } = req.body as { program?: string; currentSemester?: number; curriculum?: any; major?: string };
      if (!program) return res.status(400).json({ message: 'program is required' });

      const userId = req.session.userId as number;
      // Read existing profile to determine if semester increased/decreased
      const existing = await storage.getUserProfile(userId);
      const oldSemester = existing && typeof existing.currentSemester === 'number' ? existing.currentSemester : null;

      // Normalize program and persist profile
      const normalizedProgram = (program || '').trim();
      const profileRec = await storage.setUserProfile(userId, { program: normalizedProgram, currentSemester: currentSemester ?? null, curriculum: curriculum ?? null, major: major ?? null });

      // Server-side auto-marking logic: when currentSemester is provided and increased (or first set),
      // automatically create completed entries for REQUIRED courses where course.semester <= currentSemester
      const actions: { added: number; skipped: number; note?: string } = { added: 0, skipped: 0 };
      try {
        if (typeof currentSemester === 'number' && currentSemester > 0) {
          // Only auto-add when semester is greater than previous or when there was no previous value
          if (oldSemester === null || currentSemester > oldSemester) {
            const courses = await storage.getCourses(normalizedProgram);
            const done = await storage.getUserCompletedCourses(userId);
            const doneSet = new Set<number>(done.map(d => d.courseId));
            const threshold = Math.max(0, currentSemester - 1); // auto-mark up to chosenSemester - 1
            for (const c of courses) {
              const sem = (c as any).semester;
              const isRequired = !!(c as any).required;
              const isElective = !!(c as any).elective;
              const isCompulsoryElective = !!(c as any).compulsoryElective;
              // Mark if semester <= threshold and (required OR (elective AND marked compulsoryElective))
              if (typeof sem === 'number' && sem <= threshold && (isRequired || (isElective && isCompulsoryElective))) {
                if (!doneSet.has(c.id)) {
                  try {
                    await storage.createUserCompletedCourse({ userId, courseId: c.id } as any);
                    actions.added++;
                  } catch (e) {
                    // ignore individual failures
                    actions.skipped++;
                  }
                } else {
                  actions.skipped++;
                }
              }
            }
          } else if (oldSemester !== null && currentSemester < oldSemester) {
            // If semester decreased, we do not auto-remove completed records; inform caller
            actions.note = 'Semester decreased: previously-completed courses are not automatically removed. Unmark manually if needed.';
          }
        }
      } catch (e) {
        console.error('Auto-marking error:', e);
      }

      return res.status(200).json({ profile: profileRec, autoMarkSummary: actions });
    } catch (error) {
      console.error('Set student profile error:', error);
      return res.status(500).json({ message: 'Failed to set student profile' });
    }
  });

  // Mark a course as completed for the session user
  app.post("/api/student/courses/mark-completed", async (req: Request, res: Response) => {
    if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const { courseId, term, grade } = req.body as { courseId: number; term?: string; grade?: string };
      if (!courseId) return res.status(400).json({ message: "courseId is required" });

      const rec = await storage.createUserCompletedCourse({ userId: req.session.userId, courseId, term, grade } as any);
      return res.status(201).json(rec);
    } catch (error) {
      console.error("Mark completed error:", error);
      return res.status(500).json({ message: "Failed to mark course as completed" });
    }
  });

  // Unmark a completed course for the session user
  app.post("/api/student/courses/unmark-completed", async (req: Request, res: Response) => {
    if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const { courseId } = req.body as { courseId: number };
      if (!courseId) return res.status(400).json({ message: "courseId is required" });

      const ok = await storage.deleteUserCompletedCourse(req.session.userId, courseId);
      if (!ok) return res.status(404).json({ message: "Completed course record not found" });
      return res.status(200).json({ message: "Unmarked completed" });
    } catch (error) {
      console.error("Unmark completed error:", error);
      return res.status(500).json({ message: "Failed to unmark completed course" });
    }
  });

  app.post("/api/recommendations", async (req: Request, res: Response) => {
    try {
      const { program, maxCredits, preferElectives, completedCourseIds, targetSemester } = req.body as {
        program: string;
        maxCredits?: number;
        preferElectives?: boolean;
        completedCourseIds?: number[];
        targetSemester?: number; // optional explicit semester override
      };

      if (!program) return res.status(400).json({ message: "Program is required" });

      const max = typeof maxCredits === 'number' && maxCredits > 0 ? maxCredits : 18;
      let completed = Array.isArray(completedCourseIds) ? new Set<number>(completedCourseIds) : undefined;
      const sessionUserId = (req.session as any)?.userId as number | undefined;
      if (!completed && sessionUserId) {
        const done = await storage.getUserCompletedCourses(sessionUserId);
        completed = new Set<number>(done.map((d) => d.courseId));
      }
      if (!completed) completed = new Set<number>();


      let semesterScope: number | null = null;
      if (typeof targetSemester === 'number' && !isNaN(targetSemester)) {
        semesterScope = targetSemester;
      } else if (sessionUserId) {
        try {
          const profile = await storage.getUserProfile(sessionUserId);
          if (profile && typeof profile.currentSemester === 'number') {
            semesterScope = profile.currentSemester;
          }
        } catch (e) {

          semesterScope = null;
        }
      }

      const all = await storage.getCourses(program);
      let remaining = all.filter(c => !completed!.has(c.id));
      if (typeof semesterScope === 'number') {
        remaining = remaining.filter(c => c.semester === semesterScope);
      }

      // Helper: check prereqs
      const prereqsSatisfied = async (courseId: number): Promise<{ ok: boolean; missing: number[] }> => {
        const prereqs = await storage.getCoursePrereqs(courseId);
        const missing = prereqs.map(pr => pr.prereqCourseId).filter(id => !completed!.has(id));
        return { ok: missing.length === 0, missing };
      };

      // Score and filter
      const scored: Array<{ course: (typeof remaining)[number]; score: number; reason: string }> = [];
      for (const c of remaining) {
        const prereqCheck = await prereqsSatisfied(c.id);
        if (!prereqCheck.ok) {
          continue; // skip courses with unmet prereqs
        }
        let score = 0;
        const tags: string[] = [];
        if (c.required) { score += 100; tags.push('required'); }
        if (c.elective) { score += preferElectives ? 80 : 10; tags.push('elective'); }
        if (typeof c.semester === 'number') {
          // small nudge towards nearer semesters; if scoped, semesters are equal
          score += Math.max(0, 10 - c.semester);
        }
        score += c.credits; // small nudge for credits

        const reason = `Prerequisites satisfied${tags.length ? '; ' + tags.join(', ') : ''} semester ${c.semester ?? '-'}; ${c.credits} credits`;
        scored.push({ course: c, score, reason });
      }

      // Sort by score desc, then required first, then semester asc
      scored.sort((a, b) => b.score - a.score || (b.course.required ? 1 : 0) - (a.course.required ? 1 : 0) || (a.course.semester ?? 99) - (b.course.semester ?? 99));

      // Pick until max credits
      const picked: Array<{ id: number; code: string; title: string; credits: number; required: boolean; elective: boolean; semester: number | null; reason: string }>= [];
      let total = 0;
      for (const s of scored) {
        if (total + s.course.credits > max) continue;
        picked.push({
          id: s.course.id,
          code: s.course.code,
          title: s.course.title,
          credits: s.course.credits,
          required: !!s.course.required,
          elective: !!s.course.elective,
          semester: s.course.semester ?? null,
          reason: s.reason,
        });
        total += s.course.credits;
      }

      return res.status(200).json({
        program,
        maxCredits: max,
        totalCredits: total,
        semester: typeof semesterScope === 'number' ? semesterScope : null,
        recommendations: picked,
      });
    } catch (error) {
      console.error("Recommendations error:", error);
      return res.status(500).json({ message: "Failed to get recommendations" });
    }
  });

  // Corpus API for RAG service to fetch chunks from Azure SQL
  app.get("/api/corpus/chunks", async (req: Request, res: Response) => {
    try {
      const limit = Math.min(parseInt((req.query.limit as string) || '1000', 10), 5000);
      const afterId = parseInt((req.query.afterId as string) || '0', 10);

      const pool = await getSqlPool();
      const r = await pool.request()
        .input('afterId', isNaN(afterId) ? 0 : afterId)
        .input('limit', isNaN(limit) ? 1000 : limit)
        .query(`
          SELECT c.id, c.document_id AS documentId, c.chunk_index AS chunkIndex, c.text, c.source_page AS sourcePage,
                 d.title, d.source_uri AS sourceUri
          FROM corpus_chunks c
          INNER JOIN documents_corpus d ON d.id = c.document_id
          WHERE c.id > @afterId
          ORDER BY c.id
          OFFSET 0 ROWS FETCH NEXT @limit ROWS ONLY`);

      return res.status(200).json({ chunks: r.recordset });
    } catch (error) {
      console.error("Get corpus chunks error:", error);
      return res.status(500).json({ message: "Failed to get corpus chunks" });
    }
  });

  return httpServer;
}
