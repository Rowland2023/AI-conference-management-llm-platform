import { createEventToolDef } from './create-event.tool.js';
import { getEventToolDef } from './get-event.tool.js';
import { listEventToolDef } from './list-event.tool.js';
import { rescheduleEventToolDef } from './reschedule-event.tool.js';
import { cancelEventToolDef } from './cancel-event.tool.js';

export const toolDefinitions = [
  createEventToolDef, getEventToolDef, listEventToolDef,
  rescheduleEventToolDef, cancelEventToolDef,
];