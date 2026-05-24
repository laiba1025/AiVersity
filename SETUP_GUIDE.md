# AiVersity Application - Setup & Run Guide

## Prerequisites

- **Node.js** (with npm) - for the frontend and backend
- **Python 3.11** - for the RAG service
- **Git** - already installed

---

## Step 1: Install Node.js Dependencies

Open a terminal in `d:\AiVersity` and run:

```powershell
cd d:\AiVersity
npm install
```

This installs all frontend (React/Vite) and backend (Express) dependencies.

---

## Step 2: Install Python Dependencies for RAG Service

The RAG service requires Flask and Flask-CORS which are missing from requirements.txt. Install them:

```powershell
cd d:\AiVersity\rag_service
py -3.11 -m pip install -r requirements.txt
py -3.11 -m pip install flask flask-cors
```

**Note:** Use `py -3.11` specifically on Windows to ensure you're using Python 3.11 (not the Microsoft Store Python).

---

## Step 3: Set Up Environment Variables

Create or verify `.env` file in `d:\AiVersity` with required variables:

```env
# Database connection (Azure SQL or local)
DATABASE_URL=your_database_connection_string

# Azure services (if using Azure OpenAI/Blob Storage)
AZURE_OPENAI_API_KEY=your_key
AZURE_OPENAI_ENDPOINT=your_endpoint

# Session configuration
SESSION_SECRET=your_session_secret

# RAG Service
RAG_SERVICE_URL=http://localhost:5001
```

---

## Step 4: Start the Application

You need to run **TWO servers** simultaneously:

### **Terminal 1: Start Node.js Backend + React Frontend**

```powershell
cd d:\AiVersity
npm run dev
```

Expected output:
```
Local:   http://localhost:4000
Backend: http://localhost:3001
```

This runs:
- **Frontend (React/Vite)**: Port 4000
- **Backend (Express API)**: Port 3001

### **Terminal 2: Start Python RAG Service**

```powershell
cd d:\AiVersity\rag_service
py -3.11 app.py
```

Expected output:
```
Running on http://127.0.0.1:5001
```

---

## Step 5: Access the Application

Open your browser and navigate to:

```
http://localhost:4000
```

The application should now be running with:
- ✅ React frontend
- ✅ Express backend API (port 3001)
- ✅ Python RAG service (port 5001)

---

## Available npm Scripts

```bash
npm run dev              # Run both frontend and backend in dev mode
npm run dev:server      # Run only Express backend
npm run dev:client      # Run only React frontend (Vite)
npm run build           # Build frontend and backend for production
npm start               # Run production build
npm run test            # Run tests
npm run db:push         # Sync database schema with Drizzle
npm run check           # TypeScript type checking
```

---

## Troubleshooting

### ❌ "No module named 'flask'" or "No module named 'flask_cors'"
**Solution:**
```powershell
py -3.11 -m pip install flask flask-cors
```

### ❌ "Port 3001 already in use"
**Solution:** Kill the process using port 3001 or use a different port:
```powershell
npm run dev:server:3001  # Alternative port
```

### ❌ "Python not found"
**Solution:** Use the full Python launcher:
```powershell
py -3.11 app.py
```
Don't use `python app.py` - Windows will redirect to Microsoft Store Python which may not work.

### ❌ "Cannot connect to database"
**Solution:** Check your `.env` file has correct `DATABASE_URL` and the database is accessible.

### ❌ "React app not loading"
**Solution:** Make sure both servers are running (ports 3001 and 5001) before accessing `localhost:4000`.

---

## Project Structure

```
d:\AiVersity\
├── client/                 # React frontend (Vite)
├── server/                 # Express backend
├── rag_service/           # Python Flask RAG service
├── shared/                # Shared types and schemas
├── package.json           # Node.js dependencies
├── .env                   # Environment variables
└── tsconfig.json          # TypeScript configuration
```

---

## Ports Used

| Service | Port | Description |
|---------|------|-------------|
| Frontend | 4000 | React Vite development server |
| Backend | 3001 | Express API server |
| RAG Service | 5001 | Python Flask service |

Make sure these ports are not already in use by other applications.

---

## Database Setup (Optional)

If you need to seed the database with initial data:

```powershell
cd d:\AiVersity
npm run db:apply
npm run db:setup-app-user
npx ts-node server/seed-courses.ts
```

---

## Quick Start Summary

**In 3 steps:**

1. **Terminal 1:**
   ```powershell
   cd d:\AiVersity
   npm install
   npm run dev
   ```

2. **Terminal 2:**
   ```powershell
   cd d:\AiVersity\rag_service
   py -3.11 -m pip install -r requirements.txt flask flask-cors
   py -3.11 app.py
   ```

3. **Browser:**
   ```
   http://localhost:4000
   ```

---

## Need Help?

- Check the browser console (F12) for frontend errors
- Check Terminal 1 output for backend errors
- Check Terminal 2 output for RAG service errors
- Review `.env` configuration
- Ensure all three ports (4000, 3001, 5001) are available
