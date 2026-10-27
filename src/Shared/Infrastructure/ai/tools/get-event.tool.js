import { z } from 'zod';

export const getEventToolDef = {
  name: 'get_event',
  description: `Look up one event. Provide exactly one of event_id (when the UUID is known)
or search_query (title, speaker or topic). Returns details or a short disambiguation list.`,
  zodSchema: z.object({
    conference_id: z.string().uuid().optional(),
    event_id: z.string().uuid().optional(),
    search_query: z.string().trim().min(2).max(100)
      .transform(s => s.replace(/[%_\\]/g, '').replace(/[^\w\s\-:]/g, ''))
      .pipe(z.string().min(2))
      .optional(),
    limit: z.number().int().min(1).max(10).default(3),
  }).strict().refine(
    d => (d.event_id !== undefined) !== (d.search_query !== undefined),
    { message: 'Provide exactly one of event_id or search_query' }
  ),
  risk: 'read',
  requiresConfirmation: false,
  requiresRole: ['attendee', 'organizer', 'admin'],
  featureFlag: 'llm_get_event_enabled',
  useCase: 'getEvent',
  costCents: 1,
  slaMs: 300,
};
