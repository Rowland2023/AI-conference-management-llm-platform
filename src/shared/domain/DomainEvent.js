export class DomainEvent {
  constructor({ aggregateId, eventType, payload = {}, occurredOn = new Date() } = {}) {
    this.aggregateId = aggregateId;
    this.eventType = eventType || this.constructor.name;
    this.payload = payload;
    this.occurredOn = occurredOn;
  }
}

export default DomainEvent;
