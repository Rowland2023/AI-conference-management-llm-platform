
export function toResponseDto(registration) {
  if (!registration) return null;

  const iso = value =>
    value ? new Date(value).toISOString() : null;

  return {
    id: registration.id,
    attendeeId: registration.userId,
    eventId: registration.conferenceId,
    ticketType: String(registration.ticketTier).toLowerCase(),
    paymentId: registration.paymentId ?? null,
    status: String(registration.status).toLowerCase(),
    notes: registration.attendeeNotes ?? null,
    dietaryRequirements:
      registration.dietaryRequirements ?? null,
    specialAssistance:
      registration.specialAssistance ?? null,
    checkedInAt: iso(registration.checkedInAt),
    cancelledAt: iso(registration.cancelledAt),
    createdAt: iso(registration.createdAt),
    updatedAt: iso(registration.updatedAt),
  };
}

export function toResponseDtoList(registrations = []) {
  return registrations.map(toResponseDto);
}
