# Phase 1 — Nicholas Bailey — s5393017

## 1. Overview

This project is a full-stack, real-time chat application ("Fabulari") built on the MEAN stack
(MongoDB, Express, Angular, Node.js) using Socket.io for real-time messaging in Phase 2.
The system supports:

- Real-time text and image messaging between users
- Organisation of users into **groups**, each containing one or more **channels**
- Three permission tiers: **Super Admin**, **Group Admin**, and **Regular User**
- User, group, and channel creation via an admin-reviewed request/approval workflow

For Phase 1, the focus is the UI design of the front end for each permission level, backed by
basic user management persisted to a JSON file on the server. Full database integration,
real-time chat delivery, and image handling are deferred to Phase 2.

In the Week 2 client briefing, the client (course convenor, acting as the app's product owner)
described the app as a small-scale, desktop-first community chat tool rather than a
general-purpose messaging platform: groups are created on request and approved by a single
bootstrapped Super Admin account, group membership grants access to every channel in that
group, and the system deliberately excludes features common to larger platforms — no
friend system, no private groups, no message search, no @mentions, and no password
recovery flow (a new account is created instead). The client also specified that only the last
five messages per channel need to persist server-side, with earlier messages existing only in
each connected client's local session — this materially shapes the Phase 2 data design and is
reflected in Section 4 below.

---

## 2. Git Strategy

This project uses a **trunk-based development** strategy, chosen for its simplicity and
suitability for a small team working over a short timeframe.

**Approach:**
- `main` is the single long-lived branch and is always kept in a working state.
- Short-lived feature branches (e.g. `feature/login-ui`, `feature/group-requests`,
  `feature/chat-window-styling`) are created for any change of meaningful size, and merged
  back into `main` quickly (typically within a day or two) to avoid drift and merge conflicts.
- Trivial or low-risk changes (e.g. doc updates, small styling fixes) may be committed
  directly to `main`.
- Commits are made frequently and with descriptive messages (e.g.
  `feat: add channel creation request flow`, `fix: prevent removing last group admin`) rather
  than large, infrequent commits, to give a clear history of progress as required by the
  assignment.
- Pull requests are used for any feature branch where more than one contributor is touching
  related code, to allow review before merging.
- `.gitignore` excludes `node_modules/`, `dist/`, `.angular/`, `.env`, and OS files
  (`.DS_Store`), so build artefacts and dependencies never enter version control.
- The teaching staff member is added as a collaborator on the private GitHub repository
  before each marking milestone.

---

## 3. Specifications and Assumptions

### Functional Requirements

| ID | Requirement | Source |
|----|-------------|--------|
| FR1 | Users log in with a username and password; Phase 1 authentication is a plaintext credential check against the JSON user store (no hashing/sessions yet) | Assignment brief |
| FR2 | Super Admin can create user accounts and assign an initial role (`user`, `groupAdmin`, `superAdmin`) | Assignment brief / client meeting |
| FR3 | Only one Super Admin account exists, bootstrapped on first system setup; the Super Admin does not participate in chat and cannot see chat history | Client meeting |
| FR4 | Any user may submit a request to create a new group; only the Super Admin can approve or deny it | Client meeting; implemented in `POST /api/requests` (type `group`) and `PUT /api/requests/:id` |
| FR5 | Any group member may submit a request to create a new channel within a group they belong to; the group's admin(s) or the Super Admin approve or deny it | Client meeting; implemented as request type `channel` |
| FR6 | Group Admins (and the Super Admin) can request or action a ban / membership removal for a user within their group | Client meeting; implemented as request types `ban` and `groupRemoval` |
| FR7 | A group cannot be left with zero admins — removing the last admin from a group is blocked until a successor is appointed | Client meeting; enforced server-side in the approval handler for `ban`/`groupRemoval` |
| FR8 | Group Admins can directly add an existing user to a group or promote a member to group admin | Assignment brief; implemented via `POST /api/groups/:id/members` and `POST /api/groups/:id/admins` |
| FR9 | Regular Users can view groups, view channels within a group, and send/view messages in a channel (Phase 1: UI only, messages are client-side mock data) | Assignment brief |
| FR10 | Messages support text content; image attachment (PNG/JPG/GIF, under 2MB) is a Phase 2 requirement | Client meeting |
| FR11 | A user may delete their own messages only | Client meeting; UI control present, no server persistence yet |
| FR12 | Messages are delivered in real time via Socket.io in Phase 2; only the most recent 5 messages per channel persist server-side, with older messages held only in each client's local session | Client meeting |
| FR13 | Users, Groups, and Channels persist to a JSON file on the server for Phase 1; MongoDB replaces this in Phase 2 | Assignment brief |
| FR14 | Route access is restricted by role: `superAdminGuard` for user management, `groupAdminGuard` (Super Admin or Group Admin) for group/channel management, `authGuard` for all other authenticated views | Implemented in `auth.guard.ts` / `role.guard.ts` |

### Assumptions

| # | Assumption | Rationale |
|---|-----------|-----------|
| 1 | A user can belong to multiple groups, and each group can have multiple channels, but a channel belongs to exactly one group | Matches implemented `groupId` foreign key on channel records; keeps permission scoping simple |
| 2 | A group can have more than one Group Admin (`adminIds` is an array), and admin status is layered on top of membership rather than a separate account type | Matches implemented `group.adminIds` / `group.memberIds` structure |
| 3 | Joining an existing group currently happens by a Group Admin directly adding a member (`POST /api/groups/:id/members`), rather than via the request/approval queue used for new groups, channels, and bans | Reflects current Phase 1 implementation; to confirm with client whether "request to join an existing group" needs its own request type in Phase 2 |
| 4 | Phase 1 passwords are stored and compared in plaintext; proper hashing (bcrypt, per the client's stated minimum of 8 characters with 1 uppercase) is deferred to Phase 2 | Brief explicitly scopes Phase 1 to "very basic authentication"; client specified bcrypt + complexity rules for the finished system |
| 5 | Image messages are out of scope for the Phase 1 prototype; the message composer includes a disabled/placeholder attachment control to reflect the planned Phase 2 behaviour | Phase 1 backend is limited to user management; chat is UI-only |
| 6 | Only the 5 most recent messages per channel need structured server-side persistence; anything beyond that is not guaranteed to survive a page refresh unless the client already has it in memory | Explicit client requirement from the Week 2 briefing |
| 7 | Deleting a user entirely from the system (as opposed to removing them from a group) is a Super-Admin-only action, distinct from the `ban`/`groupRemoval` request types already implemented | Client meeting: "only the super admin can delete a user from the system" |

---

## 4. Data Structures

> These reflect the current Phase 1 JSON file structures (`backend/DATA FOR THE APP PHASE 1/`),
> which map directly onto the planned Mongoose schemas for Phase 2.

### User (`user.json`)
```
{
  id: Number,
  username: String,          // unique
  password: String,          // Phase 1: plaintext; Phase 2: bcrypt hash, min 8 chars + 1 uppercase
  age: Number,                // self-reported; used against a group's ageLimit
  role: "superAdmin" | "groupAdmin" | "user"
}
```

### Group (`groups.json`)
```
{
  id: Number,
  name: String,               // unique, set at creation, not editable afterwards
  description: String,        // editable by group admin
  ageLimit: Number,           // editable by group admin
  adminIds: [Number],         // userIds who administer this group
  memberIds: [Number]         // userIds who are members of this group
}
```

### Channel (`channels.json`)
```
{
  id: Number,
  groupId: Number,            // parent group
  name: String,                // unique within its parent group
  description: String,
  memberIds: [Number]          // inherits from group membership at creation time
}
```

### Request (`requests.json`)
```
{
  id: Number,
  type: "group" | "channel" | "ban" | "groupRemoval",
  requesterId: Number,
  groupId: Number | null,      // required for channel / ban / groupRemoval
  targetUserId: Number | null, // required for ban / groupRemoval
  name: String,                 // proposed group/channel name, where relevant
  description: String,
  ageLimit: Number,
  reason: String,
  status: "pending" | "approved" | "denied",
  createdAt: ISODateString,
  reviewedAt: ISODateString | null,
  reviewedBy: Number | null     // reviewing user's id
}
```

### Message (planned for Phase 2 — currently client-side mock data only)
```
{
  id: Number,
  channelId: Number,
  senderId: Number,
  type: "text" | "image",
  content: String,             // text content or image reference
  timestamp: Date
}
```
Only the most recent 5 messages per channel are expected to be retained server-side in
Phase 2, per the client's stated persistence requirement; the UI's local message list already
mimics this by holding the running conversation client-side for Phase 1.

---

## 5. Proposed Angular Architecture

### Components (implemented in Phase 1)
| Component | Purpose |
|-----------|---------|
| `Login` | Username/password login form; posts to `/api/login` and stores the returned user in `localStorage` |
| `Dashboard` | Landing page after login; links out to groups, channels, and profile |
| `Navbar` | Top-level navigation; conditionally renders Group Management, Channel Management, and User Management links based on `currentUser.role` |
| `GroupList` | Displays all groups, with actions to view channels or request to join |
| `GroupManagement` | Group/Super Admin view: create a group, add a member, assign a group admin |
| `ChannelList` | Displays channels within a selected group |
| `ChannelManagement` | Group/Super Admin view: create a channel, assign a user to a channel |
| `ChatWindow` | Displays messages in a channel (currently mock data) and a message composer; own messages can be deleted |
| `Profile` | Displays the current user's username, age, and role |
| `UserManagement` | Super Admin view: create a user with a chosen role |
| `Requests` | Submit new group/channel/ban requests, and (for admins) review pending requests |

### Services (planned refactor for Phase 2)
Phase 1 components currently call `HttpClient` directly and read/write `currentUser` from
`localStorage` in each component that needs it (e.g. `Navbar`, `ChatWindow`). This is
workable for a small prototype but duplicates logic across components. For Phase 2 this
should be consolidated into:

| Service | Purpose |
|---------|---------|
| `AuthService` | Wraps login/logout, exposes the current user as an observable, replacing scattered `localStorage` reads |
| `UserService` | CRUD calls to `/api/users` |
| `GroupService` | CRUD calls to `/api/groups` and its membership/admin sub-routes |
| `ChannelService` | CRUD calls to `/api/channels` and group-scoped channel routes |
| `RequestService` | Calls to `/api/requests` (create, list, approve/deny) |
| `MessageService` | Sends/receives messages; wraps `SocketService` once real-time delivery is added |
| `SocketService` | Wraps the Socket.io client connection and event handling (Phase 2) |

### Models (interfaces)
- `User { id, username, role, age }`
- `Group { id, name, description, ageLimit, adminIds, memberIds }`
- `Channel { id, groupId, name, description, memberIds }`
- `Request { id, type, requesterId, groupId, targetUserId, name, description, ageLimit, reason, status, createdAt, reviewedAt, reviewedBy }`
- `Message { id, channelId, senderId, type, content, timestamp }` (Phase 2)

### Routes (implemented)
| Path | Component | Guard |
|------|-----------|-------|
| `/login` | Login | — |
| `/dashboard` | Dashboard | `authGuard` |
| `/groups` | GroupList | `authGuard` |
| `/groups/manage` | GroupManagement | `groupAdminGuard` (Super Admin or Group Admin) |
| `/channels/:groupId` | ChannelList | `authGuard` |
| `/channels/manage` | ChannelManagement | `groupAdminGuard` |
| `/chat/:groupId/:channelId` | ChatWindow | `authGuard` |
| `/profile` | Profile | `authGuard` |
| `/user-management` | UserManagement | `superAdminGuard` |
| `/requests` | Requests | `authGuard` |
| `**` | redirects to `/dashboard` | — |

`authGuard` checks for a `currentUser` entry in `localStorage`. `roleGuard(allowedRoles)` is a
guard factory that checks the stored user's `role` against a permitted list, producing
`superAdminGuard` (`superAdmin` only) and `groupAdminGuard` (`superAdmin` or `groupAdmin`).

---

## 6. Proposed Server Endpoints

All endpoints below are implemented in `backend/server.js` for Phase 1 against the JSON
data files; Phase 2 will move this logic behind Mongoose models without changing the
external API shape where possible.

| Method | Endpoint | Purpose | Access |
|--------|----------|---------|--------|
| GET | `/` | Health check | Public |
| POST | `/api/login` | Authenticate a user by username/password | Public |
| GET | `/api/users` | List all users (passwords excluded from the response) | Authenticated (intended: Super Admin) |
| POST | `/api/users` | Create a new user | Super Admin |
| GET | `/api/groups` | List all groups | Authenticated |
| GET | `/api/groups/:groupId` | Get a single group | Authenticated |
| POST | `/api/groups` | Create a group directly | Super Admin |
| POST | `/api/groups/:groupId/members` | Add an existing user to a group | Group Admin / Super Admin |
| POST | `/api/groups/:groupId/admins` | Promote a member to group admin | Super Admin |
| GET | `/api/channels` | List all channels | Authenticated |
| GET | `/api/groups/:groupId/channels` | List channels belonging to a group | Authenticated |
| POST | `/api/channels` | Create a channel directly | Group Admin / Super Admin |
| POST | `/api/channels/:channelId/members` | Add a user to a channel | Group Admin / Super Admin |
| GET | `/api/requests` | List requests, filterable by `status`, `reviewerId` (returns only requests that reviewer is permitted to see), or `requesterId` | Authenticated |
| POST | `/api/requests` | Submit a request (`group`, `channel`, `ban`, or `groupRemoval`) | Authenticated |
| PUT | `/api/requests/:requestId` | Approve or deny a pending request; applies the resulting group/channel/membership change server-side | Super Admin, or Group Admin of the relevant group |

**Not yet implemented (planned for Phase 2):**
- `DELETE /api/users/:id` — Super-Admin-only full account deletion, with the "reassign the last group admin first" rule enforced
- `DELETE /api/groups/:id`, `DELETE /api/channels/:id`
- `GET/POST /api/channels/:id/messages` — likely superseded by Socket.io events rather than REST once real-time delivery lands
- Socket.io events: `connect`, `joinChannel`, `sendMessage`, `receiveMessage`, `userJoined`, `userLeft`, `disconnect`
- An audit log endpoint for the Super Admin to review administrative actions (creations, approvals, bans), per the client's requirement that all admin actions be logged and filterable

---

## 7. Design Documents

The Phase 1 prototype implements one screen per role-relevant function, all sharing a common
`Navbar` component that reveals or hides links based on the logged-in user's role. Each
screen below is implemented and running in the Angular app under `src/app/components/`.

- **Login (`/login`)** — centred card with username/password fields, a submit button, and an
  inline error state on failed credentials. No navbar (unauthenticated).
- **Dashboard (`/dashboard`)** — all roles. A welcome header plus a card grid linking to
  Groups, Channels, and Profile. Grid collapses from 3 columns to 1 as viewport narrows
  (`auto-fit, minmax(240px, 1fr)`), so no separate mobile layout is required.
- **Group List (`/groups`)** — all roles. Card-per-group layout showing member/channel
  counts, a "View Channels" action, and a "Request to Join" action for non-members. Cards
  reflow using `auto-fill, minmax(280px, 1fr)`.
- **Channel List (`/channels/:groupId`)** — all roles. Card-per-channel layout within a
  group, each linking into that channel's chat window.
- **Chat Window (`/chat/:groupId/:channelId`)** — all roles. Message list with sender
  avatar, name, and timestamp; a message composer with a text input and (disabled/placeholder)
  attachment button; own messages carry a delete control.
- **Profile (`/profile`)** — all roles. Read-only card showing username, age, and role.
- **Group Management (`/groups/manage`)** — Group Admin / Super Admin only. Forms to
  create a group, add a member to a group, and assign a group admin.
- **Channel Management (`/channels/manage`)** — Group Admin / Super Admin only. Forms to
  create a channel within a group and assign a user to it.
- **User Management (`/user-management`)** — Super Admin only. Form to create a user with
  a selected role, plus a review queue for pending requests and a list of existing users.
- **Requests (`/requests`)** — all roles submit new group/channel/ban requests here; admins
  see and action the requests they're permitted to review, returned pre-filtered by
  `GET /api/requests?reviewerId=`.

**Responsive approach:** the app is primarily designed desktop-first (per the client's stated
scale of ~10 concurrent users, with no dedicated mobile client planned), but every grid-based
page (Dashboard, Group List, Channel List) uses CSS Grid with `auto-fit`/`auto-fill` and
`minmax()` so columns collapse gracefully down to a single column on narrower viewports as a
bonus, without a separate breakpoint-driven layout. The management pages (`GroupManagement`,
`ChannelManagement`, `UserManagement`) additionally define an explicit `@media (max-width:
650px)` breakpoint that stacks two-column form rows and side-by-side request/user rows into a
single column.

*[Insert screenshots of each running screen here — one per role/screen combination listed
above — with a one-line caption. Since the UI is already implemented, screenshots from the
running app are preferable to hand-drawn wireframes and better demonstrate the responsive
behaviour described above at a couple of viewport widths.]*

---

## Notes for Phase 2

- Replace the JSON file data layer with MongoDB/Mongoose models mirroring the structures in
  Section 4.
- Implement Socket.io for real-time message delivery, join/leave notifications, and live
  message deletion broadcast to anyone viewing the channel.
- Add bcrypt password hashing (minimum 8 characters, 1 uppercase) and drop plaintext
  password comparison from `/api/login`.
- Add image upload support (PNG/JPG/GIF, under 2MB) to the message composer.
- Add the missing Super-Admin-only "delete user from system" endpoint, enforcing that a group
  cannot be left without an admin.
- Add an admin action audit log (CRUD-style), filterable by the Super Admin.
- Extract the services listed in Section 5 out of individual components to remove duplicated
  `HttpClient`/`localStorage` logic.
- Decide whether "request to join an existing group" needs its own request type, or whether
  direct admin-add (current behaviour) is the intended final flow (see Assumption 3).