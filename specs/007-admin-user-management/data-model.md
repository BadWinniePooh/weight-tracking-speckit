# Data Model: Admin & User Management with Email Infrastructure

**Feature**: 007-admin-user-management
**Date**: 2026-03-15

---

## Modified Entities

### User (existing — extended)

**Changes**: Add `ScheduledDeletionAt`, `EmailConfirmed`, `PendingEmail`, `LastLoginAt` columns.

```
Users table (additions only)
├── ScheduledDeletionAt  timestamp with time zone  NULL   — set when deactivated; NULL means not scheduled
├── EmailConfirmed       boolean                   NOT NULL  DEFAULT false
├── PendingEmail         character varying(255)    NULL   — new email awaiting confirmation
└── LastLoginAt          timestamp with time zone  NULL   — updated on each successful login
```

**Validation rules**:
- `EmailConfirmed` starts `false` for all admin-created accounts
- `ScheduledDeletionAt` is `NULL` for active users; set to `NOW() + USER_DELETION_GRACE_DAYS days` on deactivation; cleared on reactivation
- `PendingEmail` must pass the same uniqueness check as `Email` at the time of confirmation (not at request time, to avoid race conditions)
- `LastLoginAt` updated on every successful `/api/auth/login` and `/api/auth/refresh` response

**State transitions**:
```
[Created, EmailConfirmed=false] → (confirm email) → [Active, EmailConfirmed=true]
[Active]    → (admin deactivates)  → [Deactivated, ScheduledDeletionAt=set]
[Deactivated] → (admin reactivates) → [Active, ScheduledDeletionAt=NULL]
[Deactivated] → (grace period expires, background service) → [Deleted]
[Any]       → (admin immediate delete) → [Deleted]
```

---

## New Entities

### PasswordResetToken

Stores a single-use, time-limited token for password reset flows.

```
PasswordResetTokens table
├── Id          uuid                      NOT NULL  PK
├── UserId      uuid                      NOT NULL  FK → Users.Id (CASCADE DELETE)
├── TokenHash   character varying(64)     NOT NULL  UNIQUE  — SHA-256 hex of the plaintext token
├── ExpiresAt   timestamp with time zone  NOT NULL
├── UsedAt      timestamp with time zone  NULL      — NULL = not yet used
└── CreatedAt   timestamp with time zone  NOT NULL
```

**Indexes**:
- `IX_PasswordResetTokens_TokenHash` UNIQUE
- `IX_PasswordResetTokens_UserId`

**Validation rules**:
- Token is invalid if `ExpiresAt < NOW()` OR `UsedAt IS NOT NULL`
- Only one active (unused, unexpired) token per user required by spec; implementation may have multiple rows but only the latest is sent — old ones auto-expire
- `ExpiresAt = CreatedAt + 1 hour`

---

### EmailConfirmationToken

Stores a single-use, time-limited token for email confirmation (new accounts and email changes).

```
EmailConfirmationTokens table
├── Id            uuid                      NOT NULL  PK
├── UserId        uuid                      NOT NULL  FK → Users.Id (CASCADE DELETE)
├── TargetEmail   character varying(255)    NOT NULL  — the email address to be confirmed
├── TokenHash     character varying(64)     NOT NULL  UNIQUE
├── ExpiresAt     timestamp with time zone  NOT NULL
├── UsedAt        timestamp with time zone  NULL
└── CreatedAt     timestamp with time zone  NOT NULL
```

**Indexes**:
- `IX_EmailConfirmationTokens_TokenHash` UNIQUE
- `IX_EmailConfirmationTokens_UserId`

**Validation rules**:
- Token is invalid if `ExpiresAt < NOW()` OR `UsedAt IS NOT NULL`
- `ExpiresAt = CreatedAt + 24 hours`
- On confirmation: if `TargetEmail == Users.Email`, set `EmailConfirmed = true`; if `TargetEmail != Users.Email` (email change), update `Users.Email = TargetEmail`, `Users.PendingEmail = NULL`, `Users.EmailConfirmed = true`

---

### AuditLogEntry

Immutable record of every admin action.

```
AuditLog table
├── Id            uuid                      NOT NULL  PK
├── ActionType    character varying(50)     NOT NULL  — see Action Types below
├── ActorUserId   uuid                      NOT NULL  — admin who performed the action
├── TargetUserId  uuid                      NULL      — user affected (NULL for non-user actions)
├── IpAddress     character varying(45)     NOT NULL  — IPv4 or IPv6
└── Timestamp     timestamp with time zone  NOT NULL
```

**Indexes**:
- `IX_AuditLog_Timestamp`
- `IX_AuditLog_ActionType`
- `IX_AuditLog_ActorUserId`

**Action Types** (string enum — stored as varchar):

| ActionType | Triggered By |
|------------|-------------|
| `user_created` | Admin creates a user |
| `user_deactivated` | Admin deactivates a user |
| `user_reactivated` | Admin reactivates a user |
| `user_deleted` | Admin immediately deletes a user |
| `role_changed` | Admin changes a user's role |
| `confirmation_resent` | Admin resends confirmation email |

**Invariants**:
- `IAuditLogRepository` exposes no `Update` or `Delete` methods — append-only by interface design
- `Timestamp` is always `UTC NOW()` at write time

---

## Migration Strategy

**New migration**: `AddUserManagementAndEmailInfrastructure`

Operations (in order):
1. `ALTER TABLE "Users"` — add `ScheduledDeletionAt`, `EmailConfirmed` (DEFAULT false), `PendingEmail`, `LastLoginAt`
2. `CREATE TABLE "PasswordResetTokens"` with FK + indexes
3. `CREATE TABLE "EmailConfirmationTokens"` with FK + indexes
4. `CREATE TABLE "AuditLog"` with indexes
5. `UPDATE "Users" SET "EmailConfirmed" = true` — back-fill existing users as confirmed (seeded admin was created without email flow; existing users should be treated as confirmed)

---

## Entity Relationships

```
Users (1) ─────────── (*) RefreshTokens          [existing]
Users (1) ─────────── (*) WeightEntries           [existing]
Users (1) ─────────── (1) ChartSettings           [existing]
Users (1) ─────────── (*) PasswordResetTokens     [new]
Users (1) ─────────── (*) EmailConfirmationTokens [new]
Users (1) as actor ── (*) AuditLog.ActorUserId    [new, no FK — admin may be deleted]
Users (1) as target ─ (*) AuditLog.TargetUserId   [new, nullable, no FK — target may be deleted]
```

**Note on AuditLog foreign keys**: `ActorUserId` and `TargetUserId` are stored without enforced FK constraints. This preserves the audit log even after admin or target users are deleted. The values remain as identifiers for historical context.

---

## Domain Ports (Interfaces)

### IEmailService
```
namespace WeightTracker.Domain.Interfaces.Services;

Task SendAsync(string to, string subject, string htmlBody, CancellationToken cancellationToken = default);
```

### IPasswordResetService
```
namespace WeightTracker.Domain.Interfaces.Services;

Task RequestResetAsync(string email);
Task<bool> ResetPasswordAsync(string token, string newPasswordHash);
```

### IEmailConfirmationService
```
namespace WeightTracker.Domain.Interfaces.Services;

Task SendConfirmationAsync(Guid userId, string targetEmail);
Task<bool> ConfirmAsync(string token);
Task ResendConfirmationAsync(Guid userId);
```

### IUserManagementService
```
namespace WeightTracker.Domain.Interfaces.Services;

Task<UserDto> CreateUserAsync(string username, string email, string role);
Task DeactivateUserAsync(Guid targetUserId, Guid actorUserId, string actorIp);
Task ReactivateUserAsync(Guid targetUserId, Guid actorUserId, string actorIp);
Task DeleteUserAsync(Guid targetUserId, Guid actorUserId, string actorIp);
Task AssignRoleAsync(Guid targetUserId, string role, Guid actorUserId, string actorIp);
Task<IReadOnlyList<UserDto>> ListUsersAsync();
```

### IUserDeletionService
```
namespace WeightTracker.Domain.Interfaces.Services;

Task DeleteExpiredUsersAsync(CancellationToken cancellationToken = default);
```

### IAuditLogRepository
```
namespace WeightTracker.Domain.Interfaces.Repositories;

Task AppendAsync(AuditLogEntry entry);
Task<AuditLogPage> QueryAsync(AuditLogFilter filter);

record AuditLogFilter(int Page, int PageSize, DateTime? FromDate, DateTime? ToDate, string? ActionType);
record AuditLogPage(IReadOnlyList<AuditLogEntry> Entries, int TotalCount);
```

---

## AppDbContext Changes

New `DbSet` properties:
```csharp
public DbSet<PasswordResetToken> PasswordResetTokens => Set<PasswordResetToken>();
public DbSet<EmailConfirmationToken> EmailConfirmationTokens => Set<EmailConfirmationToken>();
public DbSet<AuditLogEntry> AuditLog => Set<AuditLogEntry>();
```

`OnModelCreating` additions:
- `PasswordResetToken`: table `PasswordResetTokens`, PK, unique index on `TokenHash`, index on `UserId`, FK → Users (Cascade)
- `EmailConfirmationToken`: table `EmailConfirmationTokens`, PK, unique index on `TokenHash`, index on `UserId`, FK → Users (Cascade)
- `AuditLogEntry`: table `AuditLog`, PK, indexes on `Timestamp`, `ActionType`, `ActorUserId`; NO FK on `ActorUserId`/`TargetUserId`
