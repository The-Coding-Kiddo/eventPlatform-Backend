# Event Platform Backend — Technical Documentation

> **Version:** 1.0.0  
> **Stack:** NestJS 11, Prisma 7.8, PostgreSQL 16, TypeScript  
> **Status:** Production-ready

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Project Structure](#2-project-structure)
3. [Module System](#3-module-system)
4. [Database Schema](#4-database-schema)
5. [API Reference](#5-api-reference)
6. [Authentication & Authorization](#6-authentication--authorization)
7. [Business Logic Flows](#7-business-logic-flows)
8. [Validation & Error Handling](#8-validation--error-handling)
9. [Testing](#9-testing)
10. [Configuration](#10-configuration)
11. [Deployment](#11-deployment)

---

## 1. Architecture Overview

The backend is a **NestJS 11** monolithic REST API backed by **PostgreSQL 16** via **Prisma 7.8** (with the `@prisma/adapter-pg` driver using `pg` connection pooling). It uses JWT-based authentication, role-based access control, Winston logging, and Swagger documentation.

### Patterns

| Concern | Pattern |
|---|---|
| Module organization | Feature modules (`auth/`, `events/`, `users/`, `institution/`, `notifications/`) |
| Data access | Prisma ORM with PostgreSQL adapter |
| Auth | JWT (HS256, 7-day expiry) with `passport`-style guards |
| API contract | Class-validator DTOs + Swagger decorators |
| Response format | Global `TransformInterceptor` wrapping all responses |
| Error format | Global `GlobalExceptionFilter` for uniform error envelopes |
| Rate limiting | `@nestjs/throttler` — 60 requests/minute globally |
| Logging | Winston with `nest-winston` (console + optional file transport) |
| Auditing | Custom `AuditService` writing to `AuditLog` table |
| File uploads | Multer via `@nestjs/platform-express` |

### Response Envelope

All successful responses are wrapped:

```json
{
  "success": true,
  "data": { ... },
  "timestamp": "2026-06-12T00:00:00.000Z"
}
```

All error responses are wrapped:

```json
{
  "success": false,
  "statusCode": 404,
  "message": "Resource not found",
  "path": "/api/resource",
  "timestamp": "2026-06-12T00:00:00.000Z"
}
```

---

## 2. Project Structure

```
src/
├── main.ts                          # App bootstrap, middleware, Swagger
├── app.module.ts                    # Root module (imports all feature modules)
├── app.controller.ts                # Health endpoint (GET /)
├── auth/                            # Authentication module
│   ├── auth.module.ts
│   ├── auth.controller.ts           # /auth/*
│   ├── auth.service.ts              # register, login, getMe, provision
│   ├── jwt-auth.guard.ts            # JWT validation guard
│   ├── roles.decorator.ts           # @Roles() decorator
│   ├── roles.guard.ts               # Role-based access guard
│   ├── user.decorator.ts            # @CurrentUser() param decorator
│   └── dto/
│       ├── register.dto.ts
│       ├── login.dto.ts
│       └── provision.dto.ts
├── events/                          # Events module
│   ├── events.module.ts
│   ├── events.controller.ts         # /events/*
│   ├── events.service.ts            # Full event CRUD, registration, QR, check-in
│   └── dto/
│       ├── create-event.dto.ts
│       ├── update-event.dto.ts
│       ├── get-all-events.dto.ts
│       ├── invite-attendee.dto.ts
│       └── update-subscriptions.dto.ts
├── users/                           # User profile module
│   ├── users.module.ts
│   ├── users.controller.ts          # /user/*
│   ├── users.service.ts             # Profile update, password change
│   └── dto/
│       └── update-profile.dto.ts
├── institution/                     # Institution & admin module
│   ├── institution.module.ts
│   ├── institution.controller.ts    # /admin/* (super admin only)
│   ├── institution.service.ts       # Moderation, analytics, users, institutions
│   ├── institution-profile.controller.ts  # /institutions/* (public/user-facing)
│   └── dto/
│       ├── update-status.dto.ts
│       └── search-institutions.dto.ts
├── notifications/                   # Notification module
│   ├── notifications.module.ts
│   ├── notifications.controller.ts  # /notifications/*
│   ├── notifications.service.ts     # Create, find, mark read, delete
│   └── dto/
│       └── create-notification.dto.ts
├── health/                          # Health check module
│   ├── health.module.ts
│   ├── health.controller.ts         # /health
│   └── prisma.health.ts             # DB connectivity indicator
├── audit/                           # Audit logging module (global)
│   ├── audit.module.ts
│   └── audit.service.ts             # Logs actions to AuditLog table
├── prisma/                          # Prisma service module (global)
│   ├── prisma.module.ts
│   └── prisma.service.ts            # PrismaPg adapter + Pool connection
└── common/                          # Shared utilities
    ├── dto/
    │   └── pagination.dto.ts        # skip/take pagination DTO
    ├── filters/
    │   └── http-exception.filter.ts # Global error envelope
    ├── interceptors/
    │   └── transform.interceptor.ts # Global success envelope
    └── logger/
        └── winston.config.ts        # Winston logger config
```

---

## 3. Module System

### AppModule (`app.module.ts`)

| Import | Purpose |
|---|---|
| `ThrottlerModule` | Global rate limiting (60 req/min) |
| `PrismaModule` | Database access (global) |
| `AuthModule` | JWT auth, registration, login |
| `EventsModule` | Event CRUD, registration, QR, check-in |
| `UsersModule` | Profile management |
| `InstitutionModule` | Super admin console + public institution profiles |
| `NotificationsModule` | Notification dispatch & retrieval |
| `HealthModule` | Liveness/readiness probes |
| `AuditModule` | Audit log service (global) |

### Module Dependency Map

```
AppModule
├── ThrottlerModule (global guard)
├── PrismaModule (global provider)
├── AuditModule (global provider)
├── AuthModule
│   └── JwtModule (global, signs/verifies tokens)
├── EventsModule
│   └── JwtModule
├── UsersModule
├── InstitutionModule
│   └── PrismaModule
├── NotificationsModule
├── HealthModule
│   ├── TerminusModule
│   └── PrismaModule
└── (AppController, AppService)
```

---

## 4. Database Schema

### Enum: `Role`

```prisma
enum Role { citizen  institution  super_admin }
```

### Enum: `EventStatus`

```prisma
enum EventStatus { draft  pending  approved  rejected }
```

### Model: `User`

| Field | Type | Notes |
|---|---|---|
| `id` | `String @id @default(uuid())` | Primary key |
| `name` | `String` | Display name |
| `email` | `String @unique` | Login credential |
| `password` | `String` | bcrypt-hashed |
| `role` | `Role @default(citizen)` | RBAC role |
| `institution` | `String?` | Institution name (for institution role) |
| `bio` | `String?` | Institution profile bio |
| `profilePicture` | `String?` | Full URL to uploaded image |
| `subscriptions` | `String[]` | PostgreSQL array of category subscriptions |
| `suspended` | `Boolean @default(false)` | Account suspension flag |
| `createdAt` | `DateTime @default(now())` | |
| `updatedAt` | `DateTime @updatedAt` | |

Relations:
- `savedEvents` → `Event[]` via `@relation("SavedEvents")`
- `registeredEvents` → `Event[]` via `@relation("RegisteredEvents")`
- `followers` → `Follow[]` via `@relation("Followed")` (users following this user)
- `following` → `Follow[]` via `@relation("Follower")` (users this user follows)

### Model: `Follow`

| Field | Type | Notes |
|---|---|---|
| `id` | `String @id @default(uuid())` | Primary key |
| `followerId` | `String` | FK → `User.id` (citizen) |
| `followedId` | `String` | FK → `User.id` (institution) |
| `createdAt` | `DateTime @default(now())` | |
| `@@unique([followerId, followedId])` | | Prevents duplicate follows |

### Model: `Event`

| Field | Type | Notes |
|---|---|---|
| `id` | `String @id @default(uuid())` | Primary key |
| `title` | `String` | Event title |
| `category` | `String` | One of 8 predefined categories |
| `date` | `String` | ISO date string (YYYY-MM-DD) |
| `time` | `String` | HH:mm format |
| `location` | `String` | City/location name |
| `venue` | `String` | Venue name |
| `institution` | `String` | Hosting institution name |
| `description` | `String` | Event description |
| `price` | `Float @default(0)` | Ticket price (0 = free) |
| `capacity` | `Int` | Maximum attendees |
| `attendees` | `Int @default(0)` | Current registered count |
| `tags` | `String[]` | PostgreSQL array |
| `image` | `String?` | Event image URL |
| `status` | `EventStatus @default(draft)` | Moderation workflow |
| `checkedInUsers` | `String[] @default([])` | User IDs checked in |
| `waitlist` | `String[] @default([])` | Waitlisted user IDs |
| `createdAt` | `DateTime @default(now())` | |
| `updatedAt` | `DateTime @updatedAt` | |

Relations:
- `registeredUsers` → `User[]` via `@relation("RegisteredEvents")`
- `savedBy` → `User[]` via `@relation("SavedEvents")`

### Model: `Notification`

| Field | Type | Notes |
|---|---|---|
| `id` | `String @id @default(uuid())` | Primary key |
| `type` | `String` | Notification type identifier |
| `title` | `String` | Notification title |
| `message` | `String` | Notification body |
| `read` | `Boolean @default(false)` | Read state |
| `userId` | `String?` | Direct target (null = broadcast) |
| `forRole` | `String?` | Role filter |
| `forCategory` | `String?` | Subscription category filter |
| `forInstitution` | `String?` | Institution filter |
| `eventId` | `String?` | Related event |
| `createdAt` | `DateTime @default(now())` | |

### Model: `AuditLog`

| Field | Type | Notes |
|---|---|---|
| `id` | `String @id @default(uuid())` | Primary key |
| `userId` | `String` | Actor user ID |
| `userEmail` | `String` | Actor email snapshot |
| `userRole` | `String` | Actor role snapshot |
| `action` | `String` | Action identifier (e.g., "event.submit", "event.approve") |
| `targetId` | `String?` | Affected entity ID |
| `details` | `String?` | JSON string with additional context |
| `createdAt` | `DateTime @default(now())` | |

---

## 5. API Reference

### 5.1 Authentication (`/auth`)

#### `POST /auth/register`
Create a new user account.

- **Auth:** None
- **Body:**
  ```json
  { "name": "Jane Doe", "email": "jane@example.com", "password": "secret123", "institution?": "My Org" }
  ```
- **Logic:** If `institution` provided, creates user with `role: 'institution'`. Otherwise creates `role: 'citizen'`. Password hashed with bcrypt (10 rounds). Throws `409` on duplicate email.
- **Response:** `201` — `{ user: { id, name, email, role, institution?, createdAt } }`

#### `POST /auth/login`
Authenticate and receive JWT.

- **Auth:** None
- **Body:** `{ "email": "...", "password": "..." }`
- **Logic:** bcrypt compare. On success, generates JWT with payload `{ sub, email, role, institution? }`. Returns user with `savedEvents[]`, `registeredEvents[]` IDs.
- **Response:** `201` — `{ token: "eyJ...", user: { ... } }`

#### `GET /auth/me`
Restore session — fetch current user profile.

- **Auth:** `JwtAuthGuard`
- **Logic:** Reads JWT `sub`, fetches full user profile without password. Returns user with `savedEvents[]`, `registeredEvents[]`, `waitlistedEvents[]`.
- **Response:** `200` — full user object

#### `POST /auth/provision`
Provision a new institution account (super admin only).

- **Auth:** `JwtAuthGuard` + inline `super_admin` check
- **Body:** `{ "name": "...", "email": "...", "password": "...", "institution": "..." }`
- **Logic:** Creates user with `role: 'institution'` and the given `institution` name.
- **Response:** `201` — `{ user: { ... } }`

### 5.2 Events (`/events`)

#### `GET /events`
Public approved events with filtering and pagination.

- **Auth:** None
- **Query Params:** `skip`, `take`, `category`, `city`, `search`, `timeframe` (upcoming/past/all, default: upcoming), `institution`
- **Logic:** Filters by `status: 'approved'`. Time-based filtering uses date + time comparison. Search covers `title` + `description`. `institution` filter matches exact institution name.
- **Response:** `200` — `{ items: Event[], total, skip, take }`

#### `GET /events/all`
All events for institution/super admin dashboards.

- **Auth:** `JwtAuthGuard` + `RolesGuard('institution', 'super_admin')`
- **Query Params:** `institutionId`, `skip`, `take`
- **Logic:** Institution role is restricted to own events. Super admin can filter by `institutionId`.
- **Response:** `200` — `{ items: Event[], total, skip, take }`

#### `GET /events/:id`
Get single event by ID.

- **Auth:** None
- **Logic:** Returns event or `404`.

#### `POST /events`
Submit a new event for moderation.

- **Auth:** `JwtAuthGuard` + `RolesGuard('institution', 'super_admin')`
- **Body:** `CreateEventDto`
- **Logic:** Sets status to `pending`. Logs audit. Super admin can set `institution` field.
- **Response:** `201` — `{ event: Event }`

#### `POST /events/draft`
Save an event as draft.

- **Auth:** `JwtAuthGuard` + `RolesGuard('institution', 'super_admin')`
- **Body:** `CreateEventDto`
- **Logic:** Sets status to `draft`. Logs audit.
- **Response:** `201` — `{ event: Event }`

#### `PUT /events/:id`
Update an existing event.

- **Auth:** `JwtAuthGuard` + `RolesGuard('institution', 'super_admin')`
- **Body:** `UpdateEventDto`
- **Logic:** Institution can only update own non-approved events. Super admin can update any. Role change detection logs audit.
- **Response:** `200` — updated `Event`

#### `DELETE /events/:id`
Delete a draft or rejected event.

- **Auth:** `JwtAuthGuard` + `RolesGuard('institution', 'super_admin')`
- **Logic:** Institution can only delete own draft/pending events. Super admin can delete any.
- **Response:** `200` — `{ success: true }`

#### `POST /events/:id/register`
Register the current user for an event.

- **Auth:** `JwtAuthGuard`
- **Logic:** **Transactional.** Checks capacity: if full, adds to `waitlist[]`. If under capacity but already registered, returns `"already_registered"`. Prevents double-registration. Updates attendee count.
- **Response:** `201` — `{ success: true, status: "registered" | "waitlisted" | "already_registered" }`

#### `DELETE /events/:id/register`
Cancel registration for an event.

- **Auth:** `JwtAuthGuard`
- **Query Params:** `userId?` (for admin cancellations)
- **Logic:** **Transactional.** Removes from `registeredUsers` or `waitlist[]`. Auto-promotes first waitlisted user to registered if capacity opens. Decrements attendee count.
- **Response:** `200` — `{ success: true }`

#### `POST /events/:id/qr`
Generate a QR ticket for a registered attendee.

- **Auth:** `JwtAuthGuard`
- **Logic:** Validates user is registered. Generates `SHA-256(eventId:userId:QR_SECRET)` as ticket code. Returns base64url-encoded QR payload `{ eventId, userId, ticketCode }`.
- **Response:** `201` — `{ eventId, userId, ticketCode, qrData }`

#### `POST /events/:id/check-in`
Check in an attendee via QR scan or manual override.

- **Auth:** `JwtAuthGuard`
- **Body:** `{ qrData?: string }`
- **Logic:** If `qrData` provided, decodes and verifies SHA-256 hash. Otherwise allows bypass for institution/super_admin staff. Transactionally marks user as checked-in in `checkedInUsers[]`.
- **Response:** `201` — `{ success, checkedIn, userId }`

#### `GET /events/:id/attendees`
Get unified attendee list for an event.

- **Auth:** `JwtAuthGuard` + `RolesGuard('institution', 'super_admin')`
- **Logic:** Returns registered users (with check-in status) + waitlisted users. Permission-gated by institution ownership.
- **Response:** `200` — `[{ id, name, email, status, checkedIn, checkedInAt? }]`

#### `POST /events/:id/invite-attendee`
Invite a citizen to register for an event.

- **Auth:** `JwtAuthGuard` + `RolesGuard('institution', 'super_admin')`
- **Body:** `{ email: string, name?: string }`
- **Logic:** **Transactional.** Finds user by email or auto-provisions a new citizen account (temp password: `invited123`). Connects as registered attendee. Logs audit.
- **Response:** `201` — `{ success: true, user: { ... } }`

#### `POST /events/:id/save` / `DELETE /events/:id/save`
Toggle save/bookmark for an event.

- **Auth:** `JwtAuthGuard`
- **Logic:** Connects/disconnects the `SavedEvents` relation.
- **Response:** `200` — `{ success: true }`

### 5.3 Users (`/user`)

#### `PUT /user/subscriptions`
Update category subscriptions (citizen).

- **Auth:** `JwtAuthGuard`
- **Body:** `{ categories: string[] }`
- **Response:** `200` — `{ subscriptions: string[] }`

#### `PATCH /user/profile`
Update own profile.

- **Auth:** `JwtAuthGuard`
- **Body:** `{ name?, email?, bio?, profilePicture? }`
- **Logic:** Name must be non-empty. Email must be unique across users. Bio max 500 chars. profilePicture is a full URL string.
- **Response:** `200` — `{ message, user: { ... } }`

#### `POST /user/profile-picture`
Upload a profile picture.

- **Auth:** `JwtAuthGuard`
- **Content-Type:** `multipart/form-data`
- **Body:** `file` (image/*, max 5MB)
- **Logic:** Saved to `./uploads/profile-pictures/<uuid>.<ext>`. The `profilePicture` field is updated with the full URL.
- **Response:** `200` — `{ message, user: { ... } }`

#### `PATCH /user/password`
Change password.

- **Auth:** `JwtAuthGuard`
- **Body:** `{ currentPassword, newPassword }` (min 6 chars)
- **Logic:** Verifies current password with bcrypt. Hashes and saves new password.
- **Response:** `200` — `{ message: "Password changed successfully" }`

### 5.4 Super Admin Console (`/admin`)

All endpoints require `JwtAuthGuard` + `RolesGuard('super_admin')`.

#### `GET /admin/moderation`
Get moderation queue (non-draft events).

- **Query:** `status?` (pending, approved, rejected), `skip`, `take`
- **Response:** `{ items: QueueItem[], total, skip, take }`

#### `POST /admin/moderation/:id/approve`
Approve an event.

- **Body:** `{ note?: string }`
- **Response:** `{ queueItem, event }`

#### `POST /admin/moderation/:id/reject`
Reject an event.

- **Body:** `{ note?: string }`
- **Response:** `{ queueItem, event }`

#### `GET /admin/analytics`
Platform analytics dashboard data.

- **Response:** `{ totalEvents, pendingModeration, approvedEvents, rejectedEvents, approvalRate, totalInstitutions, activeInstitutions, totalUsers, eventsThisMonth, categoryDistribution, topCities, ... }`

#### `GET /admin/users`
List all users (passwords stripped).

- **Query:** `skip`, `take`
- **Response:** `{ items: User[], total, skip, take }`

#### `PATCH /admin/users/:id`
Suspend or activate a user.

- **Body:** `{ status: "active" | "suspended" }`
- **Response:** updated user object

#### `GET /admin/institutions`
List all institutions with event counts.

- **Response:** `{ items: [{ id, name, status, eventsPublished }], total, skip, take }`

#### `PATCH /admin/institutions/:name/suspend`
Suspend an institution (sets suspended=true on all matching users).

#### `PATCH /admin/institutions/:name/unsuspend`
Unsuspend an institution.

#### `PATCH /admin/events/:id/status`
Legacy: directly set an event's status.

- **Body:** `{ status: "approved" | "rejected" }`

### 5.5 Public Institution Profiles (`/institutions`)

#### `GET /institutions`
Search and list institutions.

- **Auth:** None
- **Query:** `search?` (institution name, case-insensitive contains), `skip`, `take`
- **Logic:** Selects users with `role: 'institution'`, deduplicates by institution name, returns first match per name with follower count.
- **Response:** `{ items: [{ id, name, institutionName, bio, profilePicture, followerCount }], total, skip, take }`

#### `GET /institutions/:id`
Get public institution profile.

- **Auth:** None (but returns `isFollowing` if JWT provided)
- **Logic:** Returns profile with follower count. If authenticated, checks follow relationship.
- **Response:** `{ id, name, institution, bio, profilePicture, followerCount, isFollowing }`

#### `POST /institutions/:id/follow`
Follow an institution.

- **Auth:** `JwtAuthGuard`
- **Logic:** Creates follow relationship. Blocks self-follow. `409` on duplicate.
- **Response:** `201` — `{ success: true }`

#### `DELETE /institutions/:id/follow`
Unfollow an institution.

- **Auth:** `JwtAuthGuard`
- **Logic:** Deletes follow relationship. `404` if not following.
- **Response:** `200` — `{ success: true }`

### 5.6 Notifications (`/notifications`)

#### `GET /notifications`
Get notifications targeted at the current user.

- **Auth:** `JwtAuthGuard`
- **Logic:** Returns user-specific + role-targeted + subscription-matched + institution-specific notifications.
- **Response:** `200` — `Notification[]`

#### `POST /notifications`
Dispatch a notification.

- **Auth:** `JwtAuthGuard` + `RolesGuard('super_admin')`
- **Body:** `CreateNotificationDto`
- **Logic:** If `userId` set, creates direct notification. Otherwise fan-outs to matching users by role/category/institution.
- **Response:** `201` — created `Notification`

#### `PATCH /notifications/:id/read`
Mark a notification as read.

#### `POST /notifications/read-all`
Mark all user-notifications as read.

#### `DELETE /notifications/:id`
Delete a notification.

### 5.7 Health (`/health`)

#### `GET /health`
Liveness + readiness probe.

- **Auth:** None
- **Logic:** Checks DB connectivity via `SELECT 1` and heap memory < 300MB.
- **Response:** `200` — `{ status: "ok", info: { db: { status: "up" }, memory: { status: "up" } }, ... }`

---

## 6. Authentication & Authorization

### 6.1 JWT Authentication

| Property | Value |
|---|---|
| Algorithm | HS256 |
| Secret | `process.env.JWT_SECRET` (required at startup) |
| Expiry | 7 days |
| Module | `@nestjs/jwt` (global) |

**JWT Payload:**
```typescript
interface JwtPayload {
  sub: string;          // user.id
  email: string;        // user.email
  role: 'citizen' | 'institution' | 'super_admin';
  institution?: string; // user.institution (institution role)
}
```

**Flow:**
1. Client sends `POST /auth/login` with email + password
2. Server validates with bcrypt, generates JWT
3. Client stores token (typically `localStorage`)
4. Client sends `Authorization: Bearer <token>` on all protected requests
5. `JwtAuthGuard` verifies token, attaches decoded payload to `request.user`
6. `@CurrentUser()` decorator extracts `request.user` in controllers

### 6.2 Role-Based Access Control

| Mechanism | Usage |
|---|---|
| `@Roles('institution', 'super_admin')` | Declares required roles on handler |
| `RolesGuard` | Reads metadata, compares `user.role` |
| Inline checks | Used when logic depends on role (e.g., filtering own events) |

**Guard ordering:**
```typescript
@Roles('institution', 'super_admin')
@UseGuards(JwtAuthGuard, RolesGuard)  // JWT first, then role check
```

### 6.3 Role Permissions Matrix

| Feature | Citizen | Institution | Super Admin |
|---|---|---|---|
| Browse public events | ✓ | ✓ | ✓ |
| Register for events | ✓ | ✓ | ✓ |
| Save events | ✓ | ✓ | ✓ |
| Create/manage events | ✗ | ✓ (own) | ✓ (any) |
| Approve/reject events | ✗ | ✗ | ✓ |
| View attendees | ✗ | ✓ (own) | ✓ |
| Invite attendees | ✗ | ✓ (own) | ✓ |
| Check-in attendees | ✗ | ✓ (own) | ✓ |
| Edit profile | ✓ | ✓ | ✓ |
| Upload profile picture | ✓ | ✓ | ✓ |
| Follow institutions | ✓ | ✗ | ✓ |
| Institution dashboard | ✗ | ✓ | ✓ |
| Admin console (analytics, users) | ✗ | ✗ | ✓ |
| Provision institutions | ✗ | ✗ | ✓ |
| Moderate events | ✗ | ✗ | ✓ |
| Dispatch notifications | ✗ | ✗ | ✓ |

---

## 7. Business Logic Flows

### 7.1 Event Registration Flow

```
User clicks "Register"
       │
       ▼
  POST /events/:id/register
       │
       ▼
  ┌──────────────────────────────────┐
  │  Transaction:                    │
  │  1. Check if already registered  │
  │  2. If full → add to waitlist[]  │
  │  3. If space →                   │
  │     a. Connect registeredUsers   │
  │     b. Increment attendees count │
  └──────────────────────────────────┘
       │
       ▼
  Response: { status: "registered" | "waitlisted" | "already_registered" }
```

### 7.2 Cancellation with Waitlist Promotion

```
User cancels
       │
       ▼
  DELETE /events/:id/register
       │
       ▼
  ┌──────────────────────────────────┐
  │  Transaction:                    │
  │  1. Remove from registeredUsers  │
  │     OR remove from waitlist[]    │
  │  2. If registered →              │
  │     a. Decrement attendees       │
  │     b. Check waitlist[]          │
  │     c. If waitlist not empty →   │
  │        i. Pop first user         │
  │        ii. Connect as registered │
  │        iii. Increment attendees  │
  └──────────────────────────────────┘
```

### 7.3 QR Ticket Check-In

```
User presents QR code
       │
       ▼
  POST /events/:id/check-in { qrData }
       │
       ▼
  ┌──────────────────────────────────────┐
  │  1. Decode base64url → { eventId,   │
  │     userId, ticketCode }             │
  │  2. Verify: SHA256(eventId:userId:   │
  │     QR_SECRET) === ticketCode        │
  │  3. Check event ownership            │
  │  4. Add userId to checkedInUsers[]   │
  └──────────────────────────────────────┘
       │
       ▼
  Response: { checkedIn: true, userId }
```

### 7.4 Institution Follow System

```
User visits institution profile
       │
       ▼
  GET /institutions/:id
  → Returns profile + isFollowing (if authenticated)
       │
       ▼
  [Follow] button click
       │
       ▼
  POST /institutions/:id/follow
  → Creates Follow record
  → 409 if already following
       │
       ▼
  [Following] button click
       │
       ▼
  DELETE /institutions/:id/follow
  → Deletes Follow record
  → 404 if not following
```

### 7.5 Notification Dispatch

```
Admin creates notification
       │
       ▼
  POST /notifications { type, title, message, userId?, forRole?, forCategory?, forInstitution? }
       │
       ▼
  ┌──────────────────────────────────────┐
  │  If userId set:                      │
  │    → Create direct notification      │
  │  Else: Fan-out logic:                │
  │    → For each matching user by:      │
  │       • Role filter                  │
  │       • Category subscriptions       │
  │       • Institution filter           │
  │    → Create individual notification  │
  └──────────────────────────────────────┘
```

### 7.6 Event Moderation Workflow

```
Event created → status = "pending"
       │
       ▼
  Super Admin sees in moderation queue
       │
       ├── Approve → status = "approved" → visible publicly
       │
       └── Reject  → status = "rejected" → hidden from public
```

---

## 8. Validation & Error Handling

### 8.1 Global Validation Pipe

```typescript
app.useGlobalPipes(new ValidationPipe({
  whitelist: true,           // Strip unknown properties
  transform: true,           // Auto-transform types (string → number, etc.)
  forbidNonWhitelisted: true, // Reject requests with unknown properties
}));
```

### 8.2 Global Exception Filter

Catches all exceptions (HTTP, system, Prisma) and returns a standard envelope:

```json
{ "success": false, "statusCode": 404, "message": "...", "path": "...", "timestamp": "..." }
```

### 8.3 Global Response Interceptor

Wraps all successful controller responses:

```json
{ "success": true, "data": ..., "timestamp": "..." }
```

### 8.4 Error Codes Reference

| HTTP | When |
|---|---|
| `400` | Validation failure, bad request, non-whitelisted properties |
| `401` | Missing or invalid JWT |
| `403` | Insufficient role permissions |
| `404` | Resource not found |
| `409` | Duplicate email, duplicate follow |
| `429` | Rate limit exceeded (60 req/min) |
| `500` | Unhandled server error |

---

## 9. Testing

### Test Configuration

| Property | Value |
|---|---|
| Framework | Jest 30 |
| Runner | `ts-jest` |
| Test pattern | `src/**/*.spec.ts` |
| E2E pattern | `test/**/*.e2e-spec.ts` |
| Coverage | All `src/**/*.(t|j)s`, output to `coverage/` |

### Running Tests

```bash
npm test              # Unit tests (11 suites, 63 tests)
npm run test:e2e      # E2E tests (full app with mocked DB)
npm run test:cov      # Unit tests + coverage report
npm run test:watch    # Watch mode
```

### Unit Test Coverage

| File | Tests | Focus |
|---|---|---|
| `auth.service.spec` | 7 | register, login, getMe, provision — all paths (success, conflict, unauthorized, not found) |
| `events.service.spec` | 12 | getPublicEvents, getEventById, submitEvent, updateEvent (RBAC), deleteEvent, register/waitlist, QR generation, check-in, cancel, attendees |
| `institution.service.spec` | 8 | getModerationQueue, approve/reject, analytics, users, suspend/unsuspend |
| `notifications.service.spec` | 6 | create (direct, fan-out, fallback), findForUser, markRead, markAllRead, remove |
| `users.service.spec` | 2 | updateSubscriptions, subscriptions edge case |
| Controller specs | 5 | Validates controller instantiation |
| `app.controller.spec` | 1 | Returns "Hello World!" |

### E2E Test Coverage

The E2E suite (`test/app.e2e-spec.ts`) validates:
- Health endpoint response structure
- Registration (201, 409, 400)
- Login (401 on invalid)
- Public events (200 with paginated results)
- 404 on missing resources
- Protected routes return 401 without JWT
- Response envelope contract for both success and error

---

## 10. Configuration

### Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `DATABASE_URL` | ✓ | — | PostgreSQL connection string (`postgresql://user:pass@host:5432/db`) |
| `JWT_SECRET` | ✓ | — | HS256 signing secret (validated at startup) |
| `PORT` | ✗ | `3000` | Server listen port |
| `FRONTEND_URL` | ✗ | `http://localhost:5175` | CORS origin |
| `QR_SECRET` | ✗ | (from JWT_SECRET) | Secret for QR ticket hashing |

### CORS Configuration

```typescript
const allowedOrigins = [
  process.env.FRONTEND_URL || 'http://localhost:5175',
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175',
];
```

### Rate Limiting

- **Window:** 60 seconds
- **Limit:** 60 requests per window
- **Global:** Applies to all routes

### Docker

```yaml
services:
  db:
    image: postgres:16
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: supersecretpassword
      POSTGRES_DB: eventplatform_db
    ports: ["5432:5432"]
    volumes: [pgdata:/var/lib/postgresql/data]
```

### Prisma Config (`prisma.config.ts`)

```typescript
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations', seed: 'ts-node prisma/seed.ts' },
  datasource: { url: env('DATABASE_URL') },
});
```

### Seed Command

```bash
npx prisma db seed
```

Seeds 1 super admin, 1 institution admin, 1 citizen, and 3 events.

---

## 11. Deployment

### Build

```bash
npm run build           # Compiles to dist/
npm run start:prod      # node dist/main
```

### Database Migrations

```bash
npx prisma migrate dev           # Development: create + apply migration
npx prisma migrate deploy        # Production: apply pending migrations
npx prisma migrate status        # Check migration state
npx prisma db push               # Sync schema without migration (dev only)
```

### Health Checks

- `GET /health` — returns `200` when DB and memory are healthy, `503` otherwise
- Used by container orchestrators for liveness/readiness probes

### Logging

- **Development:** `nestLike` console format via Winston
- **Production:** Structured JSON logs via Winston console transport
- **Audit:** All moderator actions logged to `AuditLog` table

### Static Files

- **Directory:** `./uploads/profile-pictures/`
- **Served at:** `GET /uploads/profile-pictures/<filename>`
- **Limits:** Images only, max 5MB per file
- **Storage:** Local filesystem (not object storage)
