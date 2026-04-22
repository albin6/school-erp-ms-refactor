# School ERP Microservices - Comprehensive Technical Analysis

**Application Name:** School ERP Microservices Platform  
**Date:** April 2026  
**Status:** Full Microservices Architecture with Multi-tenancy Support

---

## 1. ARCHITECTURE OVERVIEW

### System Architecture Pattern
This is a **distributed microservices architecture** with the following characteristics:

- **Scope**: 5 independent services + 1 API Gateway
- **Communication Patterns**: 
  - Synchronous: REST HTTP + gRPC (inter-service calls)
  - Asynchronous: Apache Kafka (event-driven messaging)
- **Multi-tenancy Model**: Database-per-tenant with a central identity/auth service
- **Frontend**: React/Vite SPA with subdomain-based tenant routing
- **Deployment**: Docker Compose (development), Kubernetes (production)

### Core Services

| Service | Port (HTTP) | Port (gRPC) | Database | Role |
|---------|-----------|-----------|----------|------|
| **API Gateway** | 8000 | - | None | Edge router, JWT validation, rate limiting, subdomain routing |
| **Identity Service** | 3001 | 5001 | PostgreSQL (identity_db) | User authentication, token management, super admin |
| **Tenant Service** | 3002 | 5002 | PostgreSQL (tenant_db) | Tenant/branch management, multi-tenancy orchestration |
| **Notification Service** | 3003 | - | PostgreSQL (notification_db) | Email notifications via Kafka consumption |
| **Audit Service** | 3004 | - | PostgreSQL (audit_db) | Append-only event logging, immutable audit trail |

### Supporting Infrastructure

- **Message Broker**: Apache Kafka (with Zookeeper, Kafka UI on 8090)
- **Cache**: Redis 7 (session/token blacklist)
- **Monitoring**: Prometheus, Grafana (3100), Jaeger Tracing (16686)
- **Orchestration**: Docker Compose (development), Kubernetes manifests (production)

---

## 2. SERVICE BREAKDOWN

### 2.1 API Gateway (`services/api-gateway/`)

**Purpose**: Single entry point for all client requests; orchestrates routing to backend services.

**Key Responsibilities**:
- JWT token validation via gRPC call to Identity Service
- Subdomain extraction and tenant context injection
- Request/response proxying to tenant-specific services
- Correlation ID injection for distributed tracing
- Rate limiting (1000 requests/minute)
- CORS configuration
- Security headers (Helmet)

**HTTP Endpoints** (Proxy Routes):
```
POST   /api/auth/*                    → Identity Service
GET    /api/users/*                   → Identity Service
GET    /api/tenants/*                 → Tenant Service
POST   /api/tenants/*                 → Tenant Service
GET    /api/branches/*                → Tenant Service
POST   /api/branches/*                → Tenant Service
GET    /api/memberships/*             → Tenant Service
```

**Key Middleware**:
- Token validation via gRPC (ValidateToken RPC)
- Tenant lookup via gRPC (GetTenantBySubdomain RPC)
- Subdomain parsing from Host header
- Request header augmentation:
  - `x-correlation-id`: Trace ID
  - `x-tenant-id`: From subdomain
  - `x-user-id`, `x-user-email`, `x-user-role`: From JWT token

**Dependencies**:
- `@grpc/grpc-js`, `@grpc/proto-loader`: gRPC clients
- `express-rate-limit`: Rate limiting
- `http-proxy-middleware`: Request proxying
- `opossum`: Circuit breaker pattern (resilience)
- `helmet`: Security headers

---

### 2.2 Identity Service (`services/identity-service/`)

**Purpose**: Central authentication and authorization service; manages user identity, tokens, and credentials.

**Main Responsibility**:
- User registration and login (super admin only)
- JWT token generation and validation
- Refresh token management with token family tracking
- Password management (hashing, reset flow)
- Account lockout after failed login attempts (5 attempts → 15-minute lockout)
- Event publishing (user created, login succeeded/failed)

**HTTP REST Endpoints** (`/api/auth`):
```
POST   /api/auth/login                          - User login
GET    /api/auth/me                             - Get current user (requires JWT)
POST   /api/auth/logout                         - Logout (requires JWT)
POST   /api/auth/forgot-password                - Placeholder
POST   /api/auth/reset-password                 - Placeholder
POST   /api/auth/verify-otp                     - Placeholder
POST   /api/auth/resend-otp                     - Placeholder
POST   /api/auth/logout-all                     - Logout all sessions (requires JWT)
```

**gRPC Service** (`:5001`):
```protobuf
service IdentityService {
  rpc ValidateToken(ValidateTokenRequest) returns (ValidateTokenResponse);
  rpc GetUserById(GetUserByIdRequest) returns (UserProfile);
  rpc GetUserByEmail(GetUserByEmailRequest) returns (UserProfile);
  rpc CreateUser(CreateUserRequest) returns (CreateUserResponse);
}
```

**Database Schema** (`identity_db`):
```sql
-- Core user entity
users (
  id UUID PRIMARY KEY,
  email VARCHAR UNIQUE,
  password_hash VARCHAR,
  name VARCHAR,
  is_super_admin BOOLEAN,
  is_active BOOLEAN,
  must_reset_password BOOLEAN,
  failed_login_attempts INT,
  lockout_until TIMESTAMPTZ,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)

-- Token family tracking (prevent token reuse attacks)
refresh_tokens (
  id UUID PRIMARY KEY,
  user_id UUID → users(id),
  token_hash VARCHAR,
  family_id UUID,
  expires_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_ip INET,
  created_at TIMESTAMPTZ
)

-- Password reset OTP tracking
password_reset_tokens (
  id UUID PRIMARY KEY,
  email VARCHAR,
  otp_hash VARCHAR,
  expires_at TIMESTAMPTZ,
  used_at TIMESTAMPTZ,
  attempts INT,
  max_attempts INT,
  ip_address INET,
  created_at TIMESTAMPTZ
)
```

**Key Classes & Entities**:
- `User` aggregate: Encapsulates user business logic
  - `isLockedOut()`: Check account lockout status
  - `recordFailedLogin()`: Track failed login attempts
  - `recordSuccessfulLogin()`: Reset counters on success
  - `updatePassword()`: Update password hash

**Security Features**:
- JWT with configurable expiry (default: 15m access, 7d refresh)
- Refresh token rotation with family tracking
- Token blacklist via Redis cache
- Password hashing with bcrypt
- Account lockout mechanism
- IP/User-Agent tracking

**Kafka Events Published**:
- `identity.user.created`: On new user creation
- `identity.login.succeeded`: On successful login
- `identity.login.failed`: On failed login attempt
- `identity.password.reset`: On password reset

**External Integration**:
- SMTP for password reset emails (nodemailer)
- gRPC calls to Tenant Service (get membership info)

---

### 2.3 Tenant Service (`services/tenant-service/`)

**Purpose**: Multi-tenancy orchestration; manages tenant organizations, branches, and user memberships.

**Main Responsibility**:
- Tenant CRUD operations (create, read, update, delete)
- Branch management within tenants
- Tenant user membership management (role-based)
- Outbox pattern implementation for event reliability
- gRPC service for tenant lookups by subdomain

**HTTP REST Endpoints** (`/api/tenants`):
```
GET    /api/tenants/check-availability          - Check subdomain availability (public)
GET    /api/tenants                             - List all tenants (super admin only)
POST   /api/tenants                             - Create tenant (super admin only)
GET    /api/tenants/:id                         - Get tenant details
PUT    /api/tenants/:id                         - Update tenant (super admin only)
DELETE /api/tenants/:id                         - Delete tenant (super admin only)
PATCH  /api/tenants/:id/block                   - Block/unblock tenant (super admin only)
PATCH  /api/tenants/:id/unblock                 - Unblock tenant (super admin only)

GET    /api/tenants/:tenantId/branches          - List branches in tenant
POST   /api/tenants/:tenantId/branches          - Create branch
GET    /api/tenants/:tenantId/branches/:branchId - Get branch details

GET    /api/tenants/:tenantId/users             - List tenant users
POST   /api/tenants/:tenantId/users             - Create tenant user
```

**gRPC Service** (`:5002`):
```protobuf
service TenantService {
  rpc GetTenantBySubdomain(GetTenantBySubdomainRequest) returns (TenantInfo);
  rpc GetTenantById(GetTenantByIdRequest) returns (TenantInfo);
  rpc GetMembership(GetMembershipRequest) returns (MembershipInfo);
}
```

**Database Schema** (`tenant_db`):
```sql
-- Tenant organization entity
tenants (
  id UUID PRIMARY KEY,
  name VARCHAR,
  subdomain VARCHAR UNIQUE,
  domain VARCHAR,
  status ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED'),
  is_active BOOLEAN,
  settings JSONB,
  created_by UUID,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)

-- Physical branches/campuses within tenant
branches (
  id UUID PRIMARY KEY,
  tenant_id UUID → tenants(id),
  name VARCHAR,
  slug VARCHAR,
  address TEXT,
  phone VARCHAR,
  email VARCHAR,
  status VARCHAR,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  UNIQUE(tenant_id, name),
  UNIQUE(tenant_id, slug)
)

-- User-to-tenant-branch assignment
memberships (
  id UUID PRIMARY KEY,
  user_id UUID,                          -- Foreign reference to identity_db.users
  tenant_id UUID → tenants(id),
  branch_id UUID → branches(id),
  role ENUM ('ADMIN', 'STAFF', 'STUDENT'),
  sub_role ENUM ('PRINCIPAL', 'TEACHER', 'OFFICE_STAFF', 'OFFICE_ASSISTANT'),
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  UNIQUE(user_id, tenant_id)
)

-- Transactional Outbox (ensures event reliability)
outbox_events (
  id UUID PRIMARY KEY,
  aggregate_type VARCHAR,
  aggregate_id UUID,
  event_type VARCHAR,
  payload JSONB,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ
)
```

**Key Classes & Entities**:
- `Tenant` aggregate: 
  - Properties: id, name, subdomain, domain, status, settings, isActive
  - Methods: `updateSettings()`, `suspend()`, `activate()`
  - Validation: Subdomain must be lowercase, alphanumeric + hyphens only

- `Membership` aggregate:
  - Properties: userId, tenantId, branchId, role, subRole
  - Methods: `updateRole()`
  - Validation: STAFF/STUDENT must have branchId; ADMIN cannot have subRole

- `Branch`: Physical location within tenant

**Patterns Implemented**:
- **Outbox Pattern**: Events written to database in same transaction, then relayed by background worker
- **Outbox Worker**: Polls `outbox_events` table every 2 seconds, processes 50 events at a time
- **Cross-Database Joins**: User references are soft (no FK) since they live in different DB

**Kafka Events Published**:
- `tenant.created`: When new tenant created
- `membership.created`: When user assigned to tenant

---

### 2.4 Notification Service (`services/notification-service/`)

**Purpose**: Async notification delivery; consumes events from Kafka and sends emails.

**Main Responsibility**:
- Email delivery via SMTP
- Idempotent event handling (tracks sent notifications)
- Kafka consumer for event subscriptions

**HTTP Endpoints** (Health only):
```
GET    /health/live                             - Liveness probe
GET    /health/ready                            - Readiness probe
```

**Kafka Topic Subscriptions**:
- `tenant.created`: Sends welcome email to tenant admin
- `identity.user.created`: Sends initial password email to new user

**Database Schema** (`notification_db`):
```sql
-- Idempotency table (prevent duplicate emails on message replay)
notification_logs (
  id UUID PRIMARY KEY,
  event_id UUID,
  event_type VARCHAR,
  recipient VARCHAR,
  channel VARCHAR DEFAULT 'EMAIL',
  status VARCHAR,
  error_message TEXT,
  created_at TIMESTAMPTZ,
  UNIQUE(event_id, recipient, channel)
)
```

**Email Templates** (Implicit):
- Tenant creation welcome email
- User creation with temporary password
- Password reset confirmation
- Account notification emails

**Dependencies**:
- `nodemailer`: SMTP client
- `kafkajs`: Kafka consumer

---

### 2.5 Audit Service (`services/audit-service/`)

**Purpose**: Immutable event audit trail; append-only logging for compliance and forensics.

**Main Responsibility**:
- Consume all events from Kafka
- Record in append-only database
- Provide read-only audit query APIs
- No event deletion (compliance requirement)

**HTTP Endpoints** (Health only):
```
GET    /health/live                             - Liveness probe
GET    /health/ready                            - Readiness probe
```

**Kafka Consumption**:
- Subscribes to all topics using regex: `/^(?!__).*$/`
- Consumes from latest message onwards (`fromBeginning: false`)

**Database Schema** (`audit_db`):
```sql
-- Append-only event log (immutable)
audit_logs (
  id UUID PRIMARY KEY,
  event_id UUID UNIQUE,
  event_type VARCHAR,
  aggregate_id VARCHAR,
  correlation_id VARCHAR,
  occurred_at TIMESTAMPTZ,
  payload JSONB,
  recorded_at TIMESTAMPTZ DEFAULT NOW()
)

CREATE INDEX idx_audit_event_type ON audit_logs(event_type);
CREATE INDEX idx_audit_aggregate_id ON audit_logs(aggregate_id);
CREATE INDEX idx_audit_correlation_id ON audit_logs(correlation_id);
CREATE INDEX idx_audit_occurred_at ON audit_logs(occurred_at);
```

**Characteristics**:
- No update/delete operations
- Timestamped at recording time
- Includes correlation ID for tracing
- Indexed for forensic queries

---

## 3. AUTHENTICATION & AUTHORIZATION FLOW

### 3.1 Overall Auth Architecture

```
┌──────────────┐
│   Frontend   │
│ (React/Vite)│
└──────┬───────┘
       │ POST /api/auth/login
       ↓
┌──────────────────┐
│   API Gateway    │  ← No auth check on /login
│  (Port 8000)     │
└──────┬───────────┘
       │ proxies to
       ↓
┌──────────────────────┐
│ Identity Service     │  ← Validates credentials
│ (Port 3001/5001)     │
└──────┬───────────────┘
       │ Returns { accessToken, refreshToken }
       │ Sets refreshToken in httpOnly cookie
       ↓
┌──────────────┐
│   Frontend   │
│   Stores:    │
│ - accessToken│
│ - user data  │
└──────────────┘
```

### 3.2 Login Flow (Super Admin / Identity Service)

**Endpoint**: `POST /api/auth/login`

**Request**:
```json
{
  "email": "admin@school.com",
  "password": "securePassword123"
}
```

**Process**:
1. Identity Service receives login request
2. Fetch user from `identity_db.users` by email
3. Check if user is locked out (lockout_until > now)
4. Verify password hash using bcrypt
5. On failed login:
   - Increment `failed_login_attempts`
   - If >= 5 attempts: Set `lockout_until = now + 15 minutes`
   - Publish `identity.login.failed` event to Kafka
6. On successful login:
   - Reset `failed_login_attempts = 0`, clear `lockout_until`
   - Update `last_login_at = now`
   - Generate JWT tokens via `generateTokens()`
   - Save refresh token to `refresh_tokens` table (with family_id for token rotation)
   - Publish `identity.login.succeeded` event
   - Set httpOnly, secure, sameSite=strict cookie with refreshToken
   - Return accessToken in response body

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "admin@school.com",
      "name": "Admin Name",
      "isSuperAdmin": true,
      "mustResetPassword": false
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**Token Structure** (JWT Payload):
```json
{
  "userId": "uuid",
  "email": "admin@school.com",
  "role": "SUPER_ADMIN",
  "tenantId": null,
  "subRole": null,
  "iat": 1713696000,
  "exp": 1713696900
}
```

### 3.3 Multi-Tenant Login Flow (Staff/Student)

**Endpoints** (Not yet fully implemented):
```
POST   /api/auth/tenant/:tenantId/admin/login
POST   /api/auth/tenant/:tenantId/staff/login
POST   /api/auth/tenant/:tenantId/student/login
```

**Expected Process**:
1. User logs in with email/password to tenant-specific endpoint
2. Lookup user from `identity_db.users`
3. Lookup membership from `tenant_db.memberships` for user + tenant combination
4. Verify user has correct role (ADMIN/STAFF/STUDENT)
5. Generate token with:
   - `tenantId`: Tenant they're logging into
   - `role`: Base role (ADMIN/STAFF/STUDENT)
   - `subRole`: If applicable (PRINCIPAL/TEACHER/etc)
6. Return token + tenant context

### 3.4 Token Validation Flow

**At API Gateway**:

1. Extract token from `Authorization: Bearer <token>` header
2. Call Identity Service gRPC `ValidateToken(token)`
3. Identity Service:
   - Check if token blacklisted in Redis
   - Verify JWT signature using `JWT_ACCESS_SECRET`
   - Return decoded payload or error
4. API Gateway injects headers:
   - `x-user-id`: From token payload
   - `x-user-email`: From token payload
   - `x-user-role`: From token payload
   - `x-tenant-id`: From request subdomain lookup + validation
5. Proxy to backend service

**At Service Level** (e.g., Tenant Service):

- `requireAuth` middleware extracts token from Bearer header
- Calls `verifyAccessToken()` to decode JWT
- Attaches payload to `req.user`
- Next middleware/handler can access `(req as any).user`

### 3.5 Token Refresh Flow

**Client-side** (React API interceptor):

When API request returns 401:
1. Check if endpoint is auth endpoint (skip refresh)
2. Call refresh endpoint based on auth context:
   - Super admin: `POST /auth/refresh`
   - Tenant user: `POST /auth/tenant/{subdomain}/refresh`
3. Backend returns new accessToken
4. Update client-side token store
5. Retry original request with new token
6. If refresh fails → redirect to login

**Server-side** (Backend):

1. Extract refreshToken from httpOnly cookie
2. Verify refresh token JWT signature using `JWT_REFRESH_SECRET`
3. Validate token hasn't been revoked (check `refresh_tokens.revoked_at`)
4. Check refresh token family for token reuse attacks
5. Generate new access token (same payload)
6. Return new access token in response body

### 3.6 Authorization (Role-Based Access Control)

**Super Admin Level**:
- `requireSuperAdmin` middleware: Check `role === 'SUPER_ADMIN'`
- Can access:
  - Tenant management (list, create, update, delete)
  - User management
  - System configuration

**Tenant Admin Level**:
- `role === 'ADMIN'` + tenant membership required
- Can access:
  - Tenant-specific data
  - Branch management
  - User management within tenant

**Staff/Student Level**:
- `role === 'STAFF' | 'STUDENT'` + valid membership
- Can access:
  - Own user data
  - Assigned branch data
  - Role-specific features

---

## 4. DATA MODELS

### 4.1 Core Entities & Relationships

```
┌─────────────────────────────────┐
│         IDENTITY_DB             │
├─────────────────────────────────┤
│  Users (Global - all users)     │
│  ├─ id (UUID)                   │
│  ├─ email (UNIQUE)              │
│  ├─ password_hash               │
│  ├─ name                        │
│  ├─ is_super_admin (BOOLEAN)    │
│  ├─ is_active (BOOLEAN)         │
│  ├─ must_reset_password         │
│  ├─ failed_login_attempts       │
│  ├─ lockout_until (TIMESTAMPTZ) │
│  ├─ last_login_at (TIMESTAMPTZ) │
│  └─ created_at, updated_at      │
│                                 │
│  Refresh Tokens (Token Family)  │
│  ├─ id (UUID)                   │
│  ├─ user_id → Users(id)         │
│  ├─ token_hash (salted)         │
│  ├─ family_id (rotation group)  │
│  ├─ expires_at (TIMESTAMPTZ)    │
│  ├─ revoked_at (NULL if active) │
│  └─ created_ip (INET)           │
│                                 │
│  Password Reset Tokens          │
│  ├─ id (UUID)                   │
│  ├─ email                       │
│  ├─ otp_hash                    │
│  ├─ expires_at (TIMESTAMPTZ)    │
│  ├─ used_at (NULL if unused)    │
│  ├─ attempts, max_attempts      │
│  └─ ip_address (INET)           │
└─────────────────────────────────┘

┌──────────────────────────────────┐
│        TENANT_DB (Per-DB)        │
├──────────────────────────────────┤
│  Tenants (Organizations)        │
│  ├─ id (UUID)                   │
│  ├─ name (VARCHAR)              │
│  ├─ subdomain (UNIQUE)          │
│  ├─ domain (VARCHAR)            │
│  ├─ status (ACTIVE|INACTIVE...) │
│  ├─ settings (JSONB)            │
│  ├─ is_active (BOOLEAN)         │
│  ├─ created_by (UUID soft ref)  │
│  └─ created_at, updated_at      │
│                                 │
│  Branches (Physical Locations)  │
│  ├─ id (UUID)                   │
│  ├─ tenant_id → Tenants(id)     │
│  ├─ name (VARCHAR)              │
│  ├─ slug (VARCHAR)              │
│  ├─ address (TEXT)              │
│  ├─ phone (VARCHAR)             │
│  ├─ email (VARCHAR)             │
│  ├─ status (VARCHAR)            │
│  └─ created_at, updated_at      │
│                                 │
│  Memberships (User Assignments) │
│  ├─ id (UUID)                   │
│  ├─ user_id (UUID soft ref)     │
│  ├─ tenant_id → Tenants(id)     │
│  ├─ branch_id → Branches(id)    │
│  ├─ role (ADMIN|STAFF|STUDENT)  │
│  ├─ sub_role (PRINCIPAL|TEACHER)│
│  └─ created_at, updated_at      │
│                                 │
│  Outbox Events (Event Relay)    │
│  ├─ id (UUID)                   │
│  ├─ aggregate_type (VARCHAR)    │
│  ├─ aggregate_id (UUID)         │
│  ├─ event_type (VARCHAR)        │
│  ├─ payload (JSONB)             │
│  ├─ processed_at (NULL = todo)  │
│  └─ created_at (TIMESTAMPTZ)    │
└──────────────────────────────────┘

┌──────────────────────────────────┐
│       NOTIFICATION_DB            │
├──────────────────────────────────┤
│  Notification Logs (Idempotency) │
│  ├─ id (UUID)                   │
│  ├─ event_id (UUID)             │
│  ├─ event_type (VARCHAR)        │
│  ├─ recipient (VARCHAR - email) │
│  ├─ channel (VARCHAR - EMAIL)   │
│  ├─ status (SENT|FAILED|etc)    │
│  ├─ error_message (TEXT)        │
│  └─ created_at (TIMESTAMPTZ)    │
└──────────────────────────────────┘

┌──────────────────────────────────┐
│         AUDIT_DB (Append-Only)   │
├──────────────────────────────────┤
│  Audit Logs (Immutable Trail)    │
│  ├─ id (UUID)                   │
│  ├─ event_id (UUID UNIQUE)      │
│  ├─ event_type (VARCHAR)        │
│  ├─ aggregate_id (VARCHAR)      │
│  ├─ correlation_id (VARCHAR)    │
│  ├─ occurred_at (TIMESTAMPTZ)   │
│  ├─ payload (JSONB)             │
│  └─ recorded_at (TIMESTAMPTZ)   │
└──────────────────────────────────┘
```

### 4.2 Entity Relationships

**Cross-Database Relationships**:
```
┌─────────────────────────────────────────┐
│  Identity DB                Tenant DB    │
├─────────────────────────────────────────┤
│ Users (1)  ←──── Soft Ref ────→ (M) Memberships
│                                         │
│            One user can have           │
│            multiple memberships        │
│            across tenants              │
└─────────────────────────────────────────┘
```

**Within Tenant DB**:
```
Tenant (1) ←──FK──→ (M) Branches
Tenant (1) ←──FK──→ (M) Memberships
Tenant (1) ←──FK──→ (M) Outbox Events

Branch (1) ←──FK──→ (M) Memberships
```

### 4.3 User Roles & Hierarchies

**Global Roles** (Identity Service):
- `SUPER_ADMIN`: Platform administrator

**Tenant Roles** (Tenant Service - in Membership):
- `ADMIN`: Tenant organization admin
- `STAFF`: Teacher, office staff, etc.
- `STUDENT`: Student user

**Sub-Roles** (Optional, for STAFF/STUDENT):
- `PRINCIPAL`: School principal
- `TEACHER`: Classroom teacher
- `OFFICE_STAFF`: Administrative staff
- `OFFICE_ASSISTANT`: Assistant staff

**Role Hierarchy**:
```
SUPER_ADMIN (platform-wide)
  ├─ Can manage all tenants
  ├─ Can create/delete tenants
  └─ Can view audit logs

ADMIN (tenant-scoped)
  ├─ Can manage branches
  ├─ Can manage tenant users
  ├─ Can assign roles within tenant
  └─ Cannot access other tenants

STAFF (tenant + branch-scoped)
  ├─ Can access assigned branch data
  ├─ Role defined by sub_role
  └─ Cannot cross tenant boundaries

STUDENT (tenant + branch-scoped)
  ├─ Can access assigned branch data
  └─ Cannot cross tenant boundaries
```

---

## 5. FRONTEND INTEGRATION

### 5.1 React Application Structure

**Framework**: React 19 + Vite + TypeScript  
**Location**: `web/` directory  
**Key Libraries**:
- `react-router-dom`: Routing (v7)
- `zustand`: State management with persistence
- `axios`: HTTP client
- `antd`: UI components (Ant Design)
- `framer-motion`: Animations
- `tailwindcss`: Styling

### 5.2 Multi-Domain Architecture

**Subdomain Strategy**:
```
localhost:5173               → Landing page (marketing)
sadmin.localhost:5173        → Super admin dashboard
tenant-slug.localhost:5173   → Tenant-specific app
```

**Subdomain Detection** (`web/src/utils/subdomain.ts`):
```typescript
getSubdomain()           → Extract first part of hostname
isRootDomain()           → Check if root/landing
isSuperAdminDomain()     → Check if sadmin subdomain
isTenantDomain()         → Check if tenant subdomain
getTenantSubdomain()     → Get tenant name from URL
navigateToSubdomain()    → Redirect to subdomain
```

### 5.3 API Integration (`web/src/services/api.ts`)

**Base Setup**:
- Base URL: Configurable via env (e.g., `http://localhost:8000`)
- Timeout: 10 seconds
- withCredentials: true (includes cookies)

**Request Interceptor** (adds auth headers):
```typescript
1. Get accessToken from appropriate store
   - Super admin: useAuthStore
   - Tenant: useTenantAuthStore
2. If tenant context: add header x-tenant-subdomain
3. Add Authorization: Bearer <token> header
```

**Response Interceptor** (handles 401 - token refresh):
```typescript
1. If 401 and not auth endpoint:
   a. Determine context (super admin vs tenant)
   b. Call appropriate refresh endpoint
   c. Update token in store
   d. Retry original request
   e. If refresh fails → redirect to login
```

### 5.4 State Management

**Super Admin Auth Store** (`web/src/store/authStore.ts`):
```typescript
interface AuthState {
  user: User | null              // Super admin user
  accessToken: string | null
  isAuthenticated: boolean
  
  methods:
    login(user, accessToken)      // Set auth state
    logout()                       // Call /auth/logout
    logoutAll()                    // Logout all sessions
    setAccessToken(token)          // Update token
    checkAuth()                    // Verify current auth
    clearAuth()                    // Clear all auth data
}

// Persisted to localStorage as 'auth-storage'
// Partializes: user, isAuthenticated (not accessToken for security)
```

**Tenant User Auth Store** (`web/src/store/tenantAuthStore.ts`):
```typescript
interface TenantAuthState {
  user: TenantUser | null        // Tenant user (admin/staff/student)
  tenant: Tenant | null          // Tenant context
  accessToken: string | null
  isAuthenticated: boolean
  
  methods:
    loginAdmin(email, password, tenantId)
    loginStaff(email, password, tenantId)
    loginStudent(email, password, tenantId)
    logout(tenantId)
    setAccessToken(token)
    checkAuth()
    clearAuth()
}
```

### 5.5 Routing Structure

**Landing Router** (`web/src/router/LandingRouter.tsx`):
```
/                           → Landing/marketing page
```

**Super Admin Router** (`web/src/router/SuperAdminRouter.tsx`):
```
/dashboard                  → Admin dashboard
/tenants                    → Tenant management
/users                      → User management
/audit                      → Audit logs
```

**Tenant Router** (`web/src/router/TenantRouter.tsx`):
```
/dashboard                  → Tenant dashboard
/branches                   → Branch management
/users                      → Tenant user management
/classes                    → Class management (if applicable)
/schedule                   → Schedule management (if applicable)
```

### 5.6 Component Architecture

**Key Components**:
- `App.tsx`: Main routing dispatcher
- `common/`: Reusable UI components
- `layout/`: Layout wrappers
- `modules/`: Feature-specific components (auth, dashboard, etc.)

**API Service Usage**:
```typescript
// Example: Fetch tenants (super admin)
const { tenants } = await api.get('/api/tenants');

// Example: Create branch
await api.post('/api/tenants/:tenantId/branches', {
  name, address, phone, email
});

// Example: Get current user
const { user } = await api.get('/api/auth/me');
```

---

## 6. INFRASTRUCTURE

### 6.1 Docker Compose Setup (`docker-compose.yml`)

**Network**: `school-erp-net` (bridge)

**Databases** (All PostgreSQL 16-Alpine):

| Container | Port | Database | User | Purpose |
|-----------|------|----------|------|---------|
| identity-db | 5432 | identity_db | identity_user | User credentials, tokens |
| tenant-db | 5433 | tenant_db | tenant_user | Tenants, branches, memberships |
| notification-db | 5434 | notification_db | notification_user | Email/SMS logs |
| audit-db | 5435 | audit_db | audit_user | Append-only audit trail |

**Message Queue**:
- **Zookeeper** (conf.ip): Kafka coordination
- **Kafka**: Broker with 3 partitions, auto-create topics, 168-hour retention
  - Port 9092: Internal (container-to-container)
  - Port 29092: External (localhost)
- **Kafka UI**: http://localhost:8090 (visual monitoring)

**Cache**:
- **Redis 7**: Key-value store for session/token blacklist
  - Port 6379
  - Password: redis_pass
  - Persistence: AOF enabled

**Services** (All depend on their respective DB + Kafka):

| Service | Port | Type | Dependencies |
|---------|------|------|--------------|
| identity-service | 3001 (HTTP), 5001 (gRPC) | REST + gRPC | identity-db, redis, kafka |
| tenant-service | 3002 (HTTP), 5002 (gRPC) | REST + gRPC | tenant-db, kafka |
| notification-service | 3003 (HTTP) | REST (health) | notification-db, kafka |
| audit-service | 3004 (HTTP) | REST (health) | audit-db, kafka |
| api-gateway | 8000 (HTTP) | REST proxy | identity-service, tenant-service, redis |

**Monitoring Stack**:
- **Jaeger**: Distributed tracing (port 16686)
  - OTLP GRPC: 4317
  - OTLP HTTP: 4318
- **Prometheus**: Metrics collection (port 9090)
  - Scrapes: services at `/metrics` endpoint
- **Grafana**: Visualization (port 3100)
  - Admin: admin/admin
  - Data sources: Prometheus, Jaeger

### 6.2 Kubernetes Deployment (`k8s/identity-service.yaml`)

**Deployment Configuration**:
```yaml
Replicas:      3
Min Replicas:  3
Max Replicas:  10 (HPA)

Resources:
  Requests:    CPU 100m, Memory 128Mi
  Limits:      CPU 500m, Memory 512Mi

Health Checks:
  Liveness:    GET /health/live (20s delay, 15s interval)
  Readiness:   GET /health/ready (10s delay, 5s interval)

Scaling:
  CPU Target:  70% average utilization
```

**Service Configuration**:
- Service name: `identity-service`
- Namespace: `school-erp`
- Port mapping:
  - HTTP: 80 → 3000
  - gRPC: 5000 → 5000

### 6.3 Configuration Management

**Environment Variables** (per service, via `.env` files):

**Identity Service** (`services/identity-service/.env`):
```
NODE_ENV=production
HTTP_PORT=3000
GRPC_PORT=5000
DB_HOST=identity-db
DB_PORT=5432
DB_NAME=identity_db
DB_USER=identity_user
DB_PASSWORD=identity_pass
REDIS_URL=redis://:redis_pass@redis:6379
KAFKA_BROKERS=kafka:9092
JWT_ACCESS_SECRET=<32+ char secret>
JWT_REFRESH_SECRET=<32+ char secret>
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
CORS_ALLOWED_ORIGINS=http://localhost:5173,http://sadmin.localhost:5173
```

**API Gateway** (`services/api-gateway/.env`):
```
PORT=3000
IDENTITY_SERVICE_URL=http://identity-service:3000
TENANT_SERVICE_URL=http://tenant-service:3000
CORS_ALLOWED_ORIGINS=http://localhost:5173,http://sadmin.localhost:5173
```

### 6.4 Monitoring & Observability

**Health Endpoints** (all services):
```
GET /health/live    → Liveness: Service is running
GET /health/ready   → Readiness: Service is ready to serve traffic
GET /metrics        → Prometheus metrics (placeholder)
```

**Logging**:
- Winston logger with structured JSON output
- Correlation ID propagation via `x-correlation-id` header
- Log levels: DEBUG, INFO, WARN, ERROR

**Tracing**:
- Jaeger integration (instrumentation TODO)
- Correlation ID included in all logs

**Metrics**:
- Prometheus scrape endpoints configured
- Placeholder metrics endpoint implemented
- TODO: Implement business metrics

---

## 7. KEY DATA FLOWS

### 7.1 User Registration Flow (Super Admin Only)

```
[Frontend]
    ↓
POST /api/auth/register
    ↓
[API Gateway]
    ↓ (unauth, no token required)
    ↓
[Identity Service]
    │
    ├─ Validate email format
    ├─ Check if email already exists
    │
    ├─ Create User aggregate:
    │   ├─ Generate temporary password
    │   ├─ Hash password with bcrypt
    │   └─ Set must_reset_password = true
    │
    ├─ Save to users table (if not exists - idempotent)
    │
    ├─ Publish identity.user.created event
    │   └─ Kafka: identity.user.created
    │
    └─ Return: { userId, temporaryPassword }
        │
        ↓
    [Notification Service] consumes event
        │
        ├─ Parse event
        ├─ Check idempotency: SELECT FROM notification_logs WHERE event_id = ?
        ├─ If duplicate: skip
        │
        └─ Send email:
           ├─ To: user email
           ├─ Body: "Your temp password: {{ temporaryPassword }}"
           ├─ Insert into notification_logs (success)
           └─ Record in audit_db (via Kafka → Audit Service)

[Frontend] shows: "User created, temp password sent to email"
```

### 7.2 Multi-Tenant Login Flow (Staff/Student)

```
[Frontend] - Tenant subdomain
    ↓
POST /api/auth/tenant/{tenantId}/staff/login
    ├─ email, password
    └─ Host: staff.myschool.localhost:5173
        │
        ↓
[API Gateway]
    ├─ Extract subdomain: "staff" / "myschool"
    ├─ Call Tenant Service gRPC: GetTenantBySubdomain("myschool")
    │   └─ Returns: { tenantId, isActive }
    │
    ├─ Check tenant is active
    └─ Inject headers: x-tenant-id, x-correlation-id
        │
        ↓
[Tenant Service HTTP] - login endpoint
    ├─ Extract from body: { email, password, tenantId }
    │
    ├─ Call Identity Service gRPC: GetUserByEmail(email)
    │   └─ Returns: { userId, passwordHash, isActive }
    │
    ├─ Verify password against hash (bcrypt)
    ├─ Check account not locked
    │
    ├─ Call Tenant Service DB: GetMembership(userId, tenantId)
    │   └─ Returns: { membershipId, role, subRole, branchId }
    │
    ├─ Verify user has STAFF role
    │
    ├─ Generate JWT token:
    │   ├─ userId, email, role (STAFF), subRole, tenantId
    │   └─ Signed with JWT_ACCESS_SECRET (15m expiry)
    │
    ├─ Publish identity.login.succeeded event
    │   └─ Kafka: identity.login.succeeded
    │
    └─ Return:
       ├─ accessToken (JWT)
       ├─ user: { id, email, name, role, subRole }
       └─ tenant: { id, name, subdomain }
           │
           ↓
    [Audit Service] consumes event via Kafka
        └─ Records in audit_db for compliance
            │
            ↓
[Frontend]
    ├─ Store token in zustand store
    ├─ Store tenant context
    └─ Redirect to dashboard
```

### 7.3 Audit Logging Flow (Cross-Service)

```
[Any Service]
    ├─ User action triggered
    ├─ Publishes domain event to Kafka
    │   ├─ Topic: identity.user.created
    │   ├─ Topic: tenant.created
    │   ├─ Topic: membership.created
    │   └─ Topic: identity.login.succeeded
    │
    └─ Message format:
       ├─ eventId (UUID)
       ├─ eventType (string)
       ├─ aggregateId (UUID)
       ├─ occurredAt (ISO timestamp)
       ├─ correlationId (UUID - from x-correlation-id header)
       ├─ payload (JSON event data)
       └─ Headers:
          ├─ correlation-id
          ├─ event-type
          └─ occurred-at
           │
           ↓
[Audit Service] - Kafka Consumer
    │
    ├─ Subscribe to all topics: /^(?!__).*$/
    ├─ Consume from latest offset
    │
    └─ For each message:
       ├─ Parse JSON
       ├─ Extract: eventId, eventType, aggregateId, payload
       ├─ Record to audit_logs table:
       │   ├─ event_id (UNIQUE)
       │   ├─ event_type
       │   ├─ aggregate_id
       │   ├─ correlation_id
       │   ├─ occurred_at
       │   ├─ payload (JSONB)
       │   └─ recorded_at = NOW()
       │
       └─ Commit offset (Kafka consumer group tracking)
           │
           ↓
[Query] - Compliance/Forensics
    └─ SELECT * FROM audit_logs
       WHERE correlation_id = ?
       OR aggregate_id = ?
       OR event_type LIKE ?
```

### 7.4 Transactional Outbox Pattern (Tenant Service)

```
[Frontend API Call]
    └─ Create new tenant
        │
        ↓
[Tenant Service HTTP Endpoint]
    │
    ├─ Validate input
    │
    ├─ [Database Transaction BEGIN]
    │   │
    │   ├─ INSERT INTO tenants (...)
    │   │   └─ Returns: tenantId
    │   │
    │   ├─ INSERT INTO outbox_events (
    │   │     aggregate_type = 'tenant',
    │   │     aggregate_id = tenantId,
    │   │     event_type = 'tenant.created',
    │   │     payload = { tenantId, name, subdomain, ... },
    │   │     processed_at = NULL
    │   │   )
    │   │
    │   └─ [COMMIT]
    │
    └─ Return: { success, tenantId }
        │
        │ [Event not published immediately!]
        │
        ↓
[Outbox Worker] - Background Poll (every 2 seconds)
    │
    ├─ SELECT * FROM outbox_events
    │   WHERE processed_at IS NULL
    │   LIMIT 50
    │   FOR UPDATE SKIP LOCKED
    │
    ├─ For each unprocessed event:
    │   │
    │   ├─ Publish to Kafka
    │   │   └─ Topic: event_type (e.g., 'tenant.created')
    │   │
    │   ├─ If Kafka publish succeeds:
    │   │   └─ UPDATE outbox_events
    │   │       SET processed_at = NOW()
    │   │       WHERE id = ?
    │   │
    │   └─ If Kafka publish fails:
    │       └─ Log error, retry on next poll
    │
    └─ Ensures:
       ├─ At-least-once event delivery
       ├─ No lost events if service crashes
       └─ Event durability via DB transaction
```

**Benefits**:
- Service crash after DB commit but before Kafka publish → worker picks up on restart
- Kafka timeout → worker retries
- Idempotent downstream consumers handle duplicate events

### 7.5 Token Refresh & Rotation Flow

```
[Frontend] - Accessing protected resource
    └─ API call with Authorization: Bearer <accessToken>
        │
        ↓ (15 minutes pass, token expires)
        │
    [Response: 401 Unauthorized]
        │
        ↓
[Axios Interceptor]
    ├─ Detect 401
    ├─ Check if auth endpoint (if yes → fail)
    │
    └─ Call refresh endpoint:
       POST /auth/refresh
       └─ Cookie: refreshToken (httpOnly, from login)
           │
           ↓
    [Identity Service] /auth/refresh endpoint
        │
        ├─ Extract refreshToken from httpOnly cookie
        │
        ├─ Verify JWT signature (JWT_REFRESH_SECRET)
        │
        ├─ Query refresh_tokens table:
        │   SELECT * FROM refresh_tokens
        │   WHERE token_hash = SHA256(refreshToken)
        │   AND revoked_at IS NULL
        │   AND expires_at > NOW()
        │
        ├─ Token reuse check:
        │   └─ Verify family_id matches (prevent stolen token replay)
        │
        ├─ Generate NEW accessToken
        │   ├─ Copy payload: { userId, email, role, ... }
        │   ├─ New expiry: iat + 15min
        │   └─ Sign with JWT_ACCESS_SECRET
        │
        ├─ [Optional] Generate NEW refreshToken (rotation)
        │   ├─ New family_id (or same, for sliding window)
        │   ├─ Hash and store in refresh_tokens
        │   └─ Set new httpOnly cookie
        │
        └─ Return: { accessToken, [newRefreshToken] }
            │
            ↓
    [Axios Interceptor]
        ├─ Update store with new accessToken
        ├─ Retry original request with new token
        └─ Return response to caller
            │
            ↓
    [Frontend] - Original request succeeds
```

---

## 8. CROSS-CUTTING CONCERNS

### 8.1 Error Handling & Recovery

**AppError Class**:
```typescript
class AppError extends Error {
  constructor(message: string, statusCode: number) {
    this.statusCode = statusCode;
    this.message = message;
  }
}
```

**HTTP Error Responses**:
- 400: Bad Request (validation error)
- 401: Unauthorized (missing/invalid token)
- 403: Forbidden (insufficient permissions)
- 404: Not Found (resource missing)
- 500: Internal Server Error (unexpected failure)

**Graceful Shutdown**:
- On SIGTERM/SIGINT: Close servers, disconnect DB, disconnect consumers/producers
- 5-second timeout before force exit

### 8.2 Rate Limiting

**API Gateway**:
- 1000 requests/minute global limit

**Service Level** (Identity, Tenant):
- 100 requests/15 minutes per endpoint

**Implementation**: `express-rate-limit` middleware

### 8.3 Security Measures

**JWT Tokens**:
- Access: 15 minutes (short-lived, refresh-based)
- Refresh: 7 days (long-lived, httpOnly cookie)
- Secrets: 32+ character keys (environment-based)

**Password Security**:
- Hashed with bcrypt (10 salt rounds)
- Minimum 8 characters (if implemented)
- Failed login tracking + lockout

**Database Queries**:
- Parameterized queries (prevent SQL injection)
- Type validation with Zod

**CORS**:
- Whitelist allowed origins (configurable)
- Credentials: true (include cookies)
- Same-site: strict (prevent CSRF)

**Headers**:
- Helmet middleware: Security headers
- X-Correlation-ID: Request tracing

### 8.4 Idempotency

**User Creation**:
- Unique email constraint in DB
- Idempotency key in CreateUser gRPC call

**Notification Sending**:
- Unique(event_id, recipient, channel) constraint
- Prevents duplicate emails on message replay

**Outbox Pattern**:
- Dual-writes to DB + Kafka guarantee at-least-once
- Consumers must be idempotent

---

## 9. DEPLOYMENT ARCHITECTURE

### 9.1 Development Environment

**Docker Compose**:
- All services + infrastructure containerized
- Single docker-compose.yml for local testing
- Health checks for startup ordering
- Shared network for inter-service communication

**Commands**:
```bash
docker-compose up -d           # Start all services
docker-compose logs -f service # View logs
docker-compose down            # Stop and remove
```

### 9.2 Production Environment (Kubernetes)

**Manifests** (`k8s/`):
- Deployment: identity-service.yaml (extensible to others)
- Service exposure
- ConfigMaps for configuration
- Secrets for sensitive data
- HorizontalPodAutoscaler (3-10 replicas, 70% CPU target)

**Namespace**: `school-erp`

**Resource Limits**:
- Requests: CPU 100m, Memory 128Mi
- Limits: CPU 500m, Memory 512Mi

### 9.3 CI/CD Considerations

**Build Process**:
- Docker multi-stage builds (dev → production)
- Separate dev/prod image targets
- Scan for vulnerabilities (TODO)

**Deployment Pipeline** (TODO):
- Build Docker images
- Push to registry
- Deploy to Kubernetes
- Health check verification
- Rollback on failure

---

## 10. SUMMARY & KEY TAKEAWAYS

### System Strengths

1. **Scalable Architecture**: Microservices allow independent scaling per service
2. **Event-Driven**: Kafka-based async communication enables loose coupling
3. **Multi-Tenancy**: Subdomain routing + tenant context injection throughout
4. **Security**: JWT + refresh tokens, token rotation, account lockout
5. **Auditability**: Append-only audit log for compliance
6. **Resilience**: Circuit breaker, graceful shutdown, health checks
7. **Observability**: Correlation IDs, logging, tracing setup (Jaeger)

### Design Patterns Used

- **Microservices**: Independent, scalable services
- **Event Sourcing** (partial): Outbox pattern for event reliability
- **CQRS** (partial): Audit service reads from event stream
- **Circuit Breaker**: Opossum library for fault tolerance
- **Token Rotation**: Refresh token family for security
- **Transactional Outbox**: Ensures event delivery durability
- **Database-per-Service**: Data isolation, independent scaling
- **gRPC**: High-performance inter-service calls
- **Correlation IDs**: Distributed request tracing

### Technology Stack

**Backend**:
- Node.js + TypeScript
- Express.js (REST)
- gRPC (inter-service)
- PostgreSQL (persistence)
- Redis (caching)
- Kafka (messaging)

**Frontend**:
- React 19 + TypeScript
- Vite (build)
- Zustand (state)
- Tailwind + Ant Design (UI)

**Infrastructure**:
- Docker & Kubernetes
- Prometheus & Grafana (monitoring)
- Jaeger (tracing)
- Kafka UI (broker monitoring)

### Future Enhancements

1. Implement remaining auth flows (password reset, OTP, etc.)
2. Add business logic endpoints (class schedule, grades, etc.)
3. Implement gRPC service mesh (Istio)
4. Add distributed tracing instrumentation (Jaeger SDK)
5. Implement request/response logging
6. Add database migration tooling
7. Implement tenant-specific feature flags
8. Add real-time notifications (WebSocket)
9. Implement backup & disaster recovery
10. Performance optimization & caching strategies

---

**Document End**

*For questions or clarifications, refer to individual service READMEs or code comments.*
