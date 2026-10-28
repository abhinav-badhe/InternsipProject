/**
 * Canonical Domain Event Envelope according to platform architecture specification (Section 12).
 * All services and workers must use this structure when publishing or consuming events.
 */
export interface DomainEvent<T = Record<string, unknown>> {
  /** Unique UUID identifier for this specific event instance (used for deduplication) */
  eventId: string;

  /** Dot-delimited domain event name, e.g., 'catalog.product.created' */
  eventType: string;

  /** Incremental schema version for this event type */
  eventVersion: number;

  /** ISO-8601 UTC timestamp of when the event occurred */
  occurredAt: string;

  /** Name of the producing service, e.g., 'catalog-service' */
  producer: string;

  /** Trace correlation ID spanning the entire distributed request */
  correlationId: string;

  /** Identifier of the command or parent event that caused this event */
  causationId?: string;

  /** Name of the domain aggregate, e.g., 'product', 'order', 'reservation' */
  aggregateType: string;

  /** Stable identifier of the aggregate instance */
  aggregateId: string;

  /** Event-specific domain payload */
  data: T;
}

/** Helper factory to create a standard domain event */
export function createDomainEvent<T>(params: {
  eventId: string;
  eventType: string;
  eventVersion?: number;
  producer: string;
  correlationId: string;
  causationId?: string;
  aggregateType: string;
  aggregateId: string;
  data: T;
}): DomainEvent<T> {
  return {
    eventId: params.eventId,
    eventType: params.eventType,
    eventVersion: params.eventVersion ?? 1,
    occurredAt: new Date().toISOString(),
    producer: params.producer,
    correlationId: params.correlationId,
    causationId: params.causationId,
    aggregateType: params.aggregateType,
    aggregateId: params.aggregateId,
    data: params.data,
  };
}
