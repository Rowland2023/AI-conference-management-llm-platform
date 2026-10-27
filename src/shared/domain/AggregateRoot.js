import { Entity } from "./Entity.js";

export class AggregateRoot extends Entity {
  #domainEvents = [];

  constructor(props = {}) {
    super(props);
  }

  addDomainEvent(event) {
    if (!event) {
      throw new Error("Domain event is required.");
    }
    this.#domainEvents.push(event);
  }

  record(event) {
    this.addDomainEvent(event);
  }

  getDomainEvents() {
    return [...this.#domainEvents];
  }

  hasDomainEvents() {
    return this.#domainEvents.length > 0;
  }

  pullDomainEvents() {
    const events = [...this.#domainEvents];
    this.#domainEvents.length = 0;
    return events;
  }

  clearDomainEvents() {
    this.#domainEvents.length = 0;
  }
}

export default AggregateRoot;
