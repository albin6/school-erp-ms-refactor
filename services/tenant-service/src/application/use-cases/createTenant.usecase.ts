import { v4 as uuidv4 } from 'uuid';
import { Tenant } from '../../domain/aggregates/Tenant';
import { TenantRepository } from '../../infrastructure/database/TenantRepository';
import { MembershipRepository } from '../../infrastructure/database/MembershipRepository';
import { insertOutboxEvent } from '../../infrastructure/database/outbox.repository';
import { withTransaction } from '../../infrastructure/database/db';
import { AppError } from '../../domain/errors/AppError';
import { Membership } from '../../domain/aggregates/Membership';
import { createUserGrpc } from '../../infrastructure/grpc/identity.client';
import { logger } from '../../config/logger';
import { config } from '../../config';
export interface CreateTenantCommand {
    name: string;
    subdomain: string;
    domain?: string;
    adminEmail: string;
    createdBy: string;
    correlationId?: string;
}
export interface CreateTenantResult {
    tenantId: string;
    status: string;
}
const tenantRepo = new TenantRepository();
const membershipRepo = new MembershipRepository();
export const createTenantUseCase = async (cmd: CreateTenantCommand): Promise<CreateTenantResult> => {
    const existing = await tenantRepo.findByAnySubdomain(cmd.subdomain);
    if (existing) {
        throw new AppError('Tenant with this subdomain already exists', 409);
    }

    const tenant = new Tenant({
        name: cmd.name,
        subdomain: cmd.subdomain,
        domain: cmd.domain,
        createdBy: cmd.createdBy,
        status: 'PROVISIONING',
        isActive: false,
    });

    if (config.ASYNC_TENANT_PROVISIONING) {
        await withTransaction(async (client) => {
            await tenantRepo.save(tenant, client);
            await client.query(
                `INSERT INTO tenant_provisioning_steps (tenant_id, step, status, attempts, idempotency_key)
                 VALUES ($1, $2, $3, $4, $5)
                 ON CONFLICT (tenant_id, step) DO UPDATE SET
                    status = EXCLUDED.status,
                    attempts = tenant_provisioning_steps.attempts + 1,
                    updated_at = NOW()`,
                [tenant.id, 'ADMIN_USER', 'PENDING', 1, `tenant-admin:${tenant.id}:${cmd.adminEmail.toLowerCase().trim()}`]
            );
            await insertOutboxEvent(
                client,
                {
                    eventId: uuidv4(),
                    eventType: 'tenant.provisioning.requested',
                    aggregateId: tenant.id,
                    occurredAt: new Date().toISOString(),
                    correlationId: cmd.correlationId,
                    payload: {
                        tenantId: tenant.id,
                        name: tenant.name,
                        subdomain: tenant.subdomain,
                        domain: tenant.domain,
                        adminEmail: cmd.adminEmail,
                        createdBy: tenant.createdBy,
                        idempotencyKey: `tenant-admin:${tenant.id}:${cmd.adminEmail.toLowerCase().trim()}`,
                    },
                },
                'Tenant'
            );
        });
        return { tenantId: tenant.id, status: tenant.status };
    }

    await withTransaction(async (client) => {
        await tenantRepo.save(tenant, client);
    });

    try {
        const adminName = `${cmd.name} Admin`;
        const adminUser = await createUserGrpc(
            cmd.adminEmail,
            adminName,
            `tenant-admin:${cmd.subdomain}:${cmd.adminEmail.toLowerCase().trim()}`,
            true,
            cmd.correlationId
        );

        await withTransaction(async (client) => {
            const existingMembership = await membershipRepo.findByUserAndTenant(adminUser.userId, tenant.id);
            if (!existingMembership) {
                await membershipRepo.save(
                    new Membership({
                        userId: adminUser.userId,
                        tenantId: tenant.id,
                        role: 'ADMIN',
                    }),
                    client
                );
            }

            tenant.activate();
            await tenantRepo.update(tenant, client);

            await insertOutboxEvent(
                client,
                {
                    eventId: uuidv4(),
                    eventType: 'tenant.created',
                    aggregateId: tenant.id,
                    occurredAt: new Date().toISOString(),
                    correlationId: cmd.correlationId,
                    payload: {
                        tenantId: tenant.id,
                        name: tenant.name,
                        subdomain: tenant.subdomain,
                        adminEmail: cmd.adminEmail,
                        createdBy: tenant.createdBy,
                    },
                },
                'Tenant'
            );
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        tenant.failProvisioning(message);
        await tenantRepo.update(tenant).catch((updateError) => {
            logger.error('Failed to mark tenant provisioning as failed', {
                tenantId: tenant.id,
                error: updateError instanceof Error ? updateError.message : String(updateError),
            });
        });
        throw error;
    }

    return { tenantId: tenant.id, status: tenant.status };
};
