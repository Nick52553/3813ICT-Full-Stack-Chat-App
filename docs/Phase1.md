# Phase 1 — Nicholas bailey — s5393017 

## 1. Overview

This project is a full-stack, real-time chat application built on the MEAN stack
(MongoDB, Express, Angular, Node.js) using Socket.io for real-time messaging. The system
supports:

- Real-time text and image messaging between users
- Organisation of users into **groups** and **channels**
- Three permission tiers: **Super Admin**, **Group Admin**, and **Regular User**
- User creation requests and administrative management of groups/channels

For Phase 1, the focus is on requirements elicitation, architectural design, and a working
UI prototype for each permission level, with basic user/group/channel management
persisted to a JSON file on the server. Full database integration, real-time chat, and image
handling are deferred to Phase 2.

[Add 2-3 sentences here summarising anything the client emphasised in the Week 2
briefing about the purpose/context of the app — e.g. is this meant to simulate a workplace
tool, a course community tool, etc.]

---

## 2. Git Strategy

This project uses a **trunk-based development** strategy, chosen for its simplicity and
suitability for a small team working over a short timeframe.

**Approach:**
- `main` is the single long-lived branch and is always kept in a working state.
- Short-lived feature branches (e.g. `feature/login-ui`, `feature/socket-setup`) are created
  for any change of meaningful size, and merged back into `main` quickly (typically within a
  day or two) to avoid drift and merge conflicts.
- Trivial or low-risk changes (e.g. doc updates, small styling fixes) may be committed
  directly to `main`.
- Commits are made frequently and with descriptive messages (e.g.
  `feat: add channel creation form`, `fix: correct socket reconnect bug`) rather than large,
  infrequent commits, to give a clear history of progress as required by the assignment.
- Pull requests are used for feature branches where more than one team member is
  touching related code, to allow for review before merging.
- `.gitignore` excludes `node_modules/`, environment files, and build artefacts.



---

## 3. Specifications and Assumptions

### Functional Requirements

| ID | Requirement | Source |
|----|-------------|--------|
| FR1 | Users can register/log in with a username and password (basic auth for Phase 1) | Assignment brief |
| FR2 | Super Admins can create users, groups, and channels | Assignment brief |
| FR3 | Group Admins can [manage membership within their group / create channels within their group — confirm scope] | [Client meeting] |
| FR4 | Regular Users can view and send messages in channels they belong to | Assignment brief |
| FR5 | Messages support text content | Assignment brief |
| FR6 | Messages support image content | Assignment brief |
| FR7 | Messages are delivered in real time via Socket.io | Assignment brief |
| FR8 | Users, Groups, and Channels persist to a JSON file on the server (Phase 1 only) | Assignment brief |
| FR9 | [Add any client-specified requirement, e.g. can a user belong to multiple groups?] | [Client meeting] |
| FR10 | [Add any client-specified requirement, e.g. message editing/deletion?] | [Client meeting] |

### Assumptions

| # | Assumption | Rationale |
|---|-----------|-----------|
| 1 | A user can belong to multiple groups, and multiple channels within a group | Common pattern for chat platforms (e.g. Slack/Discord-style); [confirm against client meeting] |
| 2 | A channel belongs to exactly one group | Keeps permission scoping simple: Group Admins manage channels within their own group |
| 3 | Only Super Admins can create new users; Group Admins can only manage membership, not create accounts | Matches "elevated privileges... user creation requests" language in the brief, pending clarification |
| 4 | Phase 1 authentication does not require hashing/session tokens beyond a basic check — full security hardening is deferred to Phase 2 | Brief explicitly says "very basic authentication" for Phase 1 |
| 5 | Images are stored as [file references / base64 — pick one and justify] for Phase 1 mock purposes | Phase 1 backend is limited to user management; image handling is largely UI mockup |
| 6 | [Add any other assumption you had to make where the brief or meeting was silent] | |

---

## 4. Data Structures

> These represent the planned Mongoose schemas / JSON file structure for Phase 2, and the
> shape of the mock/JSON data used in Phase 1.

### User
```
{
  _id: String,
  username: String,
  password: String,       // Phase 1: plaintext or basic hash; Phase 2: proper hashing
  role: "superAdmin" | "groupAdmin" | "user",
  groups: [groupId],       // groups this user belongs to
  createdAt: Date
}
```

### Group
```
{
  _id: String,
  name: String,
  admins: [userId],        // group admins for this group
  members: [userId],
  channels: [channelId],
  createdAt: Date
}
```

### Channel
```
{
  _id: String,
  name: String,
  groupId: String,         // parent group
  members: [userId],
  createdAt: Date
}
```

### Message
```
{
  _id: String,
  channelId: String,
  senderId: String,
  type: "text" | "image",
  content: String,          // text content or image URL/reference
  timestamp: Date
}
```

[Add/adjust fields based on anything specific the client asked for — e.g. read receipts,
timestps formats, message editing history, etc.]

---

## 5. Proposed Angular Architecture

### Components
| Component | Purpose |
|-----------|---------|
| `LoginComponent` | Basic username/password login form |
| `DashboardComponent` | Landing page after login; shows groups/channels available to the user |
| `GroupListComponent` | Displays groups the user belongs to (or all groups, for Super Admin) |
| `ChannelListComponent` | Displays channels within a selected group |
| `ChatWindowComponent` | Displays messages in a channel and message input (text/image) |
| `UserManagementComponent` | Super Admin view: create/list/edit users |
| `GroupManagementComponent` | Super/Group Admin view: create/edit groups and assign members |
| `ChannelManagementComponent` | Admin view: create/edit channels within a group |
| `NavbarComponent` | Top-level navigation, adapts links shown based on role |

### Services
| Service | Purpose |
|---------|---------|
| `AuthService` | Handles login, stores current user/role, guards routes |
| `UserService` | CRUD calls to backend user endpoints |
| `GroupService` | CRUD calls to backend group endpoints |
| `ChannelService` | CRUD calls to backend channel endpoints |
| `MessageService` | Sends/receives messages (Phase 2: wraps Socket.io client) |
| `SocketService` | Wraps Socket.io connection/event handling (Phase 2) |

### Models (interfaces)
- `User { id, username, role, groups }`
- `Group { id, name, admins, members, channels }`
- `Channel { id, name, groupId, members }`
- `Message { id, channelId, senderId, type, content, timestamp }`

### Routes
| Path | Component | Guard |
|------|-----------|-------|
| `/login` | LoginComponent | — |
| `/dashboard` | DashboardComponent | Auth |
| `/groups` | GroupListComponent | Auth |
| `/groups/:id/channels` | ChannelListComponent | Auth |
| `/channels/:id` | ChatWindowComponent | Auth |
| `/admin/users` | UserManagementComponent | Auth + Role(superAdmin) |
| `/admin/groups` | GroupManagementComponent | Auth + Role(superAdmin, groupAdmin) |
| `/admin/channels` | ChannelManagementComponent | Auth + Role(superAdmin, groupAdmin) |

[Adjust route guards once exact permission boundaries are confirmed from the client
meeting.]

---

## 6. Proposed Server Endpoints

| Method | Endpoint | Purpose | Access |
|--------|----------|---------|--------|
| POST | `/api/auth/login` | Authenticate user | Public |
| POST | `/api/users` | Create a new user | Super Admin |
| GET | `/api/users` | List all users | Super Admin |
| GET | `/api/users/:id` | Get a single user | Super Admin / self |
| PUT | `/api/users/:id` | Update a user | Super Admin |
| DELETE | `/api/users/:id` | Delete a user | Super Admin |
| POST | `/api/groups` | Create a group | Super Admin |
| GET | `/api/groups` | List groups | Authenticated |
| PUT | `/api/groups/:id` | Update group (add/remove members, admins) | Super Admin / Group Admin |
| DELETE | `/api/groups/:id` | Delete a group | Super Admin |
| POST | `/api/groups/:id/channels` | Create a channel within a group | Super Admin / Group Admin |
| GET | `/api/groups/:id/channels` | List channels in a group | Authenticated |
| DELETE | `/api/channels/:id` | Delete a channel | Super Admin / Group Admin |
| GET | `/api/channels/:id/messages` | Get message history for a channel (Phase 2) | Authenticated |
| POST | `/api/channels/:id/messages` | Send a message (Phase 2, may move to Socket.io only) | Authenticated |

**Socket.io events (Phase 2):** `connect`, `joinChannel`, `sendMessage`, `receiveMessage`,
`disconnect`. [Not required for Phase 1 but listed here for planning continuity.]

---

## 7. Design Documents

[This section needs your storyboards/wireframes — I can't generate visual mockups here,
but here's a suggested structure to fill in:]

- **Login screen** — username/password fields, login button, error state
- **Dashboard (Regular User view)** — list of groups/channels the user belongs to
- **Dashboard (Group Admin view)** — as above, plus management controls for their group's
  channels/members
- **Dashboard (Super Admin view)** — as above, plus global user/group/channel management
- **Chat window** — message list, text input, image upload control
- **Responsive behaviour** — note breakpoints planned (e.g. sidebar collapses to a hamburger
  menu below 768px) and how the layout adapts on mobile vs desktop

Insert your actual wireframe images/screenshots here (e.g. from Figma, Excalidraw, or hand
sketches scanned in), one per screen/role, with a one-line caption under each explaining
what it shows.

---

## Notes for Phase 2

[Optional section — not required, but useful to jot down: what's out of scope in Phase 1
that needs to become real in Phase 2, e.g. MongoDB integration, full Socket.io message
delivery, image storage, proper password hashing/sessions.]
