import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import { AcademicRepository } from '../../../infrastructure/database/AcademicRepository';
import { withTransaction } from '../../../infrastructure/database/db';
import { insertOutboxEvent } from '../../../infrastructure/database/outbox.repository';
import { AppError } from '../../../domain/errors/AppError';
import { getMembership, getTenantById } from '../../../infrastructure/grpc/tenant.client';

const uuidSchema = z.string().uuid();
const optionalUuidSchema = z.string().uuid().nullable().optional();
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must use YYYY-MM-DD format');
const paginationSchema = z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
    branch_id: z.string().uuid().optional(),
    academic_year_id: z.string().uuid().optional(),
    class_id: z.string().uuid().optional(),
    section_id: z.string().uuid().optional(),
    status: z.string().optional(),
});

const createAcademicYearSchema = z.object({
    branch_id: optionalUuidSchema,
    name: z.string().trim().min(1).max(120),
    starts_on: dateSchema,
    ends_on: dateSchema,
    status: z.enum(['DRAFT', 'ACTIVE', 'ARCHIVED']).optional(),
});
const createTermSchema = z.object({
    academic_year_id: uuidSchema,
    name: z.string().trim().min(1).max(120),
    starts_on: dateSchema,
    ends_on: dateSchema,
});
const createClassSchema = z.object({
    branch_id: optionalUuidSchema,
    academic_year_id: uuidSchema,
    name: z.string().trim().min(1).max(120),
    sort_order: z.coerce.number().int().min(0).optional(),
});
const createSectionSchema = z.object({
    class_id: uuidSchema,
    name: z.string().trim().min(1).max(80),
    capacity: z.coerce.number().int().positive().nullable().optional(),
});
const createSubjectSchema = z.object({
    branch_id: optionalUuidSchema,
    code: z.string().trim().min(1).max(40).transform((value) => value.toUpperCase()),
    name: z.string().trim().min(1).max(160),
});
const classSubjectSchema = z.object({
    class_id: uuidSchema,
    subject_id: uuidSchema,
    is_mandatory: z.boolean().default(true),
});
const enrollmentSchema = z.object({
    student_user_id: uuidSchema,
    academic_year_id: uuidSchema,
    class_id: uuidSchema,
    section_id: uuidSchema,
    roll_number: z.string().trim().max(60).nullable().optional(),
});
const classTeacherSchema = z.object({
    teacher_user_id: uuidSchema,
    academic_year_id: uuidSchema,
    class_id: uuidSchema,
    section_id: uuidSchema,
});
const subjectTeacherSchema = z.object({
    teacher_user_id: uuidSchema,
    academic_year_id: uuidSchema,
    class_id: uuidSchema,
    section_id: optionalUuidSchema,
    subject_id: uuidSchema,
});

const repo = new AcademicRepository();

const tenantIdFrom = (req: Request): string => req.params.tenantId;
const correlationIdFrom = (req: Request): string | undefined =>
    typeof req.headers['x-correlation-id'] === 'string' ? req.headers['x-correlation-id'] : undefined;

const assertTenantExists = async (tenantId: string): Promise<void> => {
    const tenant = await getTenantById(tenantId);
    if (!tenant.found || !tenant.isActive) {
        throw new AppError('Tenant not found or inactive', 404);
    }
};

const assertTenantMemberRole = async (
    tenantId: string,
    userId: string,
    allowedRoles: Array<'ADMIN' | 'STAFF' | 'STUDENT'>
): Promise<void> => {
    const membership = await getMembership(userId, tenantId);
    if (!membership.found || !membership.role || !allowedRoles.includes(membership.role)) {
        throw new AppError(`User must be an active ${allowedRoles.join(' or ')} member of this tenant`, 400);
    }
};

const ok = (res: Response, data: unknown, status = 200): void => {
    res.status(status).json({ success: true, data });
};

const handleKnownError = (error: unknown, next: NextFunction): void => {
    if (error instanceof z.ZodError) {
        next(new AppError(error.errors[0].message, 400));
        return;
    }
    if ((error as { code?: string })?.code === '23505') {
        next(new AppError('Academic record already exists', 409));
        return;
    }
    if ((error as { code?: string })?.code === '23514') {
        next(new AppError('Invalid academic data', 400));
        return;
    }
    next(error);
};

export const createAcademicYearController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const tenantId = tenantIdFrom(req);
        const body = createAcademicYearSchema.parse(req.body);
        await assertTenantExists(tenantId);
        const result = await withTransaction(async (client) => {
            const row = await repo.createAcademicYear({
                tenantId,
                branchId: body.branch_id,
                name: body.name,
                startsOn: body.starts_on,
                endsOn: body.ends_on,
                status: body.status,
            }, client);
            await insertOutboxEvent(client, {
                eventId: randomUUID(),
                eventType: 'academic.year.created',
                aggregateId: row.id,
                occurredAt: new Date().toISOString(),
                correlationId: correlationIdFrom(req),
                payload: { tenantId, academicYearId: row.id, name: row.name, status: row.status },
            }, 'AcademicYear');
            return row;
        });
        ok(res, result, 201);
    } catch (error) {
        handleKnownError(error, next);
    }
};

export const listAcademicYearsController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const query = paginationSchema.parse(req.query);
        const result = await repo.listAcademicYears({
            tenantId: tenantIdFrom(req),
            branchId: query.branch_id,
            status: query.status,
            page: query.page,
            limit: query.limit,
        });
        ok(res, { academic_years: result.rows, pagination: { page: query.page, limit: query.limit, total: result.total } });
    } catch (error) {
        handleKnownError(error, next);
    }
};

export const createTermController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const tenantId = tenantIdFrom(req);
        const body = createTermSchema.parse(req.body);
        await assertTenantExists(tenantId);
        const result = await withTransaction(async (client) => {
            const row = await repo.createTerm({
                tenantId,
                academicYearId: body.academic_year_id,
                name: body.name,
                startsOn: body.starts_on,
                endsOn: body.ends_on,
            }, client);
            await insertOutboxEvent(client, {
                eventId: randomUUID(),
                eventType: 'academic.term.created',
                aggregateId: row.id,
                occurredAt: new Date().toISOString(),
                correlationId: correlationIdFrom(req),
                payload: { tenantId, termId: row.id, academicYearId: row.academic_year_id, name: row.name },
            }, 'Term');
            return row;
        });
        ok(res, result, 201);
    } catch (error) {
        handleKnownError(error, next);
    }
};

export const listTermsController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const query = paginationSchema.parse(req.query);
        const rows = await repo.listTerms({
            tenantId: tenantIdFrom(req),
            academicYearId: query.academic_year_id,
            page: query.page,
            limit: query.limit,
        });
        ok(res, rows);
    } catch (error) {
        handleKnownError(error, next);
    }
};

export const createClassController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const tenantId = tenantIdFrom(req);
        const body = createClassSchema.parse(req.body);
        await assertTenantExists(tenantId);
        const result = await withTransaction(async (client) => {
            const row = await repo.createClass({
                tenantId,
                branchId: body.branch_id,
                academicYearId: body.academic_year_id,
                name: body.name,
                sortOrder: body.sort_order,
            }, client);
            await insertOutboxEvent(client, {
                eventId: randomUUID(),
                eventType: 'academic.class.created',
                aggregateId: row.id,
                occurredAt: new Date().toISOString(),
                correlationId: correlationIdFrom(req),
                payload: { tenantId, classId: row.id, academicYearId: row.academic_year_id, name: row.name },
            }, 'Class');
            return row;
        });
        ok(res, result, 201);
    } catch (error) {
        handleKnownError(error, next);
    }
};

export const listClassesController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const query = paginationSchema.parse(req.query);
        const result = await repo.listClasses({
            tenantId: tenantIdFrom(req),
            branchId: query.branch_id,
            academicYearId: query.academic_year_id,
            status: query.status,
            page: query.page,
            limit: query.limit,
        });
        ok(res, { classes: result.rows, pagination: { page: query.page, limit: query.limit, total: result.total } });
    } catch (error) {
        handleKnownError(error, next);
    }
};

export const createSectionController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const tenantId = tenantIdFrom(req);
        const body = createSectionSchema.parse(req.body);
        await assertTenantExists(tenantId);
        const result = await withTransaction(async (client) => {
            const row = await repo.createSection({
                tenantId,
                classId: body.class_id,
                name: body.name,
                capacity: body.capacity,
            }, client);
            await insertOutboxEvent(client, {
                eventId: randomUUID(),
                eventType: 'academic.section.created',
                aggregateId: row.id,
                occurredAt: new Date().toISOString(),
                correlationId: correlationIdFrom(req),
                payload: { tenantId, sectionId: row.id, classId: row.class_id, name: row.name },
            }, 'Section');
            return row;
        });
        ok(res, result, 201);
    } catch (error) {
        handleKnownError(error, next);
    }
};

export const listSectionsController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const query = paginationSchema.parse(req.query);
        const rows = await repo.listSections({
            tenantId: tenantIdFrom(req),
            classId: query.class_id,
            page: query.page,
            limit: query.limit,
        });
        ok(res, rows);
    } catch (error) {
        handleKnownError(error, next);
    }
};

export const createSubjectController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const tenantId = tenantIdFrom(req);
        const body = createSubjectSchema.parse(req.body);
        await assertTenantExists(tenantId);
        const result = await withTransaction(async (client) => {
            const row = await repo.createSubject({
                tenantId,
                branchId: body.branch_id,
                code: body.code,
                name: body.name,
            }, client);
            await insertOutboxEvent(client, {
                eventId: randomUUID(),
                eventType: 'academic.subject.created',
                aggregateId: row.id,
                occurredAt: new Date().toISOString(),
                correlationId: correlationIdFrom(req),
                payload: { tenantId, subjectId: row.id, code: row.code, name: row.name },
            }, 'Subject');
            return row;
        });
        ok(res, result, 201);
    } catch (error) {
        handleKnownError(error, next);
    }
};

export const listSubjectsController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const query = paginationSchema.parse(req.query);
        const result = await repo.listSubjects({
            tenantId: tenantIdFrom(req),
            branchId: query.branch_id,
            status: query.status,
            page: query.page,
            limit: query.limit,
        });
        ok(res, { subjects: result.rows, pagination: { page: query.page, limit: query.limit, total: result.total } });
    } catch (error) {
        handleKnownError(error, next);
    }
};

export const assignSubjectToClassController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const tenantId = tenantIdFrom(req);
        const body = classSubjectSchema.parse(req.body);
        await assertTenantExists(tenantId);
        const result = await withTransaction(async (client) => {
            const row = await repo.assignSubjectToClass({
                tenantId,
                classId: body.class_id,
                subjectId: body.subject_id,
                isMandatory: body.is_mandatory,
            }, client);
            await insertOutboxEvent(client, {
                eventId: randomUUID(),
                eventType: 'academic.class_subject.assigned',
                aggregateId: row.id,
                occurredAt: new Date().toISOString(),
                correlationId: correlationIdFrom(req),
                payload: { tenantId, classId: row.class_id, subjectId: row.subject_id },
            }, 'Class');
            return row;
        });
        ok(res, result, 201);
    } catch (error) {
        handleKnownError(error, next);
    }
};

export const enrollStudentController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const tenantId = tenantIdFrom(req);
        const body = enrollmentSchema.parse(req.body);
        await assertTenantExists(tenantId);
        await assertTenantMemberRole(tenantId, body.student_user_id, ['STUDENT']);
        const result = await withTransaction(async (client) => {
            const row = await repo.enrollStudent({
                tenantId,
                studentUserId: body.student_user_id,
                academicYearId: body.academic_year_id,
                classId: body.class_id,
                sectionId: body.section_id,
                rollNumber: body.roll_number,
            }, client);
            await insertOutboxEvent(client, {
                eventId: randomUUID(),
                eventType: 'academic.student.enrolled',
                aggregateId: row.id,
                occurredAt: new Date().toISOString(),
                correlationId: correlationIdFrom(req),
                payload: {
                    tenantId,
                    enrollmentId: row.id,
                    studentUserId: row.student_user_id,
                    academicYearId: row.academic_year_id,
                    classId: row.class_id,
                    sectionId: row.section_id,
                },
            }, 'Enrollment');
            return row;
        });
        ok(res, result, 201);
    } catch (error) {
        handleKnownError(error, next);
    }
};

export const listEnrollmentsController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const query = paginationSchema.parse(req.query);
        const result = await repo.listEnrollments({
            tenantId: tenantIdFrom(req),
            academicYearId: query.academic_year_id,
            classId: query.class_id,
            sectionId: query.section_id,
            status: query.status,
            page: query.page,
            limit: query.limit,
        });
        ok(res, { enrollments: result.rows, pagination: { page: query.page, limit: query.limit, total: result.total } });
    } catch (error) {
        handleKnownError(error, next);
    }
};

export const assignClassTeacherController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const tenantId = tenantIdFrom(req);
        const body = classTeacherSchema.parse(req.body);
        await assertTenantExists(tenantId);
        await assertTenantMemberRole(tenantId, body.teacher_user_id, ['STAFF']);
        const result = await withTransaction(async (client) => {
            const row = await repo.assignClassTeacher({
                tenantId,
                academicYearId: body.academic_year_id,
                classId: body.class_id,
                sectionId: body.section_id,
                teacherUserId: body.teacher_user_id,
            }, client);
            await insertOutboxEvent(client, {
                eventId: randomUUID(),
                eventType: 'academic.class_teacher.assigned',
                aggregateId: row.id,
                occurredAt: new Date().toISOString(),
                correlationId: correlationIdFrom(req),
                payload: {
                    tenantId,
                    assignmentId: row.id,
                    teacherUserId: row.teacher_user_id,
                    classId: row.class_id,
                    sectionId: row.section_id,
                },
            }, 'TeacherAssignment');
            return row;
        });
        ok(res, result, 201);
    } catch (error) {
        handleKnownError(error, next);
    }
};

export const assignSubjectTeacherController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const tenantId = tenantIdFrom(req);
        const body = subjectTeacherSchema.parse(req.body);
        await assertTenantExists(tenantId);
        await assertTenantMemberRole(tenantId, body.teacher_user_id, ['STAFF']);
        const result = await withTransaction(async (client) => {
            const row = await repo.assignSubjectTeacher({
                tenantId,
                academicYearId: body.academic_year_id,
                classId: body.class_id,
                sectionId: body.section_id,
                subjectId: body.subject_id,
                teacherUserId: body.teacher_user_id,
            }, client);
            await insertOutboxEvent(client, {
                eventId: randomUUID(),
                eventType: 'academic.subject_teacher.assigned',
                aggregateId: row.id,
                occurredAt: new Date().toISOString(),
                correlationId: correlationIdFrom(req),
                payload: {
                    tenantId,
                    assignmentId: row.id,
                    teacherUserId: row.teacher_user_id,
                    classId: row.class_id,
                    sectionId: row.section_id,
                    subjectId: row.subject_id,
                },
            }, 'TeacherAssignment');
            return row;
        });
        ok(res, result, 201);
    } catch (error) {
        handleKnownError(error, next);
    }
};
