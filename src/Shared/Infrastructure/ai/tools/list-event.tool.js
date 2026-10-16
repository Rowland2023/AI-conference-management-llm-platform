import { z } from 'zod';

const isRealCalendarDate = (s) => {
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(s); // rejects 2026-02-30
};

export const listEventToolDef = {
  name: 'list_event',
  description: `List conference events/talks with filters. Returns paginated results.
Use for "what's on today", "show engineering track", "talks in Room A".
Results ordered by start_time ascending. For a single known event use get_event.`,

  zodSchema: z.object({
    conference_id: z.string().uuid()
      .describe('Required. Conference UUID to list from.'),

    track: z.enum(['engineering', 'product', 'design', 'keynote']).optional(),
    room_id: z.string().uuid().optional(),

    date: z.string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD')
      .refine(isRealCalendarDate, 'Invalid calendar date')
      .optional()
      .describe('Date in conference local timezone, e.g. 2026-06-27'),

    search: z.string()
      .trim()
      .toLowerCase()
      .min(2)
      .max(50)
      .transform(s => s.replace(/[%_\\]/g, '').replace(/[^\w\s\-:]/g, ''))
      .pipe(z.string().min(2, 'Search term too short after cleaning'))
      .optional()
      .describe('Keyword search in title/speaker. Min 2 chars.'),

    limit: z.number().int().min(1).max(50).default(20)
      .describe('Results per page. Default 20.'),

    cursor: z.string().max(512).optional()
      .describe('Pagination cursor from previous response.next_cursor'),
  }).strict(),

  risk: 'read',
  requiresConfirmation: false,
  requiresRole: ['attendee', 'organizer', 'admin'],
  featureFlag: 'llm_list_event_enabled',
  useCase: 'listEvent',
  costCents: 2,
  slaMs: 500,
  rateLimit: { perUserPerMin: 20 },

  responseContract: {
    type: 'object',
    properties: {
      events: { type: 'EventSummary[]', maxItems: 50 },
      next_cursor: { type: 'string | null' },
      total_estimate: { type: 'number' },
    },
  },
};