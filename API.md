# EventPlatform Backend API Documentation

This document outlines the architecture, features, and REST API structure of the EventPlatform backend. The backend is built using **NestJS**, **Prisma ORM**, and **PostgreSQL**.

> [!NOTE]
> **Interactive API Docs:** An interactive OpenAPI (Swagger) UI is available by running the backend and navigating to `http://localhost:3000/api/docs`. You can view full schema models and test endpoints directly from your browser.

## 🏗️ Core Architecture & Features

The platform revolves around three core entities: **Users**, **Events**, and **Notifications**, with a strict Role-Based Access Control (RBAC) system.

### Authentication & Authorization
- **JWT-based Authentication**: Users authenticate via email/password to receive a Bearer token. Sessions are valid for 7 days.
- **Role-Based Access Control (RBAC)**: Enforced via the `@CurrentUser()` decorator and specific controller guards.

### Roles & Permissions
1. **Citizen (`citizen`)**
   - Can view approved public events.
   - Can register for, cancel registration, and bookmark (save) events.
   - Can update their category subscriptions to receive targeted notifications.
2. **Institution Admin (`institution_admin`)**
   - Tied to a specific `institution` string.
   - Can draft, submit (for moderation), edit, and delete their *own* events.
   - Receives notifications specific to their institution.
3. **Super Admin (`super_admin`)**
   - Full system access.
   - Can provision new Institution Admins.
   - Manages the moderation queue (approve/reject pending events).
   - Can suspend users and institutions.
   - Can view system-wide analytics.

---

## 🛣️ API Endpoints

All protected routes require an `Authorization: Bearer <token>` header.

### 1. Authentication (`/auth`)
Handles user registration, login, and session restoration.

| Method | Endpoint | Auth | Description | Payload / Query |
| :--- | :--- | :--- | :--- | :--- |
| `POST` | `/auth/register` | Public | Register a new Citizen. | `{ name, email, password }` |
| `POST` | `/auth/login` | Public | Authenticate and receive JWT. | `{ email, password }` |
| `GET` | `/auth/me` | JWT | Restore session/fetch current user data. | - |
| `POST` | `/auth/provision` | Super Admin | Create a new Institution Admin. | `{ name, email, password, institution }` |

### 2. Events (`/events`)
Handles event discovery, creation, modification, and citizen interactions.

**Public Discovery**
| Method | Endpoint | Auth | Description | Payload / Query |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/events` | Public | Get approved public events. | `?category=x&city=y&search=z` |
| `GET` | `/events/:id` | Public | Get details for a specific event. | - |

**Institution Admin Actions**
| Method | Endpoint | Auth | Description | Payload / Query |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/events/all` | Admin | Get all events for the admin's institution. | `?institutionId=x` (Super Admin only) |
| `POST` | `/events/draft` | Admin | Save an event as a draft. | `CreateEventDto` |
| `POST` | `/events` | Admin | Submit an event for moderation (`pending`). | `CreateEventDto` |
| `PUT` | `/events/:id` | Admin | Update an owned event. | `UpdateEventDto` |
| `DELETE` | `/events/:id` | Admin | Delete an owned draft/rejected event. | - |

**Citizen Interactions**
| Method | Endpoint | Auth | Description | Payload / Query |
| :--- | :--- | :--- | :--- | :--- |
| `POST` | `/events/:id/save` | JWT | Bookmark an event. | - |
| `DELETE` | `/events/:id/save` | JWT | Remove bookmark. | - |
| `POST` | `/events/:id/register` | JWT | Register/RSVP for an event. | - |
| `DELETE` | `/events/:id/register` | JWT | Cancel registration. | - |

### 3. Moderation & Administration (`/admin`)
Super Admin exclusive endpoints for managing the platform.

| Method | Endpoint | Auth | Description | Payload / Query |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/admin/moderation` | Super Admin | Get queue of `pending` events. | `?status=pending` |
| `POST` | `/admin/moderation/:id/approve` | Super Admin | Approve an event. | `{ note?: string }` |
| `POST` | `/admin/moderation/:id/reject` | Super Admin | Reject an event. | `{ note?: string }` |
| `GET` | `/admin/analytics` | Super Admin | Get platform-wide statistics. | - |
| `GET` | `/admin/users` | Super Admin | List all users. | - |
| `PATCH` | `/admin/users/:id` | Super Admin | Suspend/Activate a user. | `{ status: 'active' \| 'suspended' }` |
| `GET` | `/admin/institutions` | Super Admin | List all institutions. | - |
| `PATCH` | `/admin/institutions/:id/suspend` | Super Admin | Suspend an institution. | - |
| `PATCH` | `/admin/institutions/:id/unsuspend` | Super Admin | Unsuspend an institution. | - |
| `GET` | `/admin/events/pending` | Super Admin | (Legacy) Get pending events. | - |
| `PATCH` | `/admin/events/:id/status` | Super Admin | (Legacy) Update event status directly. | `{ status: 'approved' \| 'rejected' }` |

### 4. Notifications (`/notifications`)
Handles the real-time notification system and read-states.

| Method | Endpoint | Auth | Description | Payload / Query |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/notifications` | JWT | Get targeted notifications for user. | - |
| `PATCH` | `/notifications/:id/read` | JWT | Mark a single notification as read. | - |
| `POST` | `/notifications/read-all` | JWT | Mark all user's notifications as read. | - |
| `DELETE` | `/notifications/:id` | JWT | Delete a notification. | - |
| `POST` | `/notifications` | Super Admin | Manually dispatch a system broadcast. | `CreateNotificationDto` |

### 5. User Preferences (`/user`)
| Method | Endpoint | Auth | Description | Payload / Query |
| :--- | :--- | :--- | :--- | :--- |
| `PUT` | `/user/subscriptions` | JWT | Update citizen category subscriptions. | `{ categories: string[] }` |

---

## 🗄️ Database Schema & Models (Prisma)

### User Model
- **`id`**: UUID
- **`email`**: Unique string
- **`password`**: Bcrypt hashed
- **`role`**: `citizen` | `institution_admin` | `super_admin`
- **`institution`**: String (optional, tied to institution admins)
- **`subscriptions`**: String array (categories citizen is interested in)
- **`suspended`**: Boolean

### Event Model
- **`id`**: UUID
- **`title`, `category`, `date`, `time`, `location`, `venue`**: Strings
- **`description`**: Text block
- **`price`**: Float
- **`capacity`**: Integer limit
- **`attendees`**: Integer (incremented on registration)
- **`status`**: `draft` | `pending` | `approved` | `rejected`
- **`image`**: Base64 String (optional)

### Notification Model
- **`id`**: UUID
- **`type`**: String (`new_event`, `event_approved`, etc.)
- **`title`, `message`**: Strings
- **`read`**: Boolean
- **`userId`**: Target specific user
- **`forRole` / `forCategory` / `forInstitution`**: Used for scoped broadcasting via fan-out pattern.
