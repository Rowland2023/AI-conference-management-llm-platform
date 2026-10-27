/**
 * Application Port (Contract)
 */
export class UnitOfWork {
  track() {
    throw new Error("track() must be implemented.");
  }

  clear() {
    throw new Error("clear() must be implemented.");
  }

  async execute() {
    throw new Error("execute() must be implemented.");
  }
}