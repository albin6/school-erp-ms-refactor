import { v4 as uuidv4 } from 'uuid';
import { Tenant } from '../../domain/aggregates/Tenant';
import { TenantRepository } from '../../infrastructure/database/TenantRepository';
import { insertOutboxEvent } from '../../infrastructure/database/outbox.repository';
import { withTransaction } from '../../infrastructure/database/db';
import { AppError } from '../../domain/errors/AppError';
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
}
const tenantRepo = new TenantRepository();
export const createTenantUseCase = async (cmd: CreateTenantCommand): Promise<CreateTenantResult> => {
    const existing = await tenantRepo.findBySubdomain(cmd.subdomain);
    if (existing) {
        throw new AppError('Tenant with this subdomain already exists', 409);
    }
    const tenant = new Tenant({
        name: cmd.name,
        subdomain: cmd.subdomain,
        domain: cmd.domain,
        createdBy: cmd.createdBy,
    });
    await withTransaction(async (client) => {
        await tenantRepo.save(tenant, client);
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
    return { tenantId: tenant.id };
};
