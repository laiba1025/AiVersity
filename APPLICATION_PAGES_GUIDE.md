# AiVersity Application - Page Descriptions & Features

A comprehensive guide to every page in the AiVersity application, designed to help international students navigate their academic journey with AI-powered assistance.

---

## 📋 Table of Contents

1. [Login Page](#login-page)
2. [Register Page](#register-page)
3. [Home Page](#home-page)
4. [Chat Page](#chat-page)
5. [Course Recommendations Page](#course-recommendations-page)
6. [Documents Management Page](#documents-management-page)
7. [Mandatory Documents Page](#mandatory-documents-page)
8. [Campus Map Page](#campus-map-page)
9. [Notifications Page](#notifications-page)
10. [Search Page](#search-page)
11. [Dashboard Page](#dashboard-page)

---

## 🔐 Login Page

**Route:** `/login`

### Purpose
The entry point for existing users to securely access their personalized AiVersity experience.

### Features
- **Email/Password Authentication**: Secure login with email and password credentials
- **Remember Me Checkbox**: Option to remember login credentials locally for convenience
- **Error Handling**: Clear error messages for invalid credentials or failed login attempts
- **Registration Link**: Quick navigation to create a new account
- **Session Management**: Automatic redirect to home page after successful login

### Key Components
- Email input field with validation
- Secure password input field
- Remember me checkbox for session persistence
- Submit button with loading state
- Link to registration page for new users
- Error message display area

### User Flow
```
Enter Email → Enter Password → (Optional) Check "Remember Me" 
→ Click Login → Validation → Redirect to /home
```

### Technical Details
- Uses local user store for credential persistence when "Remember Me" is checked
- Supports both cloud and local authentication modes
- Session stored in browser storage for quick access

---

## 📝 Register Page

**Route:** `/register`

### Purpose
Allows new users to create an account and join the AiVersity platform.

### Features
- **User Registration**: Create new accounts with email and password
- **Full Name Input**: Capture student's full name for personalization
- **Password Validation**: Ensure strong passwords for security
- **Email Verification**: Validate email format and uniqueness
- **Account Preferences**: Set language and timezone on registration
- **Terms Agreement**: Accept terms of service before registration

### Key Components
- Full name input field
- Email input field with format validation
- Password input with strength indicator
- Confirm password field
- Language preference selector
- Timezone selector
- Terms & conditions checkbox
- Submit button

### User Flow
```
Click Register → Fill in Details → Accept Terms → 
Submit → Account Created → Redirect to Login / Dashboard
```

### Technical Details
- Validates email uniqueness against existing users
- Stores user preferences for future logins
- Supports language selection for multilingual experience
- Password encryption before storage

---

## 🏠 Home Page

**Route:** `/home` (Protected)

### Purpose
The main dashboard and landing page after login, providing at-a-glance view of academic status and important information.

### Features
- **Student Profile Summary**: Display user's name, program, and academic status
- **Document Status Overview**: Shows count of uploaded vs. required mandatory documents
- **Upcoming Expirations**: Alerts for documents expiring soon (color-coded)
- **Upcoming Events**: Calendar view of important academic events (deadlines, seminars, etc.)
- **Quick Action Buttons**: Fast access to document upload, chat, course recommendations
- **Personalized Greeting**: Addresses student by first name
- **Expiry Tracker**: Visual indicator of documents expiring within 30 days

### Key Sections
1. **Profile Card** - Student name, program, year of study
2. **Document Status Card** - X of Y mandatory documents uploaded
3. **Upcoming Deadlines** - Color-coded expiry alerts
4. **Upcoming Events** - Next 5 events with dates
5. **Quick Actions** - Buttons for main features

### Data Displayed
| Element | Source | Refresh Rate |
|---------|--------|-------------|
| Events | `/api/events` | Real-time |
| Mandatory Docs | `/api/mandatory-docs` | Real-time |
| User Profile | App Context | On login |

### User Flow
```
Login → Home Page → See Overview → Choose Action:
- Chat with AI
- Upload Documents
- Get Course Recommendations
- View Full Document List
```

### Technical Details
- Uses React Query for data caching (15-second stale time)
- Computes expiry alerts based on document dates
- Sorts events by date for chronological display

---

## 💬 Chat Page

**Route:** `/chat` (Protected)

### Purpose
RAG-powered intelligent chatbot to answer academic questions about policies, procedures, campus life, and course information.

### Features
- **Real-time Conversation**: Chat with AI assistant for instant answers
- **RAG Context**: Responses grounded in actual university documents and knowledge base
- **Message History**: Persistent chat history within session
- **Typing Indicator**: Shows when AI is processing response
- **Source Attribution**: See which documents informed the AI response
- **User-Friendly Interface**: Clean chat bubble interface with timestamps
- **Auto-Scroll**: Chat automatically scrolls to latest message
- **Error Handling**: Graceful error messages if service unavailable

### Chat Types & Sample Queries
```
Academic Questions:
- "What are the requirements for my Master's degree?"
- "When is the deadline for course registration?"
- "How do I apply for leave of absence?"

Campus Life:
- "What are the library opening hours?"
- "How do I get a student ID?"
- "Where is the counseling office?"

Course Related:
- "Which courses are available for my program?"
- "What's the prerequisite for Advanced AI?"
- "How are courses graded?"
```

### UI Layout
```
┌─────────────────────────────────┐
│     Welcome, [FirstName]!        │
│                                 │
├─────────────────────────────────┤
│                                 │
│  [Previous Messages...]         │
│                                 │
│  [User Message]                 │
│  ← [AI Response with sources]  │
│                                 │
├─────────────────────────────────┤
│ [Message Input] [Send Button]   │
└─────────────────────────────────┘
```

### Features Detail
- **Message Input**: Large text field for user queries
- **Send Button**: Submit question (keyboard Enter also works)
- **Loading State**: Shows spinner while waiting for response
- **Response Display**: Shows AI answer in chat bubble with timestamp
- **Sources**: Display relevant document sources below response
- **Scroll Container**: Auto-scrolls to latest message

### Technical Details
- Connects to `/query` endpoint in RAG service
- Uses chat history for context-aware responses
- Supports WebSocket for real-time notifications
- Source parsing extracts document references from response

---

## 🎓 Course Recommendations Page

**Route:** `/recommendations` (Protected)

### Purpose
Provides personalized course recommendations based on program, credits, and preferences.

### Features
- **Program Selection**: Choose from available degree programs
- **Credit Limit Setting**: Set maximum credits per semester
- **Elective Preference**: Toggle between required-first or elective-heavy recommendations
- **Smart Filtering**: 
  - Filters by program
  - Checks prerequisites automatically
  - Respects credit limits
  - Prioritizes required courses
- **Results Table**: Shows recommended courses with:
  - Course Code (e.g., AI501)
  - Course Title
  - Credits
  - Course Type (Required/Elective)
  - Semester
  - Prerequisites (if any)
- **Summary Statistics**: 
  - Total courses recommended
  - Total credits
  - Credit utilization percentage

### Available Programs
```
- AI MSc (7 courses, 18+ credits)
- CS BSc (8 courses, 20 credits)
- Data Science MSc (7 courses, 18 credits)
- Engineering BSc (8 courses, 21 credits)
- Cybersecurity MSc (7 courses, 19 credits)
```

### UI Layout
```
┌─────────────────────────────────┐
│  Course Recommendations         │
├─────────────────────────────────┤
│                                 │
│  Program: [Dropdown ▼]          │
│  Max Credits: [Input: 18]       │
│  ☐ Prefer Electives            │
│  [Get Recommendations Button]   │
│                                 │
├─────────────────────────────────┤
│  Summary:                       │
│  Courses: 6 | Credits: 15/18    │
│  Utilization: 83%               │
│                                 │
├─────────────────────────────────┤
│  Course Code | Title | Cr | Type│
│  ────────────────────────────────│
│  AI501   | ML Fund.    | 3 | Req│
│  AI502   | Deep Learn. | 3 | Req│
│  AI503   | NLP         | 3 | Elc│
│  ...                            │
└─────────────────────────────────┘
```

### Recommendation Algorithm
```
1. Fetch all courses for selected program
2. Filter out courses with unmet prerequisites
3. Sort by: Required-first → Electives (if preferred)
4. Accumulate courses until credit limit reached
5. Sort final list by semester
6. Display with summary statistics
```

### User Flow
```
1. Load page → Fetch programs from database
2. Select program → Default program selected
3. Set max credits (default 18)
4. Toggle elective preference (optional)
5. Click "Get Recommendations"
6. View results in table
7. Click course for details (if implemented)
```

### Data Structure Example
```json
{
  "program": "AI MSc",
  "courses": [
    {
      "code": "AI501",
      "title": "Machine Learning Fundamentals",
      "credits": 3,
      "type": "required",
      "semester": 1,
      "prerequisites": []
    },
    {
      "code": "AI502",
      "title": "Deep Learning",
      "credits": 3,
      "type": "required",
      "semester": 1,
      "prerequisites": ["AI501"]
    }
  ]
}
```

### Technical Details
- Fetches programs from `/api/programs` endpoint
- Submits recommendation request to `/api/recommendations`
- Uses React hooks for state management
- Table sorts and filters on client-side for performance

---

## 📄 Documents Management Page

**Route:** `/documents` (Protected)

### Purpose
Centralized hub for managing all academic documents - both general uploads and mandatory document submissions.

### Features
- **Document Upload**: Upload any document type (PDF, DOC, images, etc.)
- **Mandatory Document Tracking**: See which mandatory documents are required and their status
- **Document Information**: Display document name, size, upload date
- **Document Status Badges**: Visual indicators for:
  - ✅ Uploaded
  - ⏳ Pending Review
  - ❌ Rejected
  - ⚠️ Expiring Soon
- **Expiry Date Management**: Set expiration dates for renewal tracking
- **Quick Upload Dialog**: Modal for uploading mandatory documents with metadata
- **General Document Library**: View all uploaded documents with details
- **Bulk Actions**: Select multiple documents for batch operations (future)

### Document Types
```
Mandatory Documents:
- Student ID Verification
- Visa Documentation
- Health Insurance Certificate
- Academic Transcript
- Degree Certificate
- Language Test Results (TOEFL/IELTS)
- Vaccination Records

General Documents:
- Essays / Papers
- Projects
- Assignments
- Research Papers
- Certificates
```

### UI Sections

#### Section 1: Mandatory Documents Checklist
```
┌─────────────────────────────────┐
│  MANDATORY DOCUMENTS STATUS     │
├─────────────────────────────────┤
│                                 │
│ ✅ Student ID                  │
│    Expires: June 15, 2025       │
│                                 │
│ ❌ Health Insurance            │
│    Status: Not Uploaded         │
│    [Upload Button]              │
│                                 │
│ ⚠️  Visa Document              │
│    Expires in 10 days           │
│    [Renew Button]               │
│                                 │
└─────────────────────────────────┘
```

#### Section 2: Document Upload
```
┌─────────────────────────────────┐
│  UPLOAD NEW DOCUMENT            │
├─────────────────────────────────┤
│                                 │
│  Document Title:  [_________]   │
│  Description:     [_________]   │
│  File:            [Choose File] │
│  Expiry Date:     [_________]   │
│                                 │
│          [Upload Button]        │
│                                 │
└─────────────────────────────────┘
```

#### Section 3: Document Library
```
┌─────────────────────────────────┐
│  ALL DOCUMENTS                  │
├─────────────────────────────────┤
│                                 │
│ thesis_proposal.pdf        2.5MB│
│ Uploaded: Jan 15, 2025          │
│ Status: ✅ Approved             │
│                                 │
│ course_assignment.docx     1.2MB│
│ Uploaded: Jan 14, 2025          │
│ Status: ⏳ Pending Review       │
│                                 │
└─────────────────────────────────┘
```

### File Size Limits
- Individual file: 100 MB
- Total storage per user: 5 GB
- Supported formats: PDF, DOC, DOCX, XLS, XLSX, PPT, PPTX, JPG, PNG, ZIP

### User Flow
```
1. Open Documents page
2. View mandatory document checklist
3. Upload mandatory docs (with expiry date)
4. Or upload general documents
5. View document library
6. Track expiry dates
7. Get alerts for soon-to-expire documents
```

### API Integration
```
- GET /api/documents          → Fetch all user documents
- POST /api/documents         → Upload new document
- PUT /api/documents/:id      → Update document status
- GET /api/mandatory-docs     → Fetch mandatory requirements
- POST /api/mandatory-docs    → Submit mandatory document
```

### Technical Details
- Uses file input for document selection
- Converts files to base64 for upload
- Stores document metadata in database
- Tracks upload timestamp and file size
- Supports document preview (future enhancement)

---

## ✅ Mandatory Documents Page

**Route:** `/mandatory-docs` (Protected)

### Purpose
Dedicated page for managing university-mandated documents with strict compliance tracking.

### Features
- **Complete Checklist**: All mandatory documents required by the university
- **Status Indicators**: Color-coded badges for each document
  - 🟢 Uploaded
  - 🔴 Not Uploaded
  - 🟡 Expiring Soon
  - 🔵 Expired
- **Expiry Date Management**: Set and track renewal dates
- **Document Upload Modal**: Quick upload for mandatory documents
- **Compliance Alerts**: Red banner if any documents missing or expired
- **Download Option**: View previously uploaded mandatory documents
- **Compliance Score**: Visual progress bar showing completeness

### Mandatory Documents List
```
1. Student Identification
   - Type: ID/Passport
   - Expiry: Required
   - Status: [User Status]

2. Visa Documentation
   - Type: Residence Permit
   - Expiry: Required
   - Status: [User Status]

3. Health Insurance
   - Type: Insurance Certificate
   - Expiry: Quarterly
   - Status: [User Status]

4. Academic Records
   - Type: Transcript/Diploma
   - Expiry: N/A (Permanent)
   - Status: [User Status]

5. Language Proficiency
   - Type: TOEFL/IELTS Result
   - Expiry: 2 Years
   - Status: [User Status]

6. Vaccination Records
   - Type: Health Certificate
   - Expiry: Annually
   - Status: [User Status]
```

### UI Layout
```
┌─────────────────────────────────┐
│  MANDATORY DOCUMENTS            │
│  Compliance: 67% (4/6 Complete) │
├─────────────────────────────────┤
│  ▓▓▓▓▓▓░░ Progress Bar          │
│                                 │
│  🟢 Student ID                  │
│     Last Updated: Dec 1, 2024   │
│     Expires: Dec 1, 2027        │
│                                 │
│  🔴 Health Insurance (MISSING)  │
│     [Upload Required]           │
│                                 │
│  🟡 Visa (Expiring in 30 days) │
│     Expires: Feb 15, 2025       │
│     [Renew Now]                 │
│                                 │
│  🟢 Academic Transcript        │
│     Last Updated: Jan 10, 2025  │
│                                 │
└─────────────────────────────────┘
```

### User Flow
```
1. Navigate to Mandatory Docs
2. Review current status
3. Identify missing documents
4. Click [Upload] for missing docs
5. Select document file
6. Set expiry date
7. Submit
8. See updated compliance score
9. Get alerts for expiring docs
```

### Technical Details
- Queries `/api/mandatory-docs` for requirements
- Tracks document expiry with date comparison
- Highlights documents expiring within 30 days
- Shows last updated timestamp
- Provides compliance percentage calculation

---

## 🗺️ Campus Map Page

**Route:** `/map` (Protected)

### Purpose
Interactive campus map to help students navigate the university campus and find important locations.

### Features
- **Interactive Map**: Searchable campus map with location markers
- **Location Categories**: 
  - Academic Buildings
  - Libraries
  - Dining Facilities
  - Medical Centers
  - Administrative Offices
  - Dormitories
  - Sports Facilities
- **Location Details**: Click marker to see:
  - Building name
  - Address
  - Opening hours
  - Contact information
  - Facilities available
- **Search Functionality**: Find locations by name
- **Map Controls**:
  - Zoom in/out buttons
  - Current location button
  - Pan functionality
- **Directions**: Get directions from current location to selected place

### Available Locations (Examples)
```
Academic Buildings:
- Engineering Building (North Campus)
- Science Center (Central Campus)
- Library Wing (South Campus)
- Computer Science Lab (East Campus)

Services:
- Main Library
- Student Health Center
- International Office
- Dining Hall #1, #2
- Student Housing A, B, C
- Sports Complex
```

### Map Controls
```
┌─ Zoom In [+]
├─ Zoom Out [-]
└─ Current Location [⊙]
```

### Search Implementation
```
User Input: "library" 
↓
Filter locations by name
↓
Show matching locations on map
↓
Display results in list
↓
Click result → Center map on location
```

### Location Card Example
```
┌─────────────────────────┐
│  Main Library           │
├─────────────────────────┤
│  📍 North Campus        │
│  Opening: 8 AM - 10 PM  │
│  Phone: +1-555-0123     │
│  Services:              │
│  - 500K+ Books          │
│  - Study Rooms          │
│  - WiFi Available       │
│  [Get Directions]       │
└─────────────────────────┘
```

### User Flow
```
1. Open Map page
2. See full campus overview
3. Search for location (e.g., "Library")
4. Click marker or search result
5. View location details
6. Click "Get Directions"
7. Navigate to destination
```

### Technical Details
- Uses React Leaflet for map rendering
- Markers positioned by coordinates
- Location data from `/api/locations`
- Search filters locations by name/type
- Distance calculation for directions

---

## 🔔 Notifications Page

**Route:** `/notifications` (Protected)

### Purpose
Centralized notification hub displaying all important alerts and updates from the system.

### Features
- **Notification Types**:
  - 📌 Deadlines (Document expiry, assignment due)
  - 📅 Events (Classes, seminars, orientation)
  - ✅ Document Updates (Upload confirmed, rejected)
  - ℹ️ Info (Policy updates, system alerts)
- **Color-Coded Badges**:
  - 🔴 Red: Urgent deadlines
  - 🔵 Blue: Event notifications
  - 🟢 Green: Completed actions
  - 🟡 Yellow: General info
- **Notification Filter**: Filter by type
- **Mark as Read**: Individual notification read status
- **Clear All**: Archive read notifications
- **Timestamp**: Shows when notification was received
- **Notification Count**: Badge showing unread count

### Notification Examples
```
🔴 DEADLINE
   Your visa expires in 7 days
   Please renew immediately
   Jan 18, 2025 - 2:30 PM
   [Mark as Read] [Dismiss]

🔵 EVENT
   Class: Advanced AI (AI502)
   Tomorrow at 2:00 PM - Room 301
   Jan 19, 2025 - 9:15 AM

✅ DOCUMENT
   Your transcript has been approved
   Now visible in your profile
   Jan 17, 2025 - 3:45 PM

🟡 INFO
   Campus will be closed on Jan 26
   Martin Luther King Jr. Day
   Jan 15, 2025 - 10:00 AM
```

### UI Layout
```
┌─────────────────────────────────┐
│  NOTIFICATIONS              (12) │
├─────────────────────────────────┤
│  Filter: [All] [Deadline] [Event]│
│          [Document] [Info]       │
│                                 │
│  ┌──────────────────────────────┐│
│  │ 🔴 DEADLINE (Jan 18 - 2:30) ││
│  │ Your visa expires in 7 days  ││
│  │ [Mark as Read] [Dismiss]     ││
│  └──────────────────────────────┘│
│                                 │
│  ┌──────────────────────────────┐│
│  │ 🔵 EVENT (Jan 19 - 9:15)    ││
│  │ Class: Advanced AI Tomorrow  ││
│  │ [Mark as Read] [Dismiss]     ││
│  └──────────────────────────────┘│
│                                 │
│         [Load More...]          │
│                                 │
└─────────────────────────────────┘
```

### Notification Categories
| Type | Icon | Color | Priority |
|------|------|-------|----------|
| Deadline | 📌 | Red | High |
| Event | 📅 | Blue | Medium |
| Document | ✅ | Green | Low |
| Info | ℹ️ | Yellow | Low |

### User Flow
```
1. Click Notifications in navigation
2. See all recent notifications
3. Filter by type (optional)
4. Click notification for details
5. Mark as read
6. Or dismiss/delete
7. Clear read notifications
```

### Real-Time Updates
- Notifications push via WebSocket
- System notifies of:
  - Document uploads/rejections
  - Deadline approaching (7, 3, 1 days before)
  - Event reminders
  - System updates
  - Academic announcements

### API Integration
```
- GET /api/notifications       → Fetch user notifications
- PUT /api/notifications/:id   → Mark as read
- DELETE /api/notifications/:id → Delete notification
- WebSocket events             → Real-time push
```

---

## 🔍 Search Page

**Route:** `/search` (Protected)

### Purpose
Global search functionality to find policies, guides, faculty contacts, and knowledge base articles.

### Features
- **Multi-Category Search**:
  - Policies & Academic Regulations
  - Student Guides & FAQ
  - Faculty & Department Contacts
  - Documents & Resources
  - Locations & Services
- **Search Input**: Type to search across all categories
- **Smart Filtering**: Filter results by category
- **Result Display**: Show matching results with preview
- **Result Highlights**: Highlight search terms in results
- **Pagination**: Load more results as needed
- **Search History**: Recent searches (optional)

### Search Categories
```
1. Policies & Regulations
   - Academic Calendar
   - Grading Policy
   - Attendance Requirements
   - Course Withdrawal Policy

2. Guides & FAQ
   - New Student Guide
   - Technology Setup
   - Financial Aid FAQ
   - Visa & Immigration Guide

3. Contacts
   - Department Chairs
   - Academic Advisors
   - Student Services
   - IT Support

4. Resources
   - Course Materials
   - Research Papers
   - Study Guides
   - Templates
```

### Search Results Layout
```
┌─────────────────────────────────┐
│  SEARCH: "visa"                 │
├─────────────────────────────────┤
│                                 │
│  POLICIES & GUIDES (3 results)  │
│  • Visa and Immigration Policy  │
│    Complete guide for obtaining │
│    and renewing student visas   │
│                                 │
│  • Emergency Leave and Visa...  │
│    Process for taking emergency │
│    leave without losing ...      │
│                                 │
│  CONTACTS (2 results)           │
│  • International Student Office │
│    Specializes in visa issues   │
│    Phone: +1-555-0456           │
│                                 │
│  DOCUMENTS (1 result)           │
│  • Visa Application Checklist   │
│    PDF - 2.5 MB                 │
│    [Download]                   │
│                                 │
└─────────────────────────────────┘
```

### Search Algorithm
```
1. Receive search query
2. Convert to lowercase
3. Search in all categories:
   - Title matching (highest priority)
   - Content matching (medium priority)
   - Keyword matching (lowest priority)
4. Rank results by relevance
5. Display grouped by category
6. Show snippets with search term highlighted
```

### User Flow
```
1. Navigate to Search page
2. Enter search term (e.g., "visa")
3. Results appear automatically
4. Browse results by category
5. Click result to open details
6. Or filter to specific category
7. View more results
```

### Search Query Examples
```
✓ "visa extension"
✓ "course registration"
✓ "health insurance"
✓ "library hours"
✓ "academic advisor"
✓ "grading policy"
```

### Technical Details
- Uses full-text search on backend
- RAG system indexes all documents
- Results ranked by relevance score
- Supports fuzzy matching (typo tolerance)
- Debounced search input (500ms delay)

---

## 📊 Dashboard Page

**Route:** `/dashboard` (Protected)

### Purpose
Executive overview and analytics dashboard showing academic progress and key metrics.

### Features
- **Academic Progress**: Credit accumulation, GPA, courses completed
- **Document Tracking**: Visual progress of mandatory documents
- **Calendar Integration**: Upcoming important dates
- **Quick Stats**:
  - Total credits earned
  - Current semester credits
  - GPA
  - Courses completed / remaining
- **Attendance Overview**: Class attendance summary
- **Grade Distribution**: Visualization of grades received
- **Recommendations Saved**: List of previously generated recommendations
- **Analytics Charts**: Visual representations of progress

### Dashboard Sections

#### Section 1: Academic Summary
```
┌─────────────────────────────────┐
│  YOUR ACADEMIC PROGRESS         │
├─────────────────────────────────┤
│                                 │
│  Program: AI MSc                │
│  Year: 2 of 2                   │
│  Status: Good Standing          │
│                                 │
│  Total Credits: 24 / 36         │
│  ▓▓▓▓▓▓░░░░ 67% Complete       │
│                                 │
│  Current GPA: 3.8 / 4.0         │
│                                 │
└─────────────────────────────────┘
```

#### Section 2: Document Compliance
```
┌─────────────────────────────────┐
│  DOCUMENT COMPLIANCE            │
├─────────────────────────────────┤
│                                 │
│  Mandatory Docs: 5/6            │
│  ▓▓▓▓▓░ 83% Complete           │
│                                 │
│  Missing:                       │
│  • Health Insurance (URGENT)    │
│                                 │
│  Expiring Soon:                 │
│  • Visa (10 days)               │
│  • ID (30 days)                 │
│                                 │
└─────────────────────────────────┘
```

#### Section 3: Upcoming Events
```
┌─────────────────────────────────┐
│  UPCOMING EVENTS                │
├─────────────────────────────────┤
│                                 │
│  Jan 20 - Course Registration   │
│  Closes at 11:59 PM             │
│                                 │
│  Jan 25 - Spring Semester Begins│
│  First day of classes           │
│                                 │
│  Feb 10 - Midterm Exams         │
│  See schedule in course pages   │
│                                 │
└─────────────────────────────────┘
```

#### Section 4: Grade Analysis
```
┌─────────────────────────────────┐
│  GRADE DISTRIBUTION             │
│                                 │
│  A   ▓▓▓▓▓▓▓▓▓▓ (9 courses)    │
│  B   ▓▓▓ (2 courses)            │
│  C   ░ (0 courses)              │
│  D   ░ (0 courses)              │
│  F   ░ (0 courses)              │
│                                 │
│  Average: A- (3.67)             │
└─────────────────────────────────┘
```

### User Flow
```
1. Login → Navigate to Dashboard
2. See overview of academic status
3. Check document compliance
4. View upcoming events/deadlines
5. Review grade trends
6. Click sections for detailed view
7. Export report (if available)
```

### Data Visualization
- Progress bars for credit completion
- Pie charts for grade distribution
- Timeline view for upcoming events
- Status indicators for documents
- Trend lines for GPA over time

### Technical Details
- Aggregates data from multiple endpoints
- Uses charts library for visualizations
- Real-time data updates
- Caches data for performance (5-minute stale time)

---

## 🚫 Not Found Page

**Route:** `/not-found` or any undefined route

### Purpose
User-friendly error page displayed when accessing non-existent routes.

### Features
- **Clear Error Message**: "Page Not Found (404)"
- **Navigation Help**: Button to return to home
- **Illustration**: Visual representation of error
- **Helpful Suggestions**: Links to common pages

### Content
```
┌─────────────────────────────────┐
│                                 │
│    😕  Page Not Found            │
│                                 │
│    The page you're looking for  │
│    doesn't exist or has moved.  │
│                                 │
│  [← Back to Home] [Go to Chat]  │
│  [Browse Docs]  [Help & Support]│
│                                 │
└─────────────────────────────────┘
```

---

## 🔄 Page Navigation Flow

### Complete User Journey
```
LOGIN → HOME PAGE
   ↓
   ├→ Chat (Questions)
   ├→ Documents (Upload/Manage)
   ├→ Recommendations (Course Planning)
   ├→ Mandatory Docs (Compliance)
   ├→ Campus Map (Navigation)
   ├→ Notifications (Updates)
   ├→ Search (Find Info)
   └→ Dashboard (Analytics)
```

### Typical Daily Workflow
```
1. Start: Login Page
2. Review: Home Page (see overview)
3. Check: Notifications (new alerts?)
4. Action 1: Upload Documents
5. Action 2: Ask Chat (quick question)
6. Check: Mandatory Docs (compliance status)
7. Exit: See you next time!
```

---

## 📱 Responsive Design

All pages are designed to work seamlessly on:
- Desktop (1920px+)
- Tablet (768px - 1024px)
- Mobile (320px - 767px)

Mobile-optimized features:
- Touch-friendly buttons (min 44px)
- Vertical scrolling layout
- Simplified navigation
- Mobile-optimized forms

---

## ♿ Accessibility Features

All pages include:
- ARIA labels for screen readers
- Keyboard navigation support
- Color contrast compliance (WCAG AA)
- Focus indicators
- Semantic HTML
- Alt text for images

---

## 🌐 Multi-Language Support

All pages support:
- English
- German
- Spanish
- French
- Chinese (Simplified & Traditional)
- Arabic

Language selection available in:
- User preferences
- Registration form
- Navigation menu

---

## 📞 Support & Help

For each page, users can access:
- **In-page Help**: ? button with contextual help
- **FAQ**: Link to frequently asked questions
- **Contact Support**: Button to email support team
- **Knowledge Base**: Links to relevant documentation

---

## Summary

| Page | Route | Protected | Key Features |
|------|-------|-----------|--------------|
| Login | `/login` | No | Email/password auth, remember me |
| Register | `/register` | No | Create account, preferences |
| Home | `/home` | Yes | Overview, quick actions |
| Chat | `/chat` | Yes | AI chatbot, RAG responses |
| Recommendations | `/recommendations` | Yes | Course planning |
| Documents | `/documents` | Yes | Upload, track documents |
| Mandatory Docs | `/mandatory-docs` | Yes | Compliance tracking |
| Map | `/map` | Yes | Campus navigation |
| Notifications | `/notifications` | Yes | Updates, alerts |
| Search | `/search` | Yes | Global search |
| Dashboard | `/dashboard` | Yes | Analytics, progress |

---

**Last Updated:** January 2025  
**Version:** 1.0  
**Author:** AI Development Team
