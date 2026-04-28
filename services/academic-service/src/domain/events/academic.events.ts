export interface DomainEvent {
    eventId: string;
    eventType: string;
    aggregateId: string;
    occurredAt: string;
    correlationId?: string;
    causationId?: string;
    payload: Record<string, unknown>;
}
