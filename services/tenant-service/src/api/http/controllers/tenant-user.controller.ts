import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { logger } from '../../../config/logger';
import { AppError } from '../../../domain/errors/AppError';
import { getPool } from '../../../infrastructure/database/db';
import { Membership } from '../../../domain/aggregates/Membership';
import { MembershipRepository } from '../../../infrastructure/database/MembershipRepository';
import { BranchRepository } from '../../../infrastructure/database/BranchRepository';
import { TenantRepository } from '../../../infrastructure/database/TenantRepository';
import { batchGetUsersGrpc, createUserGrpc } from '../../../infrastructure/grpc/identity.client';

const membershipRepo = new MembershipRepository();
const branchRepo = new BranchRepository();
const tenantRepo = new TenantRepository();

const createTenantUserSchema = z.object({
    name: z.string().min(1, 'Name is required'),
    email: z.string().email('Invalid email address'),
    role: z.enum(['STAFF', 'STUDENT']),
    branch_id: z.string().uuid('Invalid branch'),
    sub_role: z.enum(['PRINCIPAL', 'TEACHER', 'OFFICE_STAFF', 'OFFICE_ASSISTANT']).optional(),
}).superRefine((data, ctx) => {
    if (data.role === 'STAFF' && !data.sub_role) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Staff role is required',
            path: ['sub_role'],
        });
    }
    if (data.role === 'STUDENT' && data.sub_role) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Students cannot have a staff role',
            path: ['sub_role'],
        });
    }
});
const updateTenantUserSchema = z.object({
    role: z.enum(['STAFF', 'STUDENT']).optional(),
    branch_id: z.string().uuid('Invalid branch').optional(),
    sub_role: z.enum(['PRINCIPAL', 'TEACHER', 'OFFICE_STAFF', 'OFFICE_ASSISTANT']).nullable().optional(),
}).superRefine((data, ctx) => {
    if (data.role === 'STAFF' && data.sub_role === null) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Staff role is required',
            path: ['sub_role'],
        });
    }
    if (data.role === 'STUDENT' && data.sub_role) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Students cannot have a staff role',
            path: ['sub_role'],
        });
    }
});

export const getTenantUsersController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { tenantId } = req.params;
        const page = Math.max(parseInt(String(req.query.page ?? '1'), 10) || 1, 1);
        const limit = Math.min(Math.max(parseInt(String(req.query.limit ?? '10'), 10) || 10, 1), 100);
        const offset = (page - 1) * limit;
        const branchId = typeof req.query.branch_id === 'string' ? req.query.branch_id : undefined;
        const role = typeof req.query.role === 'string' ? req.query.role : undefined;
        const subRole = typeof req.query.sub_role === 'string' ? req.query.sub_role : undefined;
        const search = typeof req.query.search === 'string' ? req.query.search.trim().toLowerCase() : undefined;

        logger.info(`Getting users for tenant: ${tenantId}`);

        const tenant = await tenantRepo.findById(tenantId);
        if (!tenant) {
            throw new AppError('Tenant not found', 404);
        }

        const filters: string[] = ['m.tenant_id = $1'];
        const values: Array<string | number> = [tenantId];

        if (branchId) {
            values.push(branchId);
            filters.push(`m.branch_id = $${values.length}`);
        }
        if (role) {
            values.push(role);
            filters.push(`m.role = $${values.length}`);
        }
        if (subRole) {
            values.push(subRole);
            filters.push(`m.sub_role = $${values.length}`);
        }

        const whereClause = filters.join(' AND ');

        const countQuery = `
            SELECT COUNT(*)::int AS total
            FROM memberships m
            WHERE ${whereClause}
        `;

        values.push(limit, offset);
        const listQuery = `
            SELECT
                m.id,
                m.user_id,
                m.tenant_id,
                m.role,
                m.sub_role,
                m.branch_id,
                m.created_at,
                b.name AS branch_name
            FROM memberships m
            LEFT JOIN branches b ON b.id = m.branch_id
            WHERE ${whereClause}
            ORDER BY m.created_at DESC
            LIMIT $${values.length - 1} OFFSET $${values.length}
        `;

        const [{ rows: countRows }, { rows }] = await Promise.all([
            getPool().query(countQuery, values.slice(0, values.length - 2)),
            getPool().query(listQuery, values),
        ]);

        const identityUsers = await batchGetUsersGrpc(rows.map((row) => row.user_id));
        const identityUserById = new Map(identityUsers.map((user) => [user.userId, user]));
        const users = rows
            .map((row) => {
                const user = identityUserById.get(row.user_id);
                if (!user) {
                    logger.warn('Skipping membership with missing identity user', {
                        tenantId,
                        membershipId: row.id,
                        userId: row.user_id,
                    });
                    return null;
                }
                return {
                    id: row.id,
                    user_id: row.user_id,
                    tenant_id: row.tenant_id,
                    role: row.role,
                    sub_role: row.sub_role ?? undefined,
                    branch_id: row.branch_id ?? undefined,
                    user: {
                        id: user.userId,
                        name: user.name,
                        email: user.email,
                        is_active: user.isActive,
                        last_login_at: undefined,
                    },
                    branch: row.branch_id ? { id: row.branch_id, name: row.branch_name } : undefined,
                    created_at: row.created_at,
                };
            })
            .filter((user): user is NonNullable<typeof user> => user !== null);

        const filteredUsers = search
            ? users.filter((user) =>
                user.user.name.toLowerCase().includes(search) ||
                user.user.email.toLowerCase().includes(search)
            )
            : users;

        res.set({
            'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
            Pragma: 'no-cache',
            Expires: '0',
            'Surrogate-Control': 'no-store',
        });
        res.status(200).json({
            success: true,
            data: {
                users: filteredUsers,
                pagination: {
                    page,
                    limit,
                    total: countRows[0]?.total ?? filteredUsers.length,
                },
            },
        });
    } catch (error) {
        next(error);
    }
};

export const createTenantUserController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { tenantId } = req.params;
        const body = createTenantUserSchema.parse(req.body);
        const correlationId = req.headers['x-correlation-id'] as string | undefined;

        logger.info(`Creating user for tenant: ${tenantId}`);

        const tenant = await tenantRepo.findById(tenantId);
        if (!tenant) {
            throw new AppError('Tenant not found', 404);
        }

        const branch = await branchRepo.findById(tenantId, body.branch_id);
        if (!branch) {
            throw new AppError('Branch not found', 404);
        }

        if (body.role === 'STAFF' && body.sub_role === 'PRINCIPAL') {
            const existingPrincipal = await membershipRepo.findPrincipalByBranch(tenantId, body.branch_id);
            if (existingPrincipal) {
                throw new AppError('A principal is already assigned to this branch', 409);
            }
        }

        const createdUser = await createUserGrpc(
            body.email,
            body.name,
            `tenant-user:${tenantId}:${body.branch_id}:${body.email.toLowerCase().trim()}`,
            true,
            correlationId
        );

        const existingMembership = await membershipRepo.findByUserAndTenant(createdUser.userId, tenantId);
        if (existingMembership) {
            throw new AppError('User already belongs to this tenant', 409);
        }

        const membership = new Membership({
            userId: createdUser.userId,
            tenantId,
            branchId: body.branch_id,
            role: body.role,
            subRole: body.role === 'STAFF' ? body.sub_role ?? null : null,
        });
        const savedMembership = await membershipRepo.save(membership);

        res.status(201).json({
            success: true,
            data: {
                id: savedMembership.id,
                user_id: savedMembership.userId,
                tenant_id: savedMembership.tenantId,
                role: savedMembership.role,
                sub_role: savedMembership.subRole ?? undefined,
                branch_id: savedMembership.branchId ?? undefined,
                user: {
                    id: createdUser.userId,
                    name: body.name,
                    email: body.email,
                    is_active: true,
                },
                branch: {
                    id: branch.id,
                    name: branch.name,
                },
                created_at: savedMembership.createdAt,
            },
        });
    } catch (error) {
        if (error instanceof z.ZodError) {
            next(new AppError(error.errors[0].message, 400));
            return;
        }
        if ((error as { code?: string })?.code === '23505') {
            next(new AppError('User already belongs to this tenant or branch principal already exists', 409));
            return;
        }
        next(error);
    }
};

export const updateTenantUserController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { tenantId, userId } = req.params;
        const body = updateTenantUserSchema.parse(req.body);

        const membership = await membershipRepo.findByUserAndTenant(userId, tenantId);
        if (!membership) {
            throw new AppError('User does not belong to this tenant', 404);
        }
        if (membership.role === 'ADMIN') {
            throw new AppError('Tenant admin membership cannot be changed from this endpoint', 400);
        }

        const nextRole = body.role ?? membership.role;
        const nextBranchId = body.branch_id ?? membership.branchId;
        const nextSubRole = nextRole === 'STAFF'
            ? body.sub_role === undefined ? membership.subRole : body.sub_role
            : null;

        if (!nextBranchId) {
            throw new AppError('Branch assignment is required', 400);
        }

        const branch = await branchRepo.findById(tenantId, nextBranchId);
        if (!branch) {
            throw new AppError('Branch not found', 404);
        }

        if (nextRole === 'STAFF' && !nextSubRole) {
            throw new AppError('Staff role is required', 400);
        }
        if (nextRole === 'STAFF' && nextSubRole === 'PRINCIPAL') {
            const existingPrincipal = await membershipRepo.findPrincipalByBranch(tenantId, nextBranchId);
            if (existingPrincipal && existingPrincipal.userId !== userId) {
                throw new AppError('A principal is already assigned to this branch', 409);
            }
        }

        membership.updateRole(nextRole, nextSubRole, nextBranchId);
        const updated = await membershipRepo.update(membership);
        const [identityUser] = await batchGetUsersGrpc([updated.userId]);

        res.status(200).json({
            success: true,
            data: {
                id: updated.id,
                user_id: updated.userId,
                tenant_id: updated.tenantId,
                role: updated.role,
                sub_role: updated.subRole ?? undefined,
                branch_id: updated.branchId ?? undefined,
                user: identityUser
                    ? {
                        id: identityUser.userId,
                        name: identityUser.name,
                        email: identityUser.email,
                        is_active: identityUser.isActive,
                    }
                    : undefined,
                branch: {
                    id: branch.id,
                    name: branch.name,
                },
                updated_at: updated.updatedAt,
            },
        });
    } catch (error) {
        if (error instanceof z.ZodError) {
            next(new AppError(error.errors[0].message, 400));
            return;
        }
        if ((error as { code?: string })?.code === '23505') {
            next(new AppError('User already belongs to this tenant or branch principal already exists', 409));
            return;
        }
        next(error);
    }
};

export const deleteTenantUserController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { tenantId, userId } = req.params;
        const membership = await membershipRepo.findByUserAndTenant(userId, tenantId);
        if (!membership) {
            throw new AppError('User does not belong to this tenant', 404);
        }
        if (membership.role === 'ADMIN') {
            throw new AppError('Tenant admin membership cannot be deleted from this endpoint', 400);
        }

        await membershipRepo.deleteByUserAndTenant(userId, tenantId);
        res.status(200).json({ success: true, message: 'User removed from tenant successfully' });
    } catch (error) {
        next(error);
    }
};
