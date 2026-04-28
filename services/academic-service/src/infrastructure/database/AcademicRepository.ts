import { PoolClient } from 'pg';
import { getPool } from './db';
import { AppError } from '../../domain/errors/AppError';

type Queryable = Pick<PoolClient, 'query'>;

const db = (client?: Queryable): Queryable => client ?? getPool();

export interface ListParams {
    tenantId: string;
    branchId?: string;
    academicYearId?: string;
    classId?: string;
    sectionId?: string;
    status?: string;
    page: number;
    limit: number;
}

export class AcademicRepository {
    async createAcademicYear(input: {
        tenantId: string;
        branchId?: string | null;
        name: string;
        startsOn: string;
        endsOn: string;
        status?: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
    }, client?: Queryable) {
        const { rows } = await db(client).query(
            `INSERT INTO academic_years (tenant_id, branch_id, name, starts_on, ends_on, status)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING *`,
            [input.tenantId, input.branchId ?? null, input.name, input.startsOn, input.endsOn, input.status ?? 'DRAFT']
        );
        return rows[0];
    }

    async listAcademicYears(params: ListParams) {
        const values: Array<string | number | null> = [params.tenantId];
        const filters = ['tenant_id = $1'];
        if (params.branchId !== undefined) {
            values.push(params.branchId || null);
            filters.push(`branch_id IS NOT DISTINCT FROM $${values.length}`);
        }
        if (params.status) {
            values.push(params.status);
            filters.push(`status = $${values.length}`);
        }
        const offset = (params.page - 1) * params.limit;
        values.push(params.limit, offset);
        const where = filters.join(' AND ');
        const [{ rows: countRows }, { rows }] = await Promise.all([
            getPool().query(`SELECT COUNT(*)::int AS total FROM academic_years WHERE ${where}`, values.slice(0, -2)),
            getPool().query(
                `SELECT * FROM academic_years
                  WHERE ${where}
                  ORDER BY starts_on DESC, created_at DESC
                  LIMIT $${values.length - 1} OFFSET $${values.length}`,
                values
            ),
        ]);
        return { rows, total: countRows[0]?.total ?? 0 };
    }

    async findAcademicYear(tenantId: string, academicYearId: string, client?: Queryable) {
        const { rows } = await db(client).query(
            `SELECT * FROM academic_years WHERE tenant_id = $1 AND id = $2`,
            [tenantId, academicYearId]
        );
        return rows[0] ?? null;
    }

    async createTerm(input: {
        tenantId: string;
        academicYearId: string;
        name: string;
        startsOn: string;
        endsOn: string;
    }, client?: Queryable) {
        await this.assertAcademicYear(input.tenantId, input.academicYearId, client);
        const { rows } = await db(client).query(
            `INSERT INTO terms (tenant_id, academic_year_id, name, starts_on, ends_on)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING *`,
            [input.tenantId, input.academicYearId, input.name, input.startsOn, input.endsOn]
        );
        return rows[0];
    }

    async listTerms(params: ListParams) {
        if (!params.academicYearId) throw new AppError('Academic year is required', 400);
        const { rows } = await getPool().query(
            `SELECT * FROM terms
              WHERE tenant_id = $1 AND academic_year_id = $2
              ORDER BY starts_on ASC, created_at ASC`,
            [params.tenantId, params.academicYearId]
        );
        return rows;
    }

    async createClass(input: {
        tenantId: string;
        branchId?: string | null;
        academicYearId: string;
        name: string;
        sortOrder?: number;
    }, client?: Queryable) {
        await this.assertAcademicYear(input.tenantId, input.academicYearId, client);
        const { rows } = await db(client).query(
            `INSERT INTO classes (tenant_id, branch_id, academic_year_id, name, sort_order)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING *`,
            [input.tenantId, input.branchId ?? null, input.academicYearId, input.name, input.sortOrder ?? 0]
        );
        return rows[0];
    }

    async listClasses(params: ListParams) {
        const values: Array<string | number | null> = [params.tenantId];
        const filters = ['tenant_id = $1'];
        if (params.academicYearId) {
            values.push(params.academicYearId);
            filters.push(`academic_year_id = $${values.length}`);
        }
        if (params.branchId !== undefined) {
            values.push(params.branchId || null);
            filters.push(`branch_id IS NOT DISTINCT FROM $${values.length}`);
        }
        if (params.status) {
            values.push(params.status);
            filters.push(`status = $${values.length}`);
        }
        const offset = (params.page - 1) * params.limit;
        values.push(params.limit, offset);
        const where = filters.join(' AND ');
        const [{ rows: countRows }, { rows }] = await Promise.all([
            getPool().query(`SELECT COUNT(*)::int AS total FROM classes WHERE ${where}`, values.slice(0, -2)),
            getPool().query(
                `SELECT * FROM classes
                  WHERE ${where}
                  ORDER BY sort_order ASC, name ASC
                  LIMIT $${values.length - 1} OFFSET $${values.length}`,
                values
            ),
        ]);
        return { rows, total: countRows[0]?.total ?? 0 };
    }

    async findClass(tenantId: string, classId: string, client?: Queryable) {
        const { rows } = await db(client).query(
            `SELECT * FROM classes WHERE tenant_id = $1 AND id = $2`,
            [tenantId, classId]
        );
        return rows[0] ?? null;
    }

    async createSection(input: {
        tenantId: string;
        classId: string;
        name: string;
        capacity?: number | null;
    }, client?: Queryable) {
        await this.assertClass(input.tenantId, input.classId, client);
        const { rows } = await db(client).query(
            `INSERT INTO sections (tenant_id, class_id, name, capacity)
             VALUES ($1, $2, $3, $4)
             RETURNING *`,
            [input.tenantId, input.classId, input.name, input.capacity ?? null]
        );
        return rows[0];
    }

    async listSections(params: ListParams) {
        if (!params.classId) throw new AppError('Class is required', 400);
        const { rows } = await getPool().query(
            `SELECT * FROM sections
              WHERE tenant_id = $1 AND class_id = $2
              ORDER BY name ASC`,
            [params.tenantId, params.classId]
        );
        return rows;
    }

    async findSection(tenantId: string, sectionId: string, client?: Queryable) {
        const { rows } = await db(client).query(
            `SELECT * FROM sections WHERE tenant_id = $1 AND id = $2`,
            [tenantId, sectionId]
        );
        return rows[0] ?? null;
    }

    async createSubject(input: {
        tenantId: string;
        branchId?: string | null;
        code: string;
        name: string;
    }, client?: Queryable) {
        const { rows } = await db(client).query(
            `INSERT INTO subjects (tenant_id, branch_id, code, name)
             VALUES ($1, $2, $3, $4)
             RETURNING *`,
            [input.tenantId, input.branchId ?? null, input.code, input.name]
        );
        return rows[0];
    }

    async listSubjects(params: ListParams) {
        const values: Array<string | number | null> = [params.tenantId];
        const filters = ['tenant_id = $1'];
        if (params.branchId !== undefined) {
            values.push(params.branchId || null);
            filters.push(`branch_id IS NOT DISTINCT FROM $${values.length}`);
        }
        if (params.status) {
            values.push(params.status);
            filters.push(`status = $${values.length}`);
        }
        const offset = (params.page - 1) * params.limit;
        values.push(params.limit, offset);
        const where = filters.join(' AND ');
        const [{ rows: countRows }, { rows }] = await Promise.all([
            getPool().query(`SELECT COUNT(*)::int AS total FROM subjects WHERE ${where}`, values.slice(0, -2)),
            getPool().query(
                `SELECT * FROM subjects
                  WHERE ${where}
                  ORDER BY name ASC
                  LIMIT $${values.length - 1} OFFSET $${values.length}`,
                values
            ),
        ]);
        return { rows, total: countRows[0]?.total ?? 0 };
    }

    async findSubject(tenantId: string, subjectId: string, client?: Queryable) {
        const { rows } = await db(client).query(
            `SELECT * FROM subjects WHERE tenant_id = $1 AND id = $2`,
            [tenantId, subjectId]
        );
        return rows[0] ?? null;
    }

    async assignSubjectToClass(input: {
        tenantId: string;
        classId: string;
        subjectId: string;
        isMandatory: boolean;
    }, client?: Queryable) {
        await this.assertClass(input.tenantId, input.classId, client);
        await this.assertSubject(input.tenantId, input.subjectId, client);
        const { rows } = await db(client).query(
            `INSERT INTO class_subjects (tenant_id, class_id, subject_id, is_mandatory)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (tenant_id, class_id, subject_id)
             DO UPDATE SET is_mandatory = EXCLUDED.is_mandatory
             RETURNING *`,
            [input.tenantId, input.classId, input.subjectId, input.isMandatory]
        );
        return rows[0];
    }

    async enrollStudent(input: {
        tenantId: string;
        studentUserId: string;
        academicYearId: string;
        classId: string;
        sectionId: string;
        rollNumber?: string | null;
    }, client?: Queryable) {
        await this.assertAcademicYear(input.tenantId, input.academicYearId, client);
        const classRow = await this.assertClass(input.tenantId, input.classId, client);
        const section = await this.assertSection(input.tenantId, input.sectionId, client);
        if (section.class_id !== classRow.id) {
            throw new AppError('Section does not belong to the selected class', 400);
        }
        if (classRow.academic_year_id !== input.academicYearId) {
            throw new AppError('Class does not belong to the selected academic year', 400);
        }

        const { rows } = await db(client).query(
            `INSERT INTO student_enrollments
                (tenant_id, student_user_id, academic_year_id, class_id, section_id, roll_number)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING *`,
            [input.tenantId, input.studentUserId, input.academicYearId, input.classId, input.sectionId, input.rollNumber ?? null]
        );
        return rows[0];
    }

    async listEnrollments(params: ListParams) {
        const values: Array<string | number> = [params.tenantId];
        const filters = ['e.tenant_id = $1'];
        if (params.academicYearId) {
            values.push(params.academicYearId);
            filters.push(`e.academic_year_id = $${values.length}`);
        }
        if (params.classId) {
            values.push(params.classId);
            filters.push(`e.class_id = $${values.length}`);
        }
        if (params.sectionId) {
            values.push(params.sectionId);
            filters.push(`e.section_id = $${values.length}`);
        }
        if (params.status) {
            values.push(params.status);
            filters.push(`e.status = $${values.length}`);
        }
        const offset = (params.page - 1) * params.limit;
        values.push(params.limit, offset);
        const where = filters.join(' AND ');
        const [{ rows: countRows }, { rows }] = await Promise.all([
            getPool().query(`SELECT COUNT(*)::int AS total FROM student_enrollments e WHERE ${where}`, values.slice(0, -2)),
            getPool().query(
                `SELECT e.*, c.name AS class_name, s.name AS section_name
                   FROM student_enrollments e
                   JOIN classes c ON c.id = e.class_id AND c.tenant_id = e.tenant_id
                   JOIN sections s ON s.id = e.section_id AND s.tenant_id = e.tenant_id
                  WHERE ${where}
                  ORDER BY s.name ASC, e.roll_number ASC NULLS LAST, e.enrolled_at DESC
                  LIMIT $${values.length - 1} OFFSET $${values.length}`,
                values
            ),
        ]);
        return { rows, total: countRows[0]?.total ?? 0 };
    }

    async assignClassTeacher(input: {
        tenantId: string;
        academicYearId: string;
        classId: string;
        sectionId: string;
        teacherUserId: string;
    }, client?: Queryable) {
        await this.assertAcademicYear(input.tenantId, input.academicYearId, client);
        const classRow = await this.assertClass(input.tenantId, input.classId, client);
        if (classRow.academic_year_id !== input.academicYearId) {
            throw new AppError('Class does not belong to the selected academic year', 400);
        }
        const section = await this.assertSection(input.tenantId, input.sectionId, client);
        if (section.class_id !== classRow.id) {
            throw new AppError('Section does not belong to the selected class', 400);
        }

        const { rows } = await db(client).query(
            `INSERT INTO class_teacher_assignments
                (tenant_id, class_id, section_id, teacher_user_id, academic_year_id)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (tenant_id, academic_year_id, class_id, section_id)
             DO UPDATE SET teacher_user_id = EXCLUDED.teacher_user_id
             RETURNING *`,
            [input.tenantId, input.classId, input.sectionId, input.teacherUserId, input.academicYearId]
        );
        return rows[0];
    }

    async assignSubjectTeacher(input: {
        tenantId: string;
        academicYearId: string;
        classId: string;
        sectionId?: string | null;
        subjectId: string;
        teacherUserId: string;
    }, client?: Queryable) {
        await this.assertAcademicYear(input.tenantId, input.academicYearId, client);
        const classRow = await this.assertClass(input.tenantId, input.classId, client);
        await this.assertSubject(input.tenantId, input.subjectId, client);
        if (classRow.academic_year_id !== input.academicYearId) {
            throw new AppError('Class does not belong to the selected academic year', 400);
        }
        if (input.sectionId) {
            const section = await this.assertSection(input.tenantId, input.sectionId, client);
            if (section.class_id !== classRow.id) {
                throw new AppError('Section does not belong to the selected class', 400);
            }
        }

        const { rows } = await db(client).query(
            `INSERT INTO subject_teacher_assignments
                (tenant_id, class_id, section_id, subject_id, teacher_user_id, academic_year_id)
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT (tenant_id, academic_year_id, class_id, section_id, subject_id, teacher_user_id)
             DO NOTHING
             RETURNING *`,
            [input.tenantId, input.classId, input.sectionId ?? null, input.subjectId, input.teacherUserId, input.academicYearId]
        );
        if (rows[0]) return rows[0];
        const existing = await db(client).query(
            `SELECT * FROM subject_teacher_assignments
              WHERE tenant_id = $1
                AND academic_year_id = $2
                AND class_id = $3
                AND section_id IS NOT DISTINCT FROM $4
                AND subject_id = $5
                AND teacher_user_id = $6`,
            [input.tenantId, input.academicYearId, input.classId, input.sectionId ?? null, input.subjectId, input.teacherUserId]
        );
        return existing.rows[0];
    }

    async assertAcademicYear(tenantId: string, academicYearId: string, client?: Queryable) {
        const row = await this.findAcademicYear(tenantId, academicYearId, client);
        if (!row) throw new AppError('Academic year not found', 404);
        return row;
    }

    async assertClass(tenantId: string, classId: string, client?: Queryable) {
        const row = await this.findClass(tenantId, classId, client);
        if (!row) throw new AppError('Class not found', 404);
        return row;
    }

    async assertSection(tenantId: string, sectionId: string, client?: Queryable) {
        const row = await this.findSection(tenantId, sectionId, client);
        if (!row) throw new AppError('Section not found', 404);
        return row;
    }

    async assertSubject(tenantId: string, subjectId: string, client?: Queryable) {
        const row = await this.findSubject(tenantId, subjectId, client);
        if (!row) throw new AppError('Subject not found', 404);
        return row;
    }
}
