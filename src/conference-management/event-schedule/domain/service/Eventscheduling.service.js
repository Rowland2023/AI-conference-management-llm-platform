
import { DomainInvariantError } from "../../../../Shared/domain/error/DomainErrors.js";

/**
 * Domain service enforcing event scheduling policies.
 */
export class EventSchedulingService {
  constructor({ eventRepository }) {
    if (!eventRepository) {
      throw new Error(
        "EventSchedulingService Critical Failure: eventRepository required.",
      );
    }

    this.eventRepository = eventRepository;
  }

  /**
   * Validates whether a new event can be scheduled.
   *
   * @param {{roomId: string, startTime: Date|string, endTime: Date|string}} params
   * @param {object|null} trx
   */
  async ensureCanSchedule({ roomId, startTime, endTime }, trx = null) {
    const cleanedRoomId = this.#validateAndCleanRoomId(roomId);
    const { start, end } = this.#validateAndNormalizeTimeWindow(
      startTime,
      endTime,
    );

    if (end.getTime() <= Date.now()) {
      throw new DomainInvariantError(
        "Scheduling policy failure: Cannot schedule an event that concludes in the past.",
      );
    }

    const hasConflict = await this.eventRepository.existsOverlappingEvent(
      cleanedRoomId,
      start.toISOString(),
      end.toISOString(),
      null,
      trx,
    );

    if (hasConflict) {
      throw new DomainInvariantError(
        `Room reservation conflict: Room [${cleanedRoomId}] is already reserved during ${start.toISOString()} - ${end.toISOString()}.`,
      );
    }
  }

  /**
   * Validates whether an existing event can be rescheduled.
   *
   * @param {object} event Event aggregate instance
   * @param {Date|string} newStartTime
   * @param {Date|string} newEndTime
   * @param {object|null} trx
   */
  async ensureCanReschedule(
    event,
    newStartTime,
    newEndTime,
    trx = null,
  ) {
    if (!event?.id) {
      throw new DomainInvariantError(
        "EventSchedulingService: Valid event aggregate instance required.",
      );
    }

    // The Event aggregate's property is roomID, not roomId.
    const cleanedRoomId = this.#validateAndCleanRoomId(event.roomID);
    const { start, end } = this.#validateAndNormalizeTimeWindow(
      newStartTime,
      newEndTime,
    );

    if (end.getTime() <= Date.now()) {
      throw new DomainInvariantError(
        "Scheduling policy failure: Cannot reschedule an event to conclude in the past.",
      );
    }

    const hasConflict = await this.eventRepository.existsOverlappingEvent(
      cleanedRoomId,
      start.toISOString(),
      end.toISOString(),
      event.id,
      trx,
    );

    if (hasConflict) {
      throw new DomainInvariantError(
        `Room reservation conflict: Room [${cleanedRoomId}] is already reserved during the requested rescheduling window.`,
      );
    }
  }

  #validateAndCleanRoomId(roomId) {
    if (
      typeof roomId !== "string" ||
      roomId.trim() === ""
    ) {
      throw new DomainInvariantError(
        "Scheduling policy failure: A valid, non-empty roomId string is required.",
      );
    }

    return roomId.trim();
  }

  #validateAndNormalizeTimeWindow(startTime, endTime) {
    if (startTime == null || endTime == null) {
      throw new DomainInvariantError(
        "Scheduling policy failure: Both start and end time parameters are mandatory.",
      );
    }

    const start = new Date(startTime);
    const end = new Date(endTime);

    if (Number.isNaN(start.getTime())) {
      throw new DomainInvariantError(
        "Scheduling policy failure: Provided startTime is an invalid Date format.",
      );
    }

    if (Number.isNaN(end.getTime())) {
      throw new DomainInvariantError(
        "Scheduling policy failure: Provided endTime is an invalid Date format.",
      );
    }

    if (start.getTime() >= end.getTime()) {
      throw new DomainInvariantError(
        "Chronological policy failure: The event allocation endTime must succeed the startTime.",
      );
    }

    return { start, end };
  }
}
