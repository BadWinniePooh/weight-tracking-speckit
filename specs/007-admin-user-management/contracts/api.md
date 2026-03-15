# API Contracts: Admin & User Management with Email Infrastructure

**Feature**: 007-admin-user-management
**Date**: 2026-03-15
**Base path**: `/api`
**Auth**: Bearer JWT (access token in `Authorization` header), except where noted

---

## Auth Endpoints (extensions to existing)

### POST /api/auth/forgot-password

Request a password reset email. Always returns 200 regardless of whether the email exists.

**Authorization**: Anonymous

**Request body**:
```json
{ "email": "user@example.com" }
```

**Response 200**:
```json
{ "message": "If an account with that email exists, a reset link has been sent." }
```

**Notes**: Response is identical for known and unknown email addresses (anti-enumeration).

---

### POST /api/auth/reset-password

Complete a password reset using a token from the email link.

**Authorization**: Anonymous

**Request body**:
```json
{
  "token": "base64url-encoded-token",
  "newPassword": "newSecurePassword123"
}
```

**Response 200**:
```json
{ "message": "Password has been reset. You may now log in." }
```

**Response 400** (token invalid, expired, or already used):
```json
{ "error": "This reset link is invalid or has expired. Please request a new one." }
```

---

### GET /api/auth/confirm-email?token={token}

Confirm an email address (new account or email change).

**Authorization**: Anonymous

**Response 200**:
```json
{ "message": "Email confirmed. You may now log in." }
```

**Response 400** (token invalid, expired, or used):
```json
{ "error": "This confirmation link is invalid or has expired." }
```

---

## Account Self-Service Endpoints

All endpoints in this section require `Authorization: Bearer {accessToken}`.

### PUT /api/account/username

Change the authenticated user's username.

**Request body**:
```json
{ "newUsername": "mynewusername" }
```

**Response 200**:
```json
{ "username": "mynewusername" }
```

**Response 400** (validation failure):
```json
{ "error": "Username is already taken.", "field": "newUsername" }
```

---

### PUT /api/account/password

Change the authenticated user's password. Requires current password for verification.

**Request body**:
```json
{
  "currentPassword": "oldPassword123",
  "newPassword": "newPassword456"
}
```

**Response 204**: No content (success)

**Response 400** (current password incorrect):
```json
{ "error": "Current password is incorrect.", "field": "currentPassword" }
```

---

### PUT /api/account/email

Change the authenticated user's email. Sends a confirmation email to the new address; old email remains active until confirmed.

**Request body**:
```json
{ "newEmail": "newemail@example.com" }
```

**Response 200**:
```json
{ "message": "A confirmation email has been sent to newemail@example.com. Your current email remains active until confirmed." }
```

**Response 400** (email already in use):
```json
{ "error": "That email address is already in use.", "field": "newEmail" }
```

---

## Admin User Management Endpoints

All endpoints in this section require `Authorization: Bearer {accessToken}` and the `admin` role.
**Policy**: `AdminOnly`

### GET /api/admin/users

List all users.

**Response 200**:
```json
{
  "users": [
    {
      "id": "uuid",
      "username": "alice",
      "email": "alice@example.com",
      "role": "user",
      "isActive": true,
      "emailConfirmed": true,
      "createdAt": "2026-03-01T00:00:00Z",
      "lastLoginAt": "2026-03-14T10:22:00Z",
      "scheduledDeletionAt": null
    }
  ]
}
```

---

### POST /api/admin/users

Create a new user account. Sends a confirmation email.

**Request body**:
```json
{
  "username": "newuser",
  "email": "newuser@example.com",
  "role": "user"
}
```

**Response 201**:
```json
{
  "id": "uuid",
  "username": "newuser",
  "email": "newuser@example.com",
  "role": "user",
  "isActive": true,
  "emailConfirmed": false,
  "createdAt": "2026-03-15T12:00:00Z",
  "lastLoginAt": null,
  "scheduledDeletionAt": null
}
```

**Response 400** (username or email already exists):
```json
{ "error": "Username is already taken.", "field": "username" }
```

---

### POST /api/admin/users/{id}/deactivate

Deactivate a user. Prevents login and schedules deletion.

**Path param**: `id` — user UUID

**Response 200**:
```json
{
  "id": "uuid",
  "isActive": false,
  "scheduledDeletionAt": "2026-04-14T12:00:00Z"
}
```

**Response 400** (acting on own account):
```json
{ "error": "You cannot deactivate your own account." }
```

**Response 404**: User not found

---

### POST /api/admin/users/{id}/reactivate

Reactivate a deactivated user. Restores login and cancels scheduled deletion.

**Response 200**:
```json
{
  "id": "uuid",
  "isActive": true,
  "scheduledDeletionAt": null
}
```

**Response 400** (acting on own account):
```json
{ "error": "You cannot reactivate your own account." }
```

**Response 404**: User not found

---

### DELETE /api/admin/users/{id}

Immediately and permanently delete a user and all associated data.

**Response 204**: No content (success)

**Response 400** (acting on own account):
```json
{ "error": "You cannot delete your own account." }
```

**Response 404**: User not found

---

### PUT /api/admin/users/{id}/role

Assign or change a user's role.

**Request body**:
```json
{ "role": "admin" }
```

**Response 200**:
```json
{ "id": "uuid", "role": "admin" }
```

**Response 400** (invalid role or acting on own account):
```json
{ "error": "You cannot change your own role." }
```

**Response 404**: User not found

---

### POST /api/admin/users/{id}/resend-confirmation

Resend a confirmation email for an unconfirmed user.

**Response 204**: No content (success)

**Response 400** (user already confirmed):
```json
{ "error": "This user's email is already confirmed." }
```

**Response 404**: User not found

---

## Admin Audit Log Endpoint

### GET /api/admin/audit-log

Retrieve paginated audit log entries with optional filters.

**Authorization**: AdminOnly

**Query parameters**:

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `page` | integer | No | 1-based page number (default: 1) |
| `pageSize` | integer | No | Entries per page (default: 50, max: 200) |
| `fromDate` | ISO 8601 date | No | Filter entries on or after this date |
| `toDate` | ISO 8601 date | No | Filter entries on or before this date |
| `actionType` | string | No | Filter by action type (e.g., `user_created`) |

**Response 200**:
```json
{
  "entries": [
    {
      "id": "uuid",
      "actionType": "user_created",
      "actorUserId": "uuid",
      "targetUserId": "uuid",
      "ipAddress": "192.168.1.1",
      "timestamp": "2026-03-15T12:00:00Z"
    }
  ],
  "totalCount": 142,
  "page": 1,
  "pageSize": 50
}
```

---

## Error Response Shape (all endpoints)

All error responses follow the existing convention:

```json
{ "error": "Human-readable error message.", "field": "fieldName (optional)" }
```

HTTP status codes:
- `400 Bad Request` — validation failure, business rule violation
- `401 Unauthorized` — missing or invalid JWT
- `403 Forbidden` — authenticated but wrong role
- `404 Not Found` — resource does not exist

---

## Frontend api-client.ts Additions

New typed functions to add (no HTML pages in this iteration):

```typescript
// Password reset
requestPasswordReset(email: string): Promise<void>
resetPassword(token: string, newPassword: string): Promise<void>
confirmEmail(token: string): Promise<void>

// Self-service
changeUsername(newUsername: string): Promise<{ username: string }>
changePassword(currentPassword: string, newPassword: string): Promise<void>
changeEmail(newEmail: string): Promise<{ message: string }>

// Admin user management
adminListUsers(): Promise<AdminUserListResponse>
adminCreateUser(username: string, email: string, role: string): Promise<AdminUserDto>
adminDeactivateUser(id: string): Promise<{ id: string; isActive: boolean; scheduledDeletionAt: string | null }>
adminReactivateUser(id: string): Promise<{ id: string; isActive: boolean; scheduledDeletionAt: null }>
adminDeleteUser(id: string): Promise<void>
adminAssignRole(id: string, role: string): Promise<{ id: string; role: string }>
adminResendConfirmation(id: string): Promise<void>
adminGetAuditLog(params: AuditLogParams): Promise<AuditLogResponse>

// Response types
interface AdminUserDto {
  id: string;
  username: string;
  email: string;
  role: string;
  isActive: boolean;
  emailConfirmed: boolean;
  createdAt: string;
  lastLoginAt: string | null;
  scheduledDeletionAt: string | null;
}
interface AdminUserListResponse { users: AdminUserDto[]; }
interface AuditLogParams { page?: number; pageSize?: number; fromDate?: string; toDate?: string; actionType?: string; }
interface AuditLogEntry { id: string; actionType: string; actorUserId: string; targetUserId: string | null; ipAddress: string; timestamp: string; }
interface AuditLogResponse { entries: AuditLogEntry[]; totalCount: number; page: number; pageSize: number; }
```
