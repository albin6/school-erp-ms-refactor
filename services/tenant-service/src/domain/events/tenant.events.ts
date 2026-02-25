export interface DomainEvent {
    eventId: string;
    eventType: string;
    aggregateId: string;
    occurredAt: string;
    correlationId?: string;
    payload?: any;
}
export interface TenantCreatedEvent extends DomainEvent {
    eventType: 'tenant.created';
    payload: {
        tenantId: string;
        name: string;
        subdomain: string;
        adminEmail: string;
        createdBy: string;
    };
}
export interface MembershipCreatedEvent extends DomainEvent {
    eventType: 'membership.created';
    payload: {
        membershipId: string;
        userId: string;
        tenantId: string;
        role: string;
        subRole?: string | null;
        branchId?: string | null;
    };
}
