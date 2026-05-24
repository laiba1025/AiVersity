# Course Recommendation System

## Overview

For updated, end-to-end system visuals (context, flows, and sequences), see `docs/SYSTEM_DIAGRAMS.md`.

The Campus Companion platform implements an intelligent **course recommendation system** that helps students plan their academic journey. The system provides personalized course suggestions based on the student's academic profile, completed courses, and program requirements. The recommendation engine operates through two distinct pathways:

1. **Chat-Based Recommendations** – Conversational AI-powered recommendations triggered via natural language queries in the chat interface
2. **API-Based Recommendations** – Direct programmatic recommendations accessed via dedicated endpoints

Both systems share core logic for filtering, prerequisite validation, and credit management, ensuring consistent recommendations regardless of the entry point.

---

## System Architecture

### Data Model

The recommendation system relies on several interconnected data models:

#### **Student Profile**
```typescript
{
  userId: number;           // Unique student identifier
  program: string;          // Academic program (e.g., "CS BSc", "AI MSc")
  currentSemester: number;  // Current semester number (0-based or 1-based)
  major?: string;           // Optional specialization
  curriculum?: any;         // Optional curriculum metadata
}
```

#### **Course**
```typescript
{
  id: number;
  program: string;          // Program the course belongs to
  code: string;             // Course code (e.g., "IP-18fPROGEG")
  title: string;            // Course title
  credits: number;          // Credit value
  semester: number | null;  // Recommended semester (null = flexible)
  required: boolean;        // Is this a required course?
  elective: boolean;        // Is this an elective?
  compulsoryElective: boolean; // Is this a mandatory elective?
}
```

#### **Course Prerequisites**
```typescript
{
  id: number;
  courseId: number;         // Course that has prerequisites
  prereqCourseId: number;   // Required prerequisite course
}
```

#### **User Completed Courses**
```typescript
{
  id: number;
  userId: number;
  courseId: number;
  term?: string;            // When the course was completed
  grade?: string;           // Grade received (optional)
}
```

---

## Recommendation Pathways

### 1. Chat-Based Recommendations

**Endpoint:** `POST /api/messages`  
**Trigger:** Natural language query detection

#### Intent Detection

The system monitors chat messages for course planning queries using pattern matching:

```typescript
const asksForNextSemester = 
  /\b(next\s*semester|upcoming\s*semester)\b.*\b(course|register|enroll|take)s?/i.test(content) || 
  /\bwhich\s+courses\s+should\s+i\s+(register|take|enroll)\b/i.test(content);
```

**Example triggers:**
- "Which courses should I register for next semester?"
- "What should I take in the upcoming semester?"
- "Which courses can I enroll in next semester?"

#### Process Flow

1. **Profile Validation**
   - Retrieves the student's profile via `storage.getUserProfile(userId)`
   - Validates that `program` and `currentSemester` are set
   - If missing, prompts the student to complete their profile

2. **Data Collection**
   ```typescript
   const program = String(profile.program);
   const currentSemester = Number(profile.currentSemester) || 0;
   const nextSemester = currentSemester + 1;
   const all = await storage.getCourses(program);
   const done = await storage.getUserCompletedCourses(userId);
   const doneSet = new Set<number>(done.map(d => d.courseId));
   ```

3. **Candidate Filtering**
   
   The system creates three tiers of candidates:
   
   - **Tier 1 (Next semester courses):** Courses with `semester === nextSemester`
   - **Tier 2 (Flexible courses):** Courses with `semester === null` or `undefined`
   - **Tier 3 (Future courses):** Courses with `semester > nextSemester`
   
   All already-completed courses are excluded.

4. **Prerequisite Validation**
   
   ```typescript
   const prereqsSatisfied = async (courseId: number): Promise<boolean> => {
     const prs = await storage.getCoursePrereqs(courseId);
     return prs.every(pr => doneSet.has(pr.prereqCourseId));
   };
   ```
   
   Only courses with all prerequisites satisfied are considered eligible.

5. **Credit Cap & Selection**
   
   - Maximum credits: **30** (configurable constant `MAX`)
   - Courses are selected from the merged candidate list until the credit cap is reached
   - Each selected course includes a reason for selection:
     - Course type: `required`, `elective`, or `optional`
     - Semester placement (if applicable)

6. **Response Generation**
   
   The system formats recommendations as a bullet list:
   
   ```
   Recommended courses for semester 4 (max ~30 credits):
   - IP-18fOPREG Operating systems (3 credits) — required; semester 4
   - IP-18fAB1E Databases I (Lecture) (2 credits) — required; semester 4
   - IP-18fSZTEG Software technology (5 credits) — required; semester 4
   
   Tip: You can adjust your profile or ask for elective-heavy options.
   ```

#### Error Handling

- **No profile found:** Prompts user to set up their profile
- **Missing program/semester:** Specific error message indicating which field is missing
- **No eligible courses:** Informs the student that no courses meet all criteria
- **Exceptions:** Falls back to general RAG-based chat response

---

### 2. API-Based Recommendations

**Endpoint:** `POST /api/recommendations`  
**Purpose:** Direct programmatic access for UI components and external systems

#### Request Parameters

```typescript
{
  program: string;              // Required: Academic program
  maxCredits?: number;          // Optional: Maximum credits (default: 18)
  preferElectives?: boolean;    // Optional: Prioritize electives (default: false)
  completedCourseIds?: number[]; // Optional: Explicit completed course IDs
  targetSemester?: number;      // Optional: Target semester override
}
```

#### Process Flow

1. **Session Authentication**
   - Validates user session via `req.session.userId`
   - Ensures only authenticated users can request recommendations

2. **Semester Scope Determination**
   
   The system determines the target semester using this priority:
   
   ```typescript
   let semesterScope: number | null = null;
   
   // Priority 1: Explicit request parameter
   if (typeof targetSemester === 'number' && !isNaN(targetSemester)) {
     semesterScope = targetSemester;
   }
   // Priority 2: User's current semester from profile
   else if (sessionUserId) {
     const profile = await storage.getUserProfile(sessionUserId);
     if (profile && typeof profile.currentSemester === 'number') {
       semesterScope = profile.currentSemester;
     }
   }
   ```

3. **Completed Courses Resolution**
   
   ```typescript
   let completed = Array.isArray(completedCourseIds) 
     ? new Set<number>(completedCourseIds) 
     : undefined;
   
   // Fallback: Use session user's completed courses
   if (!completed && sessionUserId) {
     const done = await storage.getUserCompletedCourses(sessionUserId);
     completed = new Set<number>(done.map(d => d.courseId));
   }
   ```

4. **Candidate Filtering**
   
   Two-stage filtering:
   
   **Stage 1:** Exclude completed courses
   ```typescript
   let remaining = all.filter(c => !completed.has(c.id));
   ```
   
   **Stage 2:** Restrict to semester scope (if provided)
   ```typescript
   if (typeof semesterScope === 'number') {
     remaining = remaining.filter(c => c.semester === semesterScope);
   }
   ```

5. **Prerequisite Validation**
   
   ```typescript
   const prereqsSatisfied = async (courseId: number): Promise<{ ok: boolean; missing: number[] }> => {
     const prereqs = await storage.getCoursePrereqs(courseId);
     const missing = prereqs.map(pr => pr.prereqCourseId)
                           .filter(id => !completed.has(id));
     return { ok: missing.length === 0, missing };
   };
   ```

6. **Scoring & Prioritization**
   
   Each eligible course receives a composite score:
   
   ```typescript
   let score = 0;
   const tags: string[] = [];
   
   if (c.required) {
     score += 100;
     tags.push('required');
   }
   
   if (c.elective) {
     score += preferElectives ? 80 : 10;
     tags.push('elective');
   }
   
   // Earlier semesters score higher
   if (typeof c.semester === 'number') {
     score += Math.max(0, 10 - c.semester);
   }
   
   // Small bonus for credit value
   score += c.credits;
   ```
   
   **Sorting order:**
   1. Score (descending)
   2. Required courses first
   3. Semester (ascending)

7. **Credit-Based Selection**
   
   ```typescript
   const picked: Array<Recommendation> = [];
   let total = 0;
   
   for (const s of scored) {
     // Skip if adding this course exceeds the limit
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
   ```

8. **Response Format**
   
   ```json
   {
     "program": "CS BSc",
     "maxCredits": 18,
     "totalCredits": 17,
     "semester": 3,
     "recommendations": [
       {
         "id": 42,
         "code": "IP-18fWPEG",
         "title": "Web programming",
         "credits": 4,
         "required": true,
         "elective": false,
         "semester": 3,
         "reason": "Prerequisites satisfied; required; semester 3; 4 credits"
       },
       // ... more courses
     ]
   }
   ```

---

## Storage Layer

### Data Access Methods

The recommendation system relies on the following storage methods:

#### **Profile Management**

```typescript
// Retrieve user's academic profile
getUserProfile(userId: number): Promise<UserProfile | undefined>

// Update profile (includes auto-marking logic for completed courses)
setUserProfile(userId: number, profile: ProfileData): Promise<UserProfile>
```

#### **Course Data**

```typescript
// Get all courses (optionally filtered by program)
getCourses(program?: string): Promise<Course[]>

// Get prerequisites for a specific course
getCoursePrereqs(courseId: number): Promise<CoursePrerequisite[]>
```

#### **Completion Tracking**

```typescript
// Get user's completed courses
getUserCompletedCourses(userId: number): Promise<UserCompletedCourse[]>

// Mark a course as completed
createUserCompletedCourse(data: CompletedCourseData): Promise<UserCompletedCourse>

// Unmark a completed course
deleteUserCompletedCourse(userId: number, courseId: number): Promise<boolean>
```

### Auto-Marking Logic

When a student updates their profile with a new `currentSemester`, the system automatically marks courses as completed based on:

- Course semester ≤ `currentSemester - 1`
- Course is **required** OR (course is **elective** AND **compulsoryElective**)

This automation reduces manual data entry for students progressing through their program.

---

## Prerequisite Validation

### Algorithm

The system validates prerequisites using a depth-first check:

1. Retrieve all prerequisites for the target course via `getCoursePrereqs(courseId)`
2. Check if each prerequisite's `prereqCourseId` exists in the completed courses set
3. Return `true` only if **all** prerequisites are satisfied

### Example

**Course:** `IP-18fAA2E` (Algorithms and data structures II)  
**Prerequisites:** `IP-18fAA1E` (Algorithms and data structures I)

```typescript
const prereqs = await storage.getCoursePrereqs(42); // courseId for AA2E
// Returns: [{ id: 1, courseId: 42, prereqCourseId: 38 }]

const completed = new Set([15, 22, 38, 41]); // Student has completed AA1E (id: 38)

const satisfied = prereqs.every(pr => completed.has(pr.prereqCourseId));
// Returns: true (38 is in the completed set)
```

---

## Credit Management

### Default Limits

- **Chat-based recommendations:** 30 credits maximum
- **API-based recommendations:** 18 credits default (configurable via `maxCredits` parameter)

### Selection Logic

The system uses a **greedy algorithm** to maximize credit utilization:

1. Sort eligible courses by priority score
2. Iterate through the sorted list
3. Add each course if:
   - Adding it won't exceed the credit limit
   - All prerequisites are satisfied
4. Stop when:
   - Credit limit is reached, OR
   - No more eligible courses remain

This ensures students receive a balanced course load that respects academic workload limits.

---

## Frontend Integration

### Chat Interface

**File:** `client/src/pages/chat.tsx`

The chat component displays recommendations as formatted bullet lists:

```typescript
// Detects bullet points in AI responses
const renderContent = (text: string): React.ReactNode => {
  const lines = text.split('\n');
  const bulletPattern = /^\s*[-•]\s+(.+)/;
  
  // Renders each line as a list item if it matches bullet pattern
  return lines.map((line, idx) => {
    const match = line.match(bulletPattern);
    if (match) {
      return <li key={idx}>{match[1]}</li>;
    }
    return <p key={idx}>{line}</p>;
  });
};
```

### Recommendations Page

**File:** `client/src/hooks/use-recommendations.ts`

Direct access to the API endpoint:

```typescript
const useRecommendations = () => {
  const [program, setProgram] = useState<string>('CS BSc');
  const [maxCredits, setMaxCredits] = useState<number>(18);
  const [preferElectives, setPreferElectives] = useState<boolean>(false);

  const { mutateAsync, isPending } = useMutation({
    mutationFn: async () => {
      const resp = await apiRequest('POST', '/api/recommendations', {
        program,
        maxCredits,
        preferElectives
      });
      return resp.json();
    }
  });

  return { program, setProgram, maxCredits, setMaxCredits, run: mutateAsync };
};
```

---

## Example Scenarios

### Scenario 1: New Student (Semester 1)

**Profile:**
- Program: CS BSc
- Current Semester: 1
- Completed Courses: None (semester 0 preparatory courses auto-marked)

**Recommendation Request:**
```json
POST /api/recommendations
{
  "program": "CS BSc",
  "targetSemester": 1,
  "maxCredits": 30
}
```

**System Behavior:**
1. Filters courses where `semester === 1`
2. Excludes semester 0 preparatory courses (already completed)
3. No prerequisite restrictions (semester 1 courses typically have no prerequisites)
4. Selects required courses totaling ≤30 credits

**Sample Response:**
```json
{
  "program": "CS BSc",
  "semester": 1,
  "totalCredits": 29,
  "recommendations": [
    {
      "code": "IP-18fSZGREG",
      "title": "Computer systems",
      "credits": 5,
      "required": true,
      "semester": 1
    },
    {
      "code": "IP-18fPROGEG",
      "title": "Programming",
      "credits": 6,
      "required": true,
      "semester": 1
    },
    // ... more courses
  ]
}
```

---

### Scenario 2: Mid-Program Student (Semester 3)

**Profile:**
- Program: CS BSc
- Current Semester: 3
- Completed Courses: All semester 1 & 2 required courses

**Chat Query:** "Which courses should I register for next semester?"

**System Behavior:**
1. Detects intent via pattern matching
2. Retrieves profile: `currentSemester = 3`, `nextSemester = 4`
3. Filters courses where `semester === 4` OR `semester === null`
4. Validates prerequisites against completed semester 1-2 courses
5. Selects courses up to 30 credits

**Chat Response:**
```
Recommended courses for semester 4 (max ~30 credits):
- IP-18fOPREG Operating systems (3 credits) — required; semester 4
- IP-18fAB1E Databases I (Lecture) (2 credits) — required; semester 4
- IP-18fAB1G Databases I (Practice) (2 credits) — required; semester 4
- IP-18fSZTEG Software technology (5 credits) — required; semester 4
- IP-18fSZEA1E Fundamentals of theory of computation I (Lecture) (2 credits) — required; semester 4
- IP-18fSZEA1G Fundamentals of theory of computation I (Practice) (3 credits) — required; semester 4
- IP-18fNM1E Numerical methods (Lecture) (2 credits) — required; semester 4

Tip: You can adjust your profile or ask for elective-heavy options.
```

---

### Scenario 3: Elective-Heavy Semester

**API Request:**
```json
POST /api/recommendations
{
  "program": "CS BSc",
  "targetSemester": 5,
  "maxCredits": 18,
  "preferElectives": true
}
```

**System Behavior:**
1. Filters courses for semester 5
2. Applies higher scoring weight to elective courses (80 vs 10)
3. Still respects prerequisite requirements
4. Selects mix favoring electives

**Response Example:**
```json
{
  "recommendations": [
    {
      "code": "IP-ELECT-AI",
      "title": "Artificial Intelligence",
      "credits": 5,
      "elective": true,
      "reason": "Prerequisites satisfied; elective; semester 5; 5 credits"
    },
    // ... more electives prioritized
  ]
}
```

---

## Configuration & Customization

### Adjustable Parameters

| Parameter | Location | Default | Description |
|-----------|----------|---------|-------------|
| `MAX` (chat) | `server/routes.ts` (line ~727) | 30 | Maximum credits for chat recommendations |
| `maxCredits` (API) | Request body | 18 | Maximum credits for API recommendations |
| `preferElectives` | Request body | false | Whether to prioritize elective courses |
| `targetSemester` | Request body | user's current semester | Override semester scope |

### Score Weights

Defined in `server/routes.ts` (line ~1104):

```typescript
if (c.required) { score += 100; }           // Required courses heavily prioritized
if (c.elective) { score += preferElectives ? 80 : 10; }  // Electives conditionally boosted
if (typeof c.semester === 'number') { 
  score += Math.max(0, 10 - c.semester);    // Earlier semesters score higher
}
score += c.credits;                         // Small bonus for credit value
```

---

## Error Handling & Edge Cases

### Missing Profile Data

**Scenario:** User has no profile or incomplete profile  
**Behavior:** Prompts user to complete profile via Settings → Profile  
**Response Example:**
```
No student profile found.

Please set your profile first under Settings → Profile (program and current semester).
```

### No Eligible Courses

**Scenario:** All courses for the semester are completed or prerequisites not met  
**Behavior:** Informs user with specific message  
**Response Example:**
```
Based on your profile (program: CS BSc, current semester: 3), I couldn't find courses with prerequisites satisfied for next semester. Please verify completed courses and prerequisites.
```

### Invalid Semester

**Scenario:** `targetSemester` is negative or out of range  
**Behavior:** Filters return empty; system returns no recommendations  
**Recommended Fix:** Add validation in the endpoint to reject invalid semester values

### Credit Overflow

**Scenario:** No combination of courses fits within credit limit  
**Behavior:** Returns partial list (as many courses as fit)  
**Note:** System doesn't guarantee reaching the exact credit limit

---

## Performance Considerations

### Database Queries

The recommendation system performs several database operations:

1. **Profile lookup:** 1 query (`getUserProfile`)
2. **Course retrieval:** 1 query (`getCourses` filtered by program)
3. **Completed courses:** 1 query (`getUserCompletedCourses`)
4. **Prerequisites:** N queries (1 per candidate course via `getCoursePrereqs`)

**Optimization Opportunity:** Consider bulk-loading all prerequisites for a program to reduce query count from N to 1.

### Caching Strategy

Currently, no caching is implemented. Consider adding:

- **Program course lists:** Cache for 1 hour (courses rarely change)
- **Prerequisite mappings:** Cache indefinitely with invalidation on curriculum updates
- **User profiles:** Session-level cache (invalidate on profile update)

---

## Testing

### Unit Tests

Recommended test coverage:

1. **Prerequisite validation:**
   - All prerequisites satisfied → eligible
   - One missing prerequisite → ineligible
   - No prerequisites → always eligible

2. **Credit limit enforcement:**
   - Courses selected don't exceed limit
   - Greedy algorithm maximizes credit utilization
   - Edge case: Single course exceeds limit → excluded

3. **Semester filtering:**
   - Correct semester scope applied
   - Null semester courses included appropriately
   - Out-of-scope semesters excluded

4. **Scoring & prioritization:**
   - Required courses ranked higher than electives
   - `preferElectives` correctly boosts elective scores
   - Earlier semesters ranked higher

### Integration Tests

Recommended scenarios:

1. **Chat intent detection:** Various phrasings trigger recommendations
2. **End-to-end chat flow:** Profile → query → formatted response
3. **API endpoint:** Valid request → structured JSON response
4. **Profile-based scoping:** User's current semester correctly applied
5. **Error handling:** Missing profile → user-friendly error message

---

## Future Enhancements

### 1. Advanced Prerequisite Modeling

- **Co-requisites:** Courses that must be taken simultaneously
- **Recommended prerequisites:** Soft prerequisites that improve success probability
- **Prerequisite alternatives:** Allow "Course A OR Course B" logic

### 2. Personalized Preferences

- **Preferred times/days:** Filter courses by schedule preferences
- **Faculty ratings:** Integrate instructor quality scores
- **Course difficulty:** Balance workload based on student capability

### 3. Multi-Semester Planning

- **Roadmap generation:** Plan entire program from current semester to graduation
- **Graduation date prediction:** Estimate completion based on current progress
- **Critical path analysis:** Identify bottleneck courses that block later courses

### 4. Machine Learning Integration

- **Success prediction:** Use historical data to predict course performance
- **Dropout risk:** Identify students at risk based on course selection patterns
- **Adaptive recommendations:** Learn from student feedback and outcomes

### 5. Enhanced UI

- **Visual course graph:** Display prerequisite chains as an interactive graph
- **Drag-and-drop planning:** Allow students to build custom semester plans
- **"What-if" scenarios:** Simulate different course selections and their impact

---

## API Reference Summary

### Chat-Based Recommendations

**Endpoint:** `POST /api/messages`  
**Content:** Natural language query containing keywords like "next semester", "register", "courses"  
**Response:** Formatted text with bullet-listed recommendations

### Programmatic Recommendations

**Endpoint:** `POST /api/recommendations`  
**Request Body:**
```typescript
{
  program: string;              // Required
  maxCredits?: number;          // Optional, default: 18
  preferElectives?: boolean;    // Optional, default: false
  completedCourseIds?: number[]; // Optional, inferred from session
  targetSemester?: number;      // Optional, inferred from profile
}
```

**Response:**
```typescript
{
  program: string;
  maxCredits: number;
  totalCredits: number;
  semester: number | null;
  recommendations: Array<{
    id: number;
    code: string;
    title: string;
    credits: number;
    required: boolean;
    elective: boolean;
    semester: number | null;
    reason: string;
  }>;
}
```

---

## Conclusion

The Campus Companion course recommendation system provides intelligent, context-aware course suggestions through two complementary pathways:

- **Chat-based** for conversational, student-friendly interactions
- **API-based** for programmatic access and UI integration

Both systems leverage the same core logic for prerequisite validation, credit management, and prioritization, ensuring consistent recommendations. The system respects academic constraints while optimizing for student success and efficient degree completion.

By tracking completed courses, validating prerequisites, and considering semester progression, the recommendation engine helps students make informed decisions about their academic path.

---

**Version:** 1.0  
**Last Updated:** November 17, 2025  
**Maintained By:** Campus Companion Development Team
