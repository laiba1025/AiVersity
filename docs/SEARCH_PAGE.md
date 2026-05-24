# Search Page Documentation

## Purpose
The Search page provides a unified interface for students to quickly look up policy/guideline snippets and faculty / staff contacts relevant to informatics and computing. It combines live backend search results (when a query is submitted) with sensible default content so the page is always useful, even before the first search.

## Scope
This documentation covers ONLY the Search page user-facing behavior: query input, result types, loading states, and defaults. It does not describe underlying server implementation details beyond what is surfaced in the page.

## Key Objectives
- Offer immediate value without a query (default curated policies + filtered contacts)
- Allow fast keyword searches over policies/guides stored server-side
- Surface department contacts with structured details (role, email, office, hours)
- Keep interaction latency low and feedback clear (spinner + empty states)

## Components Involved
- Input field (keyword entry)
- Submit button (triggers search)
- Loading indicator (animated icon + text)
- Policies & Guides results column
- Faculty Contacts results column
- Default fallback content when no query has been run

## User Flow
1. Page loads with default policy snippets and a filtered set of informatics‑related contacts.
2. User types a query (e.g., "thesis deadlines" or "attendance policy").
3. User presses Enter or clicks Search.
4. Page enters a loading state; previous results remain visible until replaced.
5. On success: results sections refresh with matched policy snippets and contact entries.
6. On failure: an error state (currently implicit via console / could be extended) and defaults persist.

## Query Behavior
- Blank submissions are ignored (must contain at least one non-whitespace character).
- Each search issues a GET request to `/api/search?q=<encoded>`.
- Query results do NOT accumulate; each search replaces the current dataset.

## Result Types
### Policies & Guides
Each item displays:
- Snippet: a short descriptive or matched text segment.
- Source (optional): origin reference if provided by backend.
- Page (optional): page number for context when sourced from PDFs.

### Faculty Contacts
Each item displays:
- Name
- Role and Department
- Email (clickable mailto link)
- Optional: phone, office room, office hours
- Tags (rendered as subtle pills) if provided

## Default Content (No Query Yet)
- Policies: Five curated snippets offering baseline awareness (code of conduct, academic integrity, assessment, attendance, thesis guidelines).
- Contacts: Up to six filtered results from `/api/contacts` selected via a heuristic (department/role text matching informatics keywords).

## Loading State
- Shows animated spinner icon with caption "Searching…".
- Replaces the grid only while the search request is in flight.

## Empty States
- Policies section: "No results" when `results.policies` is empty post-search.
- Contacts section: "No contacts" when `results.contacts` is empty post-search.

## Interactivity & Accessibility
- Search input is focusable and supports pressing Enter to submit.
- Button labeled "Search" provides clear action for mouse/touch users.
- Email and phone values use semantic anchors (`mailto:` / `tel:`) enabling device integration.
- Tags are presented visually without required interaction—pure metadata.

## Visual Structure
- Two-column responsive grid (single column on small screens, dual on medium+).
- Cards group individual results; metadata (source/page) appears in subdued styling.
- Contacts emphasize contactability (email link), reinforced by structured fields.

## Output Summary
After a successful query the page presents:
- A list (0..N) of policy snippet cards with optional source/page metadata.
- A list (0..N) of matching contacts including structured communication info.
If either list is empty, an explicit empty message is shown.

## Error Handling (Current Behavior)
- If `/api/search` responds with non-OK status the query fails; the hook throws an error internally.
- The UI presently falls back to default content (no explicit banner). Enhancement opportunity: add user-visible error notice.

## Non-Goals
- Full-text document preview
- In-place editing of contacts or policies
- Advanced faceted filtering (semester, category, etc.)
- Persisting search history

## Metrics & Quality Considerations
- Time to first useful view (defaults render immediately)
- Query latency (network response time until new results replace defaults)
- Result relevance (returned snippets should closely align with keywords)

## Extension Points (Optional Future Enhancements — Informational Only)
- Highlight matched terms within snippets
- Add category filters (e.g., "Exam", "Thesis", "Enrollment")
- Pagination for large result sets
- Sort controls (e.g., relevance vs. recency)
- Inline contact actions (schedule meeting, copy email)

## File References
- Page component: `client/src/pages/search.tsx`
- Hook logic: `client/src/hooks/use-search.ts`

## Minimal Example Interaction
1. Navigate to Search page → see default policies and contacts.
2. Enter "thesis" → press Search.
3. Policies column updates: snippet(s) including thesis guidelines and any source metadata.
4. Contacts column may remain unchanged if no contact matches; otherwise filtered faculty appear.

---
**Last Updated:** November 18, 2025
