# Feature Specification: Production Hardening for Self-Hosted Deployment

**Feature Branch**: `010-production-hardening`
**Created**: 2026-03-17
**Status**: Draft
**Input**: User description: "Production hardening for self-hosted deployment. Internal Docker networking, Traefik integration, rate limiting on auth endpoints, and documented .env.example."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Internal Services Are Not Directly Reachable (Priority: P1)

A system operator deploys the application stack. After deployment, only the frontend is reachable from outside the host machine. The backend API and database cannot be accessed directly from the internet or from the host's network interfaces — they communicate only internally within the stack.

**Why this priority**: This is the primary security goal of the feature. Exposing the backend API and database to the host network creates an attack surface. Closing that exposure reduces risk immediately and is a prerequisite for the Traefik routing to be the sole ingress point.

**Independent Test**: Can be verified by attempting to connect to the backend API or database ports directly on the host after deployment — both should refuse connections. The stack is still functional because the frontend can reach the backend internally.

**Acceptance Scenarios**:

1. **Given** the stack is running, **When** an external client attempts to connect to the backend API port on the host, **Then** the connection is refused.
2. **Given** the stack is running, **When** an external client attempts to connect to the database port on the host, **Then** the connection is refused.
3. **Given** the stack is running, **When** a user interacts with the frontend application, **Then** all API calls succeed normally via the internal network path.

---

### User Story 2 - App Is Served Securely via Reverse Proxy (Priority: P2)

A system operator configures the stack to work with an existing Traefik instance already running on the host. After deployment, the frontend is accessible via a domain name over HTTPS. The Traefik instance handles TLS termination. No changes to the frontend or backend application code are required.

**Why this priority**: Serving the app over HTTPS through a centralized reverse proxy is essential for production. Without this, users would have no encrypted connection and there would be no standard ingress point.

**Independent Test**: Can be verified by accessing the app via its configured domain name in a browser. The browser should show a valid HTTPS certificate and the app should load fully.

**Acceptance Scenarios**:

1. **Given** Traefik is running with an external network and the stack is deployed with the correct domain label, **When** a user navigates to the app's domain over HTTPS, **Then** the app loads successfully with a valid TLS certificate.
2. **Given** the stack is deployed, **When** a user navigates to the app's domain over HTTP, **Then** the request is redirected to HTTPS (handled by Traefik's global redirect).
3. **Given** the stack is deployed, **When** a user browses the app and makes API calls, **Then** all frontend-to-backend communication succeeds via the internal network (Traefik is not in the API call path).

---

### User Story 3 - Auth Endpoints Are Protected Against Brute-Force (Priority: P3)

An operator has the app deployed and reachable. If an attacker attempts to send many rapid requests to the login or password-reset endpoints, the reverse proxy automatically limits the rate of those requests, returning an error to the requester once the threshold is exceeded.

**Why this priority**: Rate limiting on auth endpoints is a standard baseline defence against credential stuffing and brute-force attacks. It layers on top of the networking controls above.

**Independent Test**: Can be verified by sending more requests to the login or password-reset endpoint than the configured limit within the limit window — subsequent requests should receive a rate-limit error response.

**Acceptance Scenarios**:

1. **Given** the stack is deployed, **When** a caller sends requests to the login endpoint within the allowed rate, **Then** all requests succeed normally.
2. **Given** the stack is deployed, **When** a caller exceeds the configured rate limit on the login endpoint, **Then** further requests receive a rate-limit rejection response.
3. **Given** the stack is deployed, **When** a caller exceeds the rate limit on the password-reset request endpoint, **Then** further requests receive a rate-limit rejection response.
4. **Given** a caller was rate-limited, **When** sufficient time passes for the window to reset, **Then** the caller can make requests again normally.

---

### User Story 4 - New Operator Can Configure the Stack from Documentation (Priority: P4)

A new operator setting up the application for the first time follows the `.env.example` file. Every environment variable required to run the stack is listed with a comment describing its purpose and expected format. The operator can populate a `.env` file from the example without needing to read source code or other documentation.

**Why this priority**: Operational clarity reduces misconfiguration errors. This is the lowest priority because it is documentation, not a security control, but it is a prerequisite for safe self-hosting by others.

**Independent Test**: Can be verified by a review: every env var referenced in `docker-compose.yml` (and related configuration) must have a corresponding documented entry in `.env.example` with a meaningful comment.

**Acceptance Scenarios**:

1. **Given** the `.env.example` file, **When** an operator reads each entry, **Then** every entry has a comment explaining its purpose and any constraints on its value.
2. **Given** the `.env.example` file, **When** an operator compares it against the compose file, **Then** no env var referenced in the compose file is absent from the example.
3. **Given** an operator copies `.env.example` to `.env` and fills in the values, **When** they start the stack, **Then** the stack starts successfully.

---

### Edge Cases

- What happens when the Traefik external network does not exist on the host? The stack fails to start with a clear error rather than silently starting without the reverse proxy.
- What happens when the `TRAEFIK_HOST` variable is not set or is empty? The compose file should make this obvious (the service won't be routed correctly).
- What happens when a legitimate user sends requests quickly (e.g., double-clicking)? The rate limit threshold must be set high enough that normal interactive use is not affected.
- What happens when the rate limit window is very short? Single rapid bursts from a legitimate client should not cause a persistent block.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The backend service MUST NOT publish any ports to the host network.
- **FR-002**: The database service MUST NOT publish any ports to the host network.
- **FR-003**: The frontend service MUST be reachable only through the external reverse proxy, not via a directly published host port.
- **FR-004**: The compose configuration MUST attach the frontend service to the external reverse proxy network so it can be discovered and routed.
- **FR-005**: The reverse proxy routing configuration MUST specify the domain name via an environment variable so it can be set per deployment without editing compose files.
- **FR-006**: The reverse proxy MUST terminate TLS for the frontend using certificates managed by the existing Traefik instance.
- **FR-007**: The reverse proxy configuration MUST define a rate-limiting rule applied to the `/api/auth/login` path.
- **FR-008**: The rate-limiting rule MUST also apply to the `/api/auth/reset-password/request` path.
- **FR-009**: The rate limit MUST be configurable (threshold and window) via environment variables without modifying compose or configuration files directly.
- **FR-010**: An `.env.example` file MUST exist at the repository root and MUST include every environment variable referenced by the compose stack.
- **FR-011**: Every entry in `.env.example` MUST have a comment explaining its purpose, expected format, and any required vs. optional status.
- **FR-012**: No frontend or backend application source code changes are permitted except those strictly required to support networking changes (e.g., adjusting internal hostnames if needed).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: After deployment, zero services other than the frontend are reachable on any port from outside the internal Docker network.
- **SC-002**: The frontend is accessible via HTTPS with a valid certificate on the configured domain within the normal Traefik certificate provisioning window.
- **SC-003**: More than the configured request threshold to either auth endpoint within the rate window results in a rejection response for all excess requests; legitimate requests within the threshold succeed 100% of the time.
- **SC-004**: Every environment variable referenced anywhere in the compose stack has a documented, commented entry in `.env.example` — coverage is 100% with no undocumented variables.
- **SC-005**: A new operator following only the `.env.example` file can bring the stack up successfully without consulting any other documentation.

## Assumptions

- An external Traefik instance is already running on the target host with a Docker network that services can join to be discovered and routed. This feature does not set up Traefik itself.
- Traefik is configured globally to redirect HTTP to HTTPS; this feature does not add per-service HTTP redirect rules.
- The rate limit thresholds (requests per window) will be determined during planning based on reasonable defaults for interactive web app auth (e.g., 10 requests per minute per source IP). Exact values can be tuned post-deployment.
- The Traefik network name and the app's public hostname are deployment-specific and will be supplied via environment variables, not hardcoded.
- No new secrets management system is introduced; environment variables remain the configuration mechanism, consistent with the existing stack.
