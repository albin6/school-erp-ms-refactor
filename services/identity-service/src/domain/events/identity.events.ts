export interface DomainEvent {
    eventId: string;
    eventType: string;
    aggregateId: string;
    occurredAt: string;
    correlationId?: string;
    payload?: unknown;
}
export interface UserCreatedEvent extends DomainEvent {
    eventType: 'identity.user.created';
    payload: {
        userId: string;
        email: string;
        name: string;
        temporaryPassword: string;
    };
}
export interface LoginSucceededEvent extends DomainEvent {
    eventType: 'identity.login.succeeded';
    payload: {
        userId: string;
        email: string;
        role: string;
        tenantId?: string;
        ip: string;
        userAgent: string;
    };
}
export interface LoginFailedEvent extends DomainEvent {
    eventType: 'identity.login.failed';
    payload: {
        email: string;
        ip: string;
        userAgent: string;
        reason: string;
    };
}
export interface PasswordResetEvent extends DomainEvent {
    eventType: 'identity.password.reset';
    payload: {
        userId: string;
        email: string;
    };
}
