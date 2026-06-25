# Slidust — Project Context for AI Assistants

## Overview

**Slidust** is a project management web app. Frontend is React 19 + Vite, backend is CodeIgniter (PHP) + MySQL running on MAMP locally.

- Frontend repo (web app): `/Volumes/Personal Data/Dendy Dev/Slidust`  ← **edit & run dev HERE**
- Backend repo: `/Applications/MAMP/htdocs/apis.slidust.xyz`
- ⚠️ `/Applications/MAMP/htdocs/slidust` is a STALE copy — do NOT edit or run dev from there
- Frontend URL (dev): `http://localhost:5173`
- Backend API base: defined in `.env` as `VITE_API_BASE` → `http://localhost:8888/apis.slidust.xyz/index.php/api`

---

## Tech Stack

| Layer      | Technology                                      |
|------------|-------------------------------------------------|
| Frontend   | React 19, Vite 8, CSS Modules                   |
| UI Icons   | lucide-react                                    |
| Charts     | recharts                                        |
| Flow editor| @xyflow/react                                   |
| Rich text  | react-quill-new (used in SlidNote blocks)       |
| PWA        | vite-plugin-pwa (workbox)                       |
| Backend    | CodeIgniter 3, PHP, MySQL                       |
| Local env  | MAMP (Apache + MySQL)                           |

---

## Frontend Structure

```
src/
  App.jsx                    # Root: routing, modals, layout
  main.jsx                   # Entry: detects preview routes, wraps DataProvider
  context/
    DataContext.jsx           # Global state: user, projects, tasks, members, notifications
  pages/
    Login.jsx
    SlidNotePreview.jsx       # Public SlidNote share page (no auth, standalone)
    SlidNotePreview.module.css
    FlowPreview.jsx           # Public Dust Flow share page (no auth, standalone, read-only ReactFlow)
    FlowPreview.module.css
  components/
    layout/
      Header.jsx              # Top bar: search, notifications, user menu
      Sidebar.jsx             # Nav sidebar (collapsible)
    board/
      Board.jsx               # Project board (kanban, list, calendar, roadmap, stats)
      Column.jsx, TaskCard.jsx
      BoardCalendar.jsx, BoardList.jsx, BoardRoadmap.jsx
      BoardStatistic.jsx, BoardNotes.jsx, UserPerformance.jsx
      ActivityTicker.jsx      # Live activity feed in board footer
    dashboard/
      Dashboard.jsx           # Overview: tasks, activity
    myboard/
      MyBoard.jsx             # Personal task view
    drawflow/
      FlowList.jsx            # List of flow diagrams
      FlowEditor.jsx          # Flow diagram editor (@xyflow/react)
    slidnote/
      SlidNote.jsx            # Block-based document editor
    modals/
      TaskModal.jsx           # Task detail/create modal
      Modal.module.css        # Shared modal styles incl. comment thread CSS
      UserModal.jsx, ProjectModal.jsx, OrganizationModal.jsx
      WorkflowModal.jsx, DepartmentModal.jsx, PositionModal.jsx
      ProjectSettingsModal.jsx, DeleteProjectModal.jsx, DeleteTaskModal.jsx
      AddUserModal.jsx, EditUserModal.jsx
    ui/                       # Shared UI components
  utils/
    linkify.js                # linkifyHtml() — wraps URLs in <a> tags
```

---

## URL Routing (SPA, no react-router)

Routing is done manually with `window.history.pushState` and `window.addEventListener('popstate')`.

| URL                          | Page/State                   |
|------------------------------|------------------------------|
| `/`                          | Dashboard                    |
| `/myboard`                   | My Board                     |
| `/board/<project-id>`        | Board (specific project)     |
| `/flow`                      | Flow list                    |
| `/flow/<flow-id>`            | Flow editor (full-screen overlay) |
| `/flow/preview/<id>`         | Public Flow preview (no auth, standalone, read-only) |
| `/slidnote`                  | SlidNote list                |
| `/slidnote/<note-id>`        | SlidNote editor              |
| `/slidnote/preview/<id>`     | Public SlidNote preview (no auth, standalone) |
| `?task=<task-id>`            | Task modal overlay (any page) |

**Key routing logic** is in `src/App.jsx` (path parsers: `getPageFromUrl`, `getFlowIdFromUrl`, `getSlidNoteIdFromUrl`, `getProjectIdFromUrl`) and `src/main.jsx` (detects `/slidnote/preview/<id>` and `/flow/preview/<id>` before mounting DataProvider — these render standalone without `DataProvider`).

The Flow preview reuses the editor's exact node renderers via `export const nodeTypes` in `FlowEditor.jsx`, rendered in a read-only `<ReactFlow>` (no editing/selection/dragging).

**Apache SPA fallback**: `public/.htaccess` rewrites all non-file paths to `index.html`.

---

## Backend Structure

```
apis.slidust.xyz/application/
  config/
    routes.php                # All API routes registered here
  controllers/
    api/
      Login.php
      Users.php
      Projects.php
      Tasks.php
      Comments.php
      Attachments.php
      Notifications.php
      Project_members.php
      Notes.php               # Board notes (per project)
      Slid_note.php           # SlidNote CRUD (auth required)
      Slid_note_public.php    # SlidNote public read JSON (no auth, extends MY_Controller)
      Slid_note_share.php     # SlidNote share HTML page w/ dynamic OG meta (no auth) → /note/{id}
      Share.php               # Task share HTML page w/ dynamic OG meta (no auth) → /share/{taskId}
      Task_Share.php          # Task public read JSON (no auth) → /api/tasks/share/{taskId}
      Flows.php
      Flows_public.php        # Flow public read JSON (no auth) → /api/flows/public?id={id}, public visibility only
      Dust_write.php
      Workflows.php
      Organizations.php
      Departments.php
      Positions.php
      Upload.php
      Task_History.php
      Setup.php
  models/
    Task_Model.php
    Comment_Model.php         # includes getAuthorById($id)
    Notification_Model.php    # create($toUserId, $taskId, $taskTitle, $projectId, $fromUserId, $type, $excerpt)
    SlidNote_Model.php
    Flow_Model.php
    User_Model.php
    Project_Model.php
    ... (see models/ dir)
```

### Auth pattern
- `API_Controller` (base class for most controllers) calls `requireAuth()` in constructor — validates Bearer token.
- `MY_Controller` is the base class without auth — used for public endpoints like `Slid_note_public.php`.

### Notification types
- `'mention'` — user was @mentioned in a comment
- `'reply'` — user's comment was replied to

### Share pages & dynamic OG meta (server-rendered)

Social crawlers (WhatsApp / X / Facebook / Slack) **do not execute JS**, so the
static React SPA's client-side OG tags are invisible to them. Shareable content
is therefore served from dedicated **backend PHP pages** that render OG meta tags
per-content server-side, then redirect real browsers into the app.

| Share URL (backend)        | Controller            | OG content (follows the actual content) | Redirects to |
|----------------------------|-----------------------|------------------------------------------|--------------|
| `/share/{taskId}`          | `Share.php`           | title, description, `og:image` = first image attachment (`file_type LIKE 'image/%'`) | `{app}/?task={id}&shared=1` |
| `/note/{noteId}`           | `Slid_note_share.php` | title, description (first paragraph), `og:image` = first `image` block or first `slider` image | `{app}/slidnote/preview/{id}` |

- Both routes registered in `application/config/routes.php` (`share/(:any)`, `note/(:any)`).
- `og:image` uses an absolute URL: `base_url + 'uploads/...'` (same resolution as the frontend `resolveMediaUrl`). When an image is present they emit `twitter:card = summary_large_image`, otherwise `summary`.
- `/note/{id}` only serves notes with `visibility = 'public'`.
- Test previews with the [Facebook Sharing Debugger](https://developers.facebook.com/tools/debug/) against the **production** URL (local MAMP lacks the uploaded files).

> **Current UI behavior:** the copy-link buttons emit **clean frontend URLs**, not the
> backend share pages — `getTaskUrl()` in `TaskModal.jsx` → `{origin}/board/{projectId}?task={taskId}`,
> `copyShareLink()` in `SlidNote.jsx` → `{origin}/slidnote/preview/{id}`,
> `handleCopyLink()` in `FlowEditor.jsx` → `{origin}/flow/preview/{id}`. The backend OG share
> pages above still exist and work, but are not currently wired to the copy buttons (kept for
> when rich link previews are re-enabled).

### Public sharing (no-auth JSON read endpoints)

Standalone preview pages fetch read-only JSON from public, no-auth controllers
(`MY_Controller`, not `API_Controller`) that only return content with `visibility = 'public'`:

| Preview page (frontend)      | Fetches                          | Controller            |
|------------------------------|----------------------------------|-----------------------|
| `/slidnote/preview/{id}`     | `/api/slid_note/public?id={id}`  | `Slid_note_public.php` |
| `/flow/preview/{id}`         | `/api/flows/public?id={id}`      | `Flows_public.php` (strips `editor_ids`, adds `owner_name`/`owner_avatar`) |

---

## Key Data Models

### Task
Fields: `id`, `title`, `description`, `status`, `priority`, `project_id`, `assigned_to`, `due_date`, `created_by`, `created_at`, `updated_at`

### Comment
Fields: `id`, `task_id`, `user_id`, `message`, `parent_id` (null = top-level, set = reply), `created_at`

### SlidNote
Fields: `id`, `title`, `content` (JSON string of blocks array), `visibility` (`'private'`|`'public'`), `owner_id`, `created_at`, `updated_at`

#### SlidNote Block Types (content JSON structure)
```js
// paragraph
{ id, type: 'paragraph', html: '<p>...</p>' }

// image
{ id, type: 'image', url: 'uploads/...' | 'https://...', caption: '' }

// video
{ id, type: 'video', url: 'https://youtube.com/...' | 'uploads/...', caption: '' }

// table
{ id, type: 'table', cells: [['<html>', '<html>'], ...], colWidths: ['120px', ...], rowHeights: ['40px', ...] }
// cells is a 2D array (rows × cols) of HTML strings
// first row is treated as header (bold, grey bg) in preview

// slider
{ id, type: 'slider', images: ['uploads/img1.jpg', 'https://...', ...] }
// images is a flat array of URL strings
```

---

## CSS Conventions

- All styles use **CSS Modules** (`Component.module.css`).
- CSS variables defined in `src/index.css`:
  - `--color-primary` (blue)
  - `--bg-surface`, `--bg-hover`
  - `--text-main`, `--text-muted`
  - `--border-color`
  - `--header-height`, `--sidebar-width`

### Comment Thread Connector (Modal.module.css)
L-shaped connector between parent and reply bubbles:
```css
/* Quarter-circle L-bend at top of each reply bubble */
.replyBubble::before {
  content: '';
  position: absolute;
  left: -30px;
  top: 0;
  width: 30px;
  height: 12px;
  border-left: 2px solid var(--border-color);
  border-bottom: 2px solid var(--border-color);
  border-radius: 0 0 0 12px;
  box-sizing: border-box;
}
/* Vertical line connecting siblings (not last child) */
.replyBubble:not(:last-child)::after {
  content: '';
  position: absolute;
  left: -30px;
  top: 0;
  bottom: -8px; /* bridges the 8px flex gap */
  width: 2px;
  background: var(--border-color);
}
```

---

## Utilities

### `src/utils/linkify.js`
```js
export const linkifyHtml = (html) =>
  html.replace(/(?<![="'`])(https?:\/\/[^\s<"]+)/g,
    url => `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`
  );
```
Used in: `TaskModal.jsx` (comments + description), `SlidNote.jsx` (block rendering), `SlidNotePreview.jsx` (public preview).

**Note on `contentEditable` links**: Links inside `contentEditable` divs are not natively clickable. Use an `onClick` handler:
```jsx
onClick={(e) => {
  if (e.target.tagName === 'A') {
    e.preventDefault();
    window.open(e.target.href, '_blank', 'noopener,noreferrer');
  }
}}
```

---

## DataContext (`src/context/DataContext.jsx`)

Provides global state via React context. Key values:
- `currentUser` — logged-in user object (null if not logged in)
- `projects` — array of accessible projects
- `activeProjectId` / `setActiveProjectId`
- `tasks` — tasks for active project
- `projectMembers` — members of active project
- `notifications` — user's notifications
- `users` — all users (admin/manager only)

The context reads initial `activeProjectId` from URL path (`/board/<id>`) on mount.

---

## Media URL Resolution

Uploaded files are stored relative to the backend root. Helper to resolve URLs:
```js
const resolveMediaUrl = (url) => {
  if (!url) return '';
  if (url.startsWith('http') || url.startsWith('blob:') || url.startsWith('data:')) return url;
  if (url.startsWith('uploads/')) {
    const backendRoot = API_BASE.replace(/\/index\.php\/api\/?$/, '').replace(/\/api\/?$/, '');
    return `${backendRoot}/${url}`;
  }
  return url;
};
```

---

## Development Notes

- Run frontend: `npm run dev` in `/Applications/MAMP/htdocs/slidust`
- MAMP must be running for the backend (Apache on port 8888, MySQL on port 8889)
- PWA configured via `vite-plugin-pwa` with workbox; `navigateFallback: '/index.html'` for SPA routing
- No TypeScript — plain `.jsx` throughout
- No test suite currently
- Commit style: short imperative messages in English (see git log)
