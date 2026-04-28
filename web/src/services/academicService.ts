import api from './api';
import { useTenantAuthStore } from '@/store/tenantAuthStore';

const getTenantId = () => useTenantAuthStore.getState().tenant?.id || '';

export interface AcademicYear {
    id: string;
    tenant_id: string;
    branch_id?: string | null;
    name: string;
    starts_on: string;
    ends_on: string;
    status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
}

export interface AcademicClass {
    id: string;
    tenant_id: string;
    branch_id?: string | null;
    academic_year_id: string;
    name: string;
    sort_order: number;
    status: 'ACTIVE' | 'ARCHIVED';
}

export interface Section {
    id: string;
    tenant_id: string;
    class_id: string;
    name: string;
    capacity?: number | null;
    status: 'ACTIVE' | 'ARCHIVED';
}

export interface Subject {
    id: string;
    tenant_id: string;
    branch_id?: string | null;
    code: string;
    name: string;
    status: 'ACTIVE' | 'ARCHIVED';
}

export interface Enrollment {
    id: string;
    student_user_id: string;
    academic_year_id: string;
    class_id: string;
    section_id: string;
    roll_number?: string | null;
    status: 'ACTIVE' | 'TRANSFERRED' | 'WITHDRAWN' | 'PROMOTED';
    class_name?: string;
    section_name?: string;
}

export interface PagedResult<T> {
    items: T[];
    pagination: {
        page: number;
        limit: number;
        total: number;
    };
}

const unwrapPaged = <T>(payload: any, key: string, fallbackLimit = 20): PagedResult<T> => ({
    items: Array.isArray(payload?.[key]) ? payload[key] : [],
    pagination: {
        page: payload?.pagination?.page ?? 1,
        limit: payload?.pagination?.limit ?? fallbackLimit,
        total: payload?.pagination?.total ?? 0,
    },
});

export const academicService = {
    async getAcademicYears(params: Record<string, any> = {}) {
        const response = await api.get(`/academic/tenants/${getTenantId()}/academic-years`, { params });
        return unwrapPaged<AcademicYear>(response.data.data, 'academic_years', params.limit);
    },
    async createAcademicYear(data: {
        name: string;
        branch_id?: string | null;
        starts_on: string;
        ends_on: string;
        status?: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
    }) {
        const response = await api.post(`/academic/tenants/${getTenantId()}/academic-years`, data);
        return response.data.data as AcademicYear;
    },
    async getTerms(academicYearId: string) {
        const response = await api.get(`/academic/tenants/${getTenantId()}/terms`, {
            params: { academic_year_id: academicYearId },
        });
        return response.data.data;
    },
    async createTerm(data: { academic_year_id: string; name: string; starts_on: string; ends_on: string }) {
        const response = await api.post(`/academic/tenants/${getTenantId()}/terms`, data);
        return response.data.data;
    },
    async getClasses(params: Record<string, any> = {}) {
        const response = await api.get(`/academic/tenants/${getTenantId()}/classes`, { params });
        return unwrapPaged<AcademicClass>(response.data.data, 'classes', params.limit);
    },
    async createClass(data: {
        name: string;
        academic_year_id: string;
        branch_id?: string | null;
        sort_order?: number;
    }) {
        const response = await api.post(`/academic/tenants/${getTenantId()}/classes`, data);
        return response.data.data as AcademicClass;
    },
    async getSections(classId: string) {
        const response = await api.get(`/academic/tenants/${getTenantId()}/sections`, {
            params: { class_id: classId },
        });
        return response.data.data as Section[];
    },
    async createSection(data: { class_id: string; name: string; capacity?: number | null }) {
        const response = await api.post(`/academic/tenants/${getTenantId()}/sections`, data);
        return response.data.data as Section;
    },
    async getSubjects(params: Record<string, any> = {}) {
        const response = await api.get(`/academic/tenants/${getTenantId()}/subjects`, { params });
        return unwrapPaged<Subject>(response.data.data, 'subjects', params.limit);
    },
    async createSubject(data: { code: string; name: string; branch_id?: string | null }) {
        const response = await api.post(`/academic/tenants/${getTenantId()}/subjects`, data);
        return response.data.data as Subject;
    },
    async assignSubjectToClass(data: { class_id: string; subject_id: string; is_mandatory: boolean }) {
        const response = await api.post(`/academic/tenants/${getTenantId()}/class-subjects`, data);
        return response.data.data;
    },
    async getEnrollments(params: Record<string, any> = {}) {
        const response = await api.get(`/academic/tenants/${getTenantId()}/enrollments`, { params });
        return unwrapPaged<Enrollment>(response.data.data, 'enrollments', params.limit);
    },
    async enrollStudent(data: {
        student_user_id: string;
        academic_year_id: string;
        class_id: string;
        section_id: string;
        roll_number?: string | null;
    }) {
        const response = await api.post(`/academic/tenants/${getTenantId()}/enrollments`, data);
        return response.data.data as Enrollment;
    },
    async assignClassTeacher(data: {
        teacher_user_id: string;
        academic_year_id: string;
        class_id: string;
        section_id: string;
    }) {
        const response = await api.post(`/academic/tenants/${getTenantId()}/class-teachers`, data);
        return response.data.data;
    },
    async assignSubjectTeacher(data: {
        teacher_user_id: string;
        academic_year_id: string;
        class_id: string;
        section_id?: string | null;
        subject_id: string;
    }) {
        const response = await api.post(`/academic/tenants/${getTenantId()}/subject-teachers`, data);
        return response.data.data;
    },
};
