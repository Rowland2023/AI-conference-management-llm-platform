
import { randomUUID } from "node:crypto";

import { RegistrationRepository } from "./infrastructure/repositories/RegistrationRepository.js";
import { ConferenceRepository } from "./infrastructure/repositories/ConferenceRepository.js";

import { CreateRegistrationUseCase } from "./application/user-cases/CreateRegistrationUseCase.js";
import { GetRegistrationUseCase } from "./application/user-cases/GetRegistrationUseCase.js";
import { GetAllRegistrationsUseCase } from "./application/user-cases/GetAllRegistrationsUseCase.js";
import { UpdateRegistrationUseCase } from "./application/user-cases/UpdateRegistrationUseCase.js";
import { CancelRegistrationUseCase } from "./application/user-cases/CancelRegistrationUseCase.js";
import { CheckInRegistrationUseCase } from "./application/user-cases/CheckInRegistrationUseCase.js";

import { RegistrationController } from "./api/registration.controller.js";
import { getRegistrationRoutes } from "./api/registration.route.js";

export function createConferenceRegistrationSubModule({
  db,
  unitOfWorkFactory,
  outboxRepository,
  logger,
  authenticateMiddleware,
}) {
  if (typeof db !== "function") {
    throw new TypeError(
      "Registration module requires a Knex database client."
    );
  }

  if (typeof unitOfWorkFactory !== "function") {
    throw new TypeError(
      "Registration module requires unitOfWorkFactory."
    );
  }

  if (!outboxRepository) {
    throw new TypeError(
      "Registration module requires the shared outboxRepository."
    );
  }

  if (typeof authenticateMiddleware !== "function") {
    throw new TypeError(
      "Registration module requires authenticateMiddleware."
    );
  }

  const transactionManager = unitOfWorkFactory();

  if (
    typeof transactionManager?.runInTransaction !== "function"
  ) {
    throw new TypeError(
      "Registration transaction manager must implement runInTransaction()."
    );
  }

  const registrationRepository = new RegistrationRepository(db);
  const conferenceRepository = new ConferenceRepository({ db });

  const uuidService = {
    generate: () => randomUUID(),
  };

  const createRegistrationUseCase = new CreateRegistrationUseCase({
    registrationRepository,
    conferenceRepository,
    outboxRepository,
    uuidService,
    transactionManager,
    logger,
  });

  const getRegistrationUseCase = new GetRegistrationUseCase({
    registrationRepository,
    conferenceRepository,
  });

  const getAllRegistrationsUseCase = new GetAllRegistrationsUseCase({
    registrationRepository,
    conferenceRepository,
  });

  const updateRegistrationUseCase = new UpdateRegistrationUseCase({
    registrationRepository,
    conferenceRepository,
    outboxRepository,
    transactionManager,
  });

  const cancelRegistrationUseCase = new CancelRegistrationUseCase({
    registrationRepository,
    conferenceRepository,
    outboxRepository,
    transactionManager,
  });

  const checkInRegistrationUseCase = new CheckInRegistrationUseCase({
    registrationRepository,
    conferenceRepository,
    outboxRepository,
    transactionManager,
  });

  const controller = new RegistrationController({
    createRegistrationUseCase,
    getRegistrationUseCase,
    getAllRegistrationsUseCase,
    updateRegistrationUseCase,
    cancelRegistrationUseCase,
    checkInRegistrationUseCase,
    logger,
  });

  const router = getRegistrationRoutes(
    controller,
    authenticateMiddleware
  );

  return {
    name: "registration",
    basePath: "/api/v1/registrations",
    router,
  };
}
