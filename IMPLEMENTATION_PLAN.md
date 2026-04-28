# School ERP Implementation Plan

## Objective

Build a comprehensive, modular, AI-ready school management system that improves daily school operations, reduces manual work, strengthens communication, and prepares the platform for future automation and predictive intelligence.

This plan is intentionally phase-based. After each phase, development must stop for a heavy validation cycle covering bugs, edge cases, performance, capacity, security, usability, and business capability. Work on the next phase should begin only after explicit confirmation from the product owner.

## Guiding Principles

- Build stable operational foundations before advanced AI.
- Keep modules loosely coupled and event-driven.
- Preserve tenant isolation across every workflow.
- Prefer clear role-based workflows for students, teachers, admins, and super admins.
- Emit useful domain events from every major action.
- Add automation only where the manual workflow is already well understood.
- Treat reporting and AI as layers over clean operational data.
- Keep every architectural decision production-grade, scalable, maintainable, observable, and secure by default.
- Optimize each microservice for clear ownership, fast request handling, predictable resource usage, and safe independent deployment.

## Production Architecture Standards

All upcoming implementation phases must follow these standards unless there is a documented reason to deviate.

### Service Design Standards

- Each microservice must own a clear business capability and its own database schema.
- Avoid cross-service database access. Services should communicate through REST/gRPC for synchronous reads and Kafka events for asynchronous state propagation.
- Keep service boundaries stable and business-focused, not UI-screen-focused.
- Use domain/use-case/repository separation consistently.
- Keep controllers thin. Business rules should live in use cases or domain models.
- Keep DTO validation at API boundaries using schema validation.
- Use idempotency keys for create operations that may be retried.
- Use transactional outbox for all important cross-service events.
- Use processed-event tracking for Kafka consumers.
- Design APIs with pagination, filtering, sorting, and predictable response envelopes from the beginning.

### Performance Standards

- Every service should be optimized for low-latency common paths.
- Avoid N+1 queries. Use batch queries or read models where needed.
- Add indexes for tenant, branch, class, user, status, date, and foreign-key lookup patterns.
- Keep heavy reporting, exports, AI processing, and fanout jobs asynchronous.
- Use Redis caching only for data with clear TTL and invalidation strategy.
- Use connection pooling for PostgreSQL.
- Put strict timeouts on all HTTP, gRPC, Kafka, Redis, SMTP, and storage calls.
- Add circuit breakers or retry-with-backoff for unstable downstream calls.
- Keep payloads small and avoid returning unnecessary nested data.

### Scalability Standards

- Services must be horizontally scalable and stateless wherever possible.
- Background workers must support multiple replicas safely using locking, claiming, or partition-aware consumption.
- Kafka consumers must be idempotent.
- Read-heavy modules should support read-optimized projections.
- Large tenant data must be queryable by tenant-scoped indexes.
- File uploads must go to object storage, not service containers.
- Long-running operations must use jobs and status polling.
- Tenant-level rate limits should be supported for high-traffic modules.
- Capacity assumptions must be recorded per phase and tested before approval.

### Maintainability Standards

- Keep code simple, explicit, and aligned with existing project patterns.
- Avoid large shared libraries unless they are stable and genuinely cross-cutting.
- Shared contracts should live in versioned protobuf/OpenAPI schemas.
- Database migrations must be backward-compatible where possible.
- All new services should include:
  - `config`
  - `logger`
  - HTTP server
  - health endpoints
  - metrics endpoint
  - database migration
  - repository layer
  - use-case layer
  - error handling
  - tests for critical business rules
- Document key design decisions in the implementation phase notes.

### Reliability Standards

- Every service must expose:
  - `/health/live`
  - `/health/ready`
  - `/metrics`
- Readiness should check critical dependencies where appropriate.
- All critical writes should be auditable.
- Cross-service events should include:
  - `eventId`
  - `eventType`
  - `aggregateId`
  - `occurredAt`
  - `correlationId`
  - `payload`
- Consumers should send malformed or repeatedly failing messages to DLQ.
- Use graceful shutdown for HTTP servers, workers, database pools, Kafka consumers, and producers.
- Avoid data loss by preferring durable queues and transactional persistence.

### Security Standards

- Never trust browser-provided identity or tenant headers.
- Continue using gateway-signed internal auth tokens for downstream services.
- Enforce tenant isolation in every query and every authorization check.
- Validate all input at service boundaries.
- Use least-privilege role checks.
- Store secrets only in environment/secret managers, never in code.
- Hash sensitive tokens before storage.
- Avoid exposing temporary passwords except in local development.
- Log security-relevant events without leaking credentials or private data.
- AI features must never mix tenant data and must require explicit tenant-level enablement.

### Observability Standards

- Carry `x-correlation-id` across every service and event.
- Use structured logs.
- Record service-level metrics:
  - request count
  - latency
  - error rate
  - queue lag
  - worker failures
  - database query failures
  - external dependency failures
- Add audit logs for sensitive actions.
- Dashboards and alerts should be created for production-critical modules.

### Frontend Standards

- Keep role-specific user journeys simple and fast.
- Optimize pages for mobile-first use where school staff or students may use phones.
- Use loading, empty, error, and permission-denied states consistently.
- Avoid fetching excessive data on initial page load.
- Use pagination or infinite loading for large tables and feeds.
- Keep forms resilient with validation, clear errors, and safe retry behavior.
- Protect routes by role and tenant context.

### Architectural Decision Rule

When choosing between two approaches, prefer the one that improves:

1. Tenant isolation.
2. Operational reliability.
3. Maintainability.
4. Horizontal scalability.
5. Observability.
6. Security.
7. Developer clarity.

Short-term speed should not compromise production stability for core workflows.

## Current Baseline

The current platform already includes:

- Multi-tenant structure with schools/tenants and branches.
- Super admin, tenant admin, staff, and student portals.
- Identity service with JWT authentication and refresh-token rotation.
- Tenant service with branch and membership management.
- API gateway with tenant-aware routing and internal auth forwarding.
- Kafka-based event flow.
- Notification and audit services.
- React frontend with subdomain-based routing.

The following major school operations still need to be built or expanded:

- Class, section, subject, and academic-year management.
- Student academic enrollment.
- Class teacher and subject teacher assignment.
- Attendance.
- Assignment creation, submission, review, and deadline extensions.
- Timetable and period scheduling.
- Community, announcements, class groups, and chat.
- Exams, grading, report cards, and analytics.
- Parent/guardian portal.
- AI-assisted automation and predictive insights.

---

# Phase 1: Academic Foundation

## Goal

Create the core academic structure needed by almost every future module.

## Scope

### Backend Scope

- Academic years and terms.
- Classes and sections.
- Subjects.
- Student enrollment into class/section.
- Class teacher assignment.
- Teacher-subject-class mapping.
- Basic academic settings per tenant and branch.

### Frontend Scope

- Tenant admin Academic Management section.
- Academic year and term management screens.
- Class and section management screens.
- Subject management screens.
- Class-subject mapping workflow.
- Student enrollment workflow.
- Class teacher and subject teacher assignment workflows.
- List, create, edit where supported, empty states, loading states, and validation errors.
- Mobile-responsive table/form layouts for admin usage.

## Suggested Implementation

- Add a new `academic-service` or implement as a clearly separated module inside `tenant-service` first.
- Recommended long-term direction: dedicated `academic-service`.
- Add REST APIs for academic configuration.
- Add gRPC or internal APIs for other services to resolve class, section, subject, student enrollment, and teacher assignment data.
- Emit domain events:
  - `academic.class.created`
  - `academic.section.created`
  - `academic.subject.created`
  - `academic.student.enrolled`
  - `academic.teacher.assigned`

## Key Entities

- `academic_years`
- `terms`
- `classes`
- `sections`
- `subjects`
- `student_enrollments`
- `class_teacher_assignments`
- `subject_teacher_assignments`

## Dependencies

- Identity Service
- Tenant Service
- Audit Service
- Notification Service

## Validation Gate

Before moving to Phase 2, perform:

- Full frontend/backend workflow testing through the API gateway.
- UI form validation and API validation parity checks.
- Frontend loading, empty, error, and permission-denied state checks.
- Mobile and desktop layout checks for all Academic Management screens.
- Functional testing for CRUD operations.
- Tenant isolation tests.
- Role permission tests for super admin, tenant admin, teacher, and student.
- Duplicate class/section/subject edge cases.
- Invalid teacher/student assignment tests.
- Academic-year rollover edge cases.
- Bulk enrollment tests.
- API pagination and filtering tests.
- Audit event verification.
- Capacity test with at least:
  - 100 tenants
  - 10 branches per tenant
  - 50 classes/sections per tenant
  - 5,000 students per tenant
  - 500 staff per tenant

## Confirmation Checkpoint

Stop after validation. Proceed to Phase 2 only after product owner confirmation.

---

# Phase 2: Attendance Management

## Goal

Enable reliable attendance tracking for students and staff.

## Scope

- Daily attendance.
- Period-wise attendance.
- Staff attendance.
- Late marks.
- Leave/absence reasons.
- Attendance correction workflow.
- Parent/admin notifications for absence.
- Attendance summaries and exports.

## Suggested Implementation

- Create `attendance-service`.
- Support manual attendance first.
- Design extensibility for QR, RFID, biometric, and mobile attendance later.
- Store attendance snapshots by academic date, class, section, period, and user.
- Emit events:
  - `attendance.marked`
  - `attendance.updated`
  - `attendance.student.absent`
  - `attendance.low_threshold.detected`

## Dependencies

- Academic Service
- Identity Service
- Tenant Service
- Notification Service
- Analytics Service later

## Validation Gate

Before moving to Phase 3, perform:

- Attendance marking for full class and individual student.
- Duplicate marking prevention.
- Correction workflow edge cases.
- Holiday and non-working day handling.
- Timezone/date boundary tests.
- Tenant and branch isolation tests.
- Teacher permission tests.
- Parent notification tests.
- Bulk attendance performance test.
- Reports accuracy test.
- Capacity test with:
  - 5,000 students marked within 5 minutes per tenant
  - 100 concurrent teachers marking attendance
  - 1 academic year of attendance history queried efficiently

## Confirmation Checkpoint

Stop after validation. Proceed to Phase 3 only after product owner confirmation.

---

# Phase 3: Assignment & Submission System

## Goal

Allow teachers to create assignments and students to submit work through the platform.

## Scope

- Assignment creation.
- Class/section/subject targeting.
- Due dates and instructions.
- Attachments.
- Student submissions.
- Deadline extension requests.
- Approve/reject extension requests.
- Teacher review and feedback.
- Basic grading.
- Missing/late submission tracking.

## Suggested Implementation

- Create `assignment-service`.
- Store assignment metadata in PostgreSQL.
- Store files in object storage such as S3 or MinIO.
- Add submission status state machine:
  - `NOT_SUBMITTED`
  - `SUBMITTED`
  - `LATE`
  - `EXTENSION_REQUESTED`
  - `EXTENSION_APPROVED`
  - `EXTENSION_REJECTED`
  - `GRADED`
- Emit events:
  - `assignment.created`
  - `assignment.submitted`
  - `assignment.extension.requested`
  - `assignment.extension.approved`
  - `assignment.extension.rejected`
  - `assignment.graded`

## Dependencies

- Academic Service
- Identity Service
- Notification Service
- File Storage
- Audit Service

## Validation Gate

Before moving to Phase 4, perform:

- Assignment creation edge cases.
- Invalid class/subject targeting tests.
- File upload size/type validation.
- Late submission behavior.
- Deadline extension workflow tests.
- Duplicate submission and resubmission tests.
- Teacher permission tests.
- Student access control tests.
- Notification tests for assignment creation, due reminders, and extension decisions.
- Storage failure handling.
- Capacity test with:
  - 10,000 assignments per tenant
  - 100,000 submissions per tenant
  - Large file upload stress testing
  - Concurrent submissions near deadline

## Confirmation Checkpoint

Stop after validation. Proceed to Phase 4 only after product owner confirmation.

---

# Phase 4: Timetable & Scheduling

## Goal

Provide configurable timetable and scheduling capabilities per school.

## Scope

- Period configuration.
- School day configuration.
- Weekly timetable.
- Teacher timetable.
- Class timetable.
- Subject-period mapping.
- Room/lab allocation.
- Holiday calendar.
- Conflict detection.
- Substitute teacher workflow.

## Suggested Implementation

- Create `scheduling-service`.
- Model school scheduling rules separately from generated schedules.
- Add conflict detection before publishing timetable.
- Keep timetable versioned, allowing draft and published states.
- Emit events:
  - `schedule.template.created`
  - `schedule.timetable.published`
  - `schedule.conflict.detected`
  - `schedule.substitute.assigned`

## Dependencies

- Academic Service
- Tenant Service
- Attendance Service
- Notification Service

## Validation Gate

Before moving to Phase 5, perform:

- Period configuration edge cases.
- Teacher double-booking tests.
- Class double-booking tests.
- Room/lab conflict tests.
- Holiday override tests.
- Draft/publish workflow tests.
- Substitute assignment tests.
- Timetable rendering tests for mobile and desktop.
- Capacity test with:
  - 100 classes per tenant
  - 1,000 timetable slots per week
  - 500 teachers
  - High-frequency timetable reads during school start time

## Confirmation Checkpoint

Stop after validation. Proceed to Phase 5 only after product owner confirmation.

---

# Phase 5: Communication & Community System

## Goal

Build a centralized communication space for announcements, class groups, and school community interaction.

## Scope

- School-wide announcements.
- Branch announcements.
- Class-based groups.
- Group chat.
- Teacher-student communication.
- Teacher-parent communication later.
- Attachments.
- Read receipts.
- Moderation tools.
- Notification fanout.

## Suggested Implementation

- Create `communication-service`.
- Use WebSockets for real-time chat.
- Use Kafka for notification fanout.
- Store messages, group membership, read receipts, and moderation actions.
- Add message visibility based on tenant, branch, class, section, role, and group membership.
- Emit events:
  - `announcement.published`
  - `chat.message.sent`
  - `chat.message.flagged`
  - `group.created`
  - `group.member.added`

## Dependencies

- Academic Service
- Tenant Service
- Identity Service
- Notification Service
- Audit Service

## Validation Gate

Before moving to Phase 6, perform:

- Announcement visibility tests.
- Chat permission tests.
- Class group membership tests.
- Read receipt tests.
- Attachment validation tests.
- WebSocket reconnect tests.
- Message ordering tests.
- Offensive/spam content moderation edge cases.
- Notification fanout tests.
- Capacity test with:
  - 10,000 active users per tenant
  - 1,000 concurrent WebSocket connections per tenant
  - Chat burst testing during announcement events

## Confirmation Checkpoint

Stop after validation. Proceed to Phase 6 only after product owner confirmation.

---

# Phase 6: Exams, Evaluation & Report Cards

## Goal

Support formal academic evaluation and student progress records.

## Scope

- Exam types.
- Exam schedules.
- Marks entry.
- Grade schemes.
- Rubrics.
- Report cards.
- Teacher remarks.
- Principal approval workflow.
- Student/parent result view.

## Suggested Implementation

- Create `evaluation-service`.
- Support tenant-specific grading schemes.
- Keep marks entry auditable.
- Allow draft and published result states.
- Emit events:
  - `exam.created`
  - `marks.submitted`
  - `result.published`
  - `report_card.generated`

## Dependencies

- Academic Service
- Assignment Service
- Scheduling Service
- Notification Service
- Analytics Service

## Validation Gate

Before moving to Phase 7, perform:

- Marks entry validation.
- Grade calculation tests.
- Report card generation tests.
- Result publication permission tests.
- Recalculation edge cases.
- Student/parent visibility tests.
- Audit trail checks.
- Capacity test with:
  - 5,000 students per tenant
  - Multiple exams per term
  - Bulk marks import
  - Report card generation under load

## Confirmation Checkpoint

Stop after validation. Proceed to Phase 7 only after product owner confirmation.

---

# Phase 7: Parent Portal & Student Support

## Goal

Extend the platform beyond internal school operations to parents and guardians.

## Scope

- Parent/guardian accounts.
- Student-parent linking.
- Attendance visibility.
- Assignment visibility.
- Result/report card visibility.
- Fee and announcement visibility when future modules exist.
- Parent-teacher communication.
- Meeting requests.

## Suggested Implementation

- Extend Identity and Tenant membership models to support guardian relationships.
- Add `guardian_relationships`.
- Add parent-facing frontend routes.
- Keep parent access strictly limited to linked students.
- Emit events:
  - `guardian.linked`
  - `parent.message.sent`
  - `parent.meeting.requested`

## Dependencies

- Identity Service
- Academic Service
- Attendance Service
- Assignment Service
- Evaluation Service
- Communication Service

## Validation Gate

Before moving to Phase 8, perform:

- Parent-student access control tests.
- Multi-child parent account tests.
- Separated/blocked guardian edge cases.
- Communication privacy tests.
- Mobile UX tests.
- Notification preference tests.
- Capacity test with:
  - 2 guardians per student
  - 10,000 parent accounts per tenant
  - High result-day login traffic

## Confirmation Checkpoint

Stop after validation. Proceed to Phase 8 only after product owner confirmation.

---

# Phase 8: Analytics & Reporting

## Goal

Provide actionable dashboards and reporting for admins, teachers, students, and parents.

## Scope

- Attendance reports.
- Assignment completion reports.
- Student performance dashboards.
- Class performance dashboards.
- Teacher workload reports.
- Branch comparison.
- Operational admin dashboard.
- Export to PDF/Excel.

## Suggested Implementation

- Create `analytics-service`.
- Consume events from Kafka.
- Build read-optimized reporting tables.
- Avoid live cross-service joins for dashboards.
- Add report generation jobs for expensive exports.
- Emit events:
  - `report.generated`
  - `analytics.threshold.detected`

## Dependencies

- Kafka
- Academic Service
- Attendance Service
- Assignment Service
- Evaluation Service
- Communication Service
- Audit Service

## Validation Gate

Before moving to Phase 9, perform:

- Report accuracy tests against source data.
- Dashboard permission tests.
- Large export tests.
- Missing event/backfill tests.
- Read-model rebuild tests.
- Aggregation correctness tests.
- Capacity test with:
  - 1 year of academic events
  - 100 tenants
  - Concurrent dashboard access
  - Large PDF/Excel export queues

## Confirmation Checkpoint

Stop after validation. Proceed to Phase 9 only after product owner confirmation.

---

# Phase 9: AI & Automation Layer

## Goal

Introduce AI-assisted workflows after core operational data is reliable.

## Scope

- AI lesson plan assistant.
- AI assignment/question generator.
- AI assignment feedback drafts.
- Student weak-topic recommendations.
- Attendance risk prediction.
- Performance decline detection.
- Chat and announcement summarization.
- Admin workflow assistant.
- Timetable optimization suggestions.

## Suggested Implementation

- Create `ai-service`.
- Keep AI suggestions reviewable by humans.
- Store AI output with:
  - source data reference
  - model/provider
  - prompt/version
  - confidence score where applicable
  - reviewer status
  - accepted/rejected feedback
- Do not allow AI to directly perform irreversible actions without approval.
- Add tenant-level AI feature flags and consent settings.

## Dependencies

- Analytics Service
- Assignment Service
- Communication Service
- Scheduling Service
- Attendance Service
- Evaluation Service

## Validation Gate

Before moving to Phase 10, perform:

- AI output quality review.
- Prompt injection tests.
- Data privacy tests.
- Tenant data isolation tests.
- Hallucination and unsafe recommendation testing.
- Human approval workflow tests.
- Cost and rate-limit tests.
- Fallback behavior when AI provider is unavailable.
- Capacity test with:
  - Batch report summarization
  - Concurrent teacher assistant usage
  - Large assignment feedback queues

## Confirmation Checkpoint

Stop after validation. Proceed to Phase 10 only after product owner confirmation.

---

# Phase 10: Platform Hardening, Mobile & Scale

## Goal

Prepare the application for production growth, mobile-first usage, and institutional adoption.

## Scope

- PWA/mobile optimization.
- Offline-friendly attendance.
- Push notifications.
- Advanced observability.
- Data backup and restore.
- Disaster recovery.
- Tenant-level feature flags.
- Subscription/billing readiness.
- Security hardening.
- Load balancing and horizontal scaling.

## Suggested Implementation

- Add mobile-first frontend improvements.
- Add service-level SLOs and dashboards.
- Add backup/restore automation.
- Add rate limits per tenant.
- Add per-tenant feature flags.
- Add centralized audit and compliance reporting.
- Use Kubernetes or managed container orchestration for production deployment.

## Dependencies

- All core services.
- Infrastructure layer.
- Observability stack.
- CI/CD pipeline.

## Validation Gate

Before full production rollout, perform:

- Full regression testing.
- Security testing.
- Penetration testing.
- Cross-browser testing.
- Mobile/PWA testing.
- Disaster recovery drill.
- Backup restore drill.
- Multi-tenant load test.
- High availability failover test.
- Long-running soak test.
- Database migration rollback test.
- Capacity test with target production numbers.

## Confirmation Checkpoint

Stop after validation. Proceed to production rollout only after product owner confirmation.

---

# Heavy Validation Checklist For Every Phase

Each phase must complete this checklist before moving forward:

- Functional correctness
- Role and permission coverage
- Tenant isolation
- Input validation
- Error handling
- Retry behavior
- Idempotency
- Data consistency
- Audit logging
- Notification correctness
- API pagination, filtering, and sorting
- Frontend usability
- Mobile responsiveness
- Accessibility basics
- Performance under normal load
- Capacity under expected peak load
- Failure mode testing
- Observability and logs
- Backup or data recovery impact
- Documentation updates

---

# Release Discipline

For each phase:

1. Implement the planned scope.
2. Add focused automated tests.
3. Run manual workflow testing.
4. Run edge-case testing.
5. Run capacity and performance tests.
6. Review logs, metrics, audit events, and database state.
7. Document known issues and residual risks.
8. Stop and wait for confirmation.
9. Proceed only after approval.

---

# Recommended Initial Delivery Order

1. Academic Foundation
2. Attendance Management
3. Assignment & Submission System
4. Timetable & Scheduling
5. Communication & Community System
6. Exams, Evaluation & Report Cards
7. Parent Portal & Student Support
8. Analytics & Reporting
9. AI & Automation Layer
10. Platform Hardening, Mobile & Scale

This order keeps the application grounded in real school workflows first, then builds analytics and AI on top of trustworthy operational data.
