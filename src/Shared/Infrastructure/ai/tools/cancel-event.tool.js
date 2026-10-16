import { z } from 'zod';

export const cancelEventToolDef = {
  name: 'cancel_event',
  description: `Cancel an existing conference event (soft cancel, kept for audit).
Use for: cancel an event, remove a workshop, drop a talk. Requires event_id and conference_id.`,
  zodSchema: z.object({
    conference_id: z.string().uuid(),
    event_id: z.string().uuid(),
    reason: z.string().trim().min(5).max(500),
    notify_attendees: z.boolean().default(true),
    notify_speakers: z.boolean().default(true),
  }).strict(),
  risk: 'destructive',
  requiresConfirmation: true,
  requiresRole: ['organizer', 'admin'],
  featureFlag: 'llm_cancel_event_enabled',
  useCase: 'cancelEvent',
  costCents: 3,
  slaMs: 500,
  summarize: (p) =>
    `Cancel event ${p.event_id} in conference ${p.conference_id}. Reason: "${p.reason}". ` +
    `Notify attendees: ${p.notify_attendees}, speakers: ${p.notify_speakers}.`,
};
