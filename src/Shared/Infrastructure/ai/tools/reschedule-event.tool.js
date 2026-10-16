import { z } from 'zod';

const MAX_DURATION_MS = 12 * 60 * 60 * 1000;

export const rescheduleEventToolDef = {
  name: 'reschedule_event',
  description: `Change the start_time, end_time, and/or room_id of an existing conference event.
Use when the user says "move the keynote to 3pm", "shift Room A talks 30min later", "swap rooms".
Validates no scheduling conflicts before committing. Emits EventRescheduled to the outbox.
Cannot reschedule events that already started.`,

  zodSchema: z.object({
    conference_id: z.string().uuid()
      .describe('Required. Parent conference UUID for authz scoping.'),

    event_id: z.string().uuid()
      .describe('Required. Event UUID to reschedule.'),

    start_time: z.string()
      .datetime({ offset: false, message: 'Must be UTC with Z suffix' })
      .optional()
      .describe('New UTC start time. Must be in the future. If provided, end_time must also be provided.'),

    end_time: z.string()
      .datetime({ offset: false, message: 'Must be UTC with Z suffix' })
      .optional()
      .describe('New UTC end time. Must be after start_time.'),

    room_id: z.string().uuid().nullable().optional()
      .describe('New room UUID. Set to null to unassign from room. Omit to keep current room.'),

    reason: z.string()
      .trim()
      .min(5, 'Reason too short')
      .max(500)
      .optional()
      .describe('Optional reason for audit log: "speaker flight delay", "room A/V issue".'),
  })
  .strict()
  .superRefine((data, ctx) => {
    const hasTimeChange = data.start_time !== undefined || data.end_time !== undefined;
    const hasRoomChange = data.room_id !== undefined;

    if (!hasTimeChange && !hasRoomChange) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Must provide start_time/end_time or room_id to change',
        path: ['start_time'],
      });
    }
    if (data.start_time && !data.end_time) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'end_time required when changing start_time', path: ['end_time'] });
    }
    if (data.end_time && !data.start_time) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'start_time required when changing end_time', path: ['start_time'] });
    }

    if (data.start_time && data.end_time) {
      const start = new Date(data.start_time);
      const end = new Date(data.end_time);

      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Invalid ISO 8601 datetime', path: ['start_time'] });
        return;
      }
      if (start <= new Date()) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'New start_time must be in the future', path: ['start_time'] });
      }
      if (end <= start) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'end_time must be after start_time', path: ['end_time'] });
      }
      if (end.getTime() - start.getTime() > MAX_DURATION_MS) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Event cannot be longer than 12 hours', path: ['end_time'] });
      }
    }
  }),

  risk: 'write',
  requiresConfirmation: true,
  requiresRole: ['organizer', 'admin'],
  featureFlag: 'llm_reschedule_event_enabled',
  useCase: 'rescheduleEvent',
  costCents: 5,
  slaMs: 2000,
  rateLimit: { perUserPerMin: 10, perEventPerMin: 3 },

  summarize: (p) => {
    const parts = [];
    if (p.start_time) parts.push(`time to ${p.start_time} – ${p.end_time}`);
    if (p.room_id !== undefined) parts.push(p.room_id === null ? 'room to unassigned' : `room to ${p.room_id}`);
    return `Change event ${p.event_id}: ${parts.join(' and ')}.${p.reason ? ` Reason: "${p.reason}".` : ''}`;
  },

  responseContract: {
    type: 'object',
    properties: {
      event_id: { type: 'string' },
      old_start_time: { type: 'string' },
      new_start_time: { type: 'string' },
      old_room_id: { type: 'string | null' },
      new_room_id: { type: 'string | null' },
      conflict_warnings: { type: 'string[]' },
    },
  },
};
