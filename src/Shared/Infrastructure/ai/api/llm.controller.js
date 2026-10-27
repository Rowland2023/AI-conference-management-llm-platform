import { z } from 'zod';
import { ValidationError } from '../../../application/errors/ApplicationErrors.js';
// Adjust the path above to wherever your project exports ValidationError.

const MessageSchema = z.string().trim().min(1, 'message body required').max(2000, 'message too long');
const PendingIdSchema = z.string().uuid();

const toCtx = (u) => ({
  id: u.id,
  tenantId: u.tenantId,
  timezone: u.timezone || 'UTC',
  roles: u.roles || [],
});

export class LLMController {
  constructor({ assistantService, authService, logger = console }) {
    if (!assistantService) throw new Error('LLMController: assistantService required.');
    if (!authService) throw new Error('LLMController: authService required.');

    this.assistantService = assistantService;
    this.authService = authService;
    this.logger = logger;

    this.chat = this.chat.bind(this);
    this.confirm = this.confirm.bind(this);
  }

  async chat(req, res, next) {
    let heartbeat = null;
    let clientClosed = false;
    const abortController = new AbortController();

    const cleanup = () => {
      if (clientClosed) return;
      clientClosed = true;
      if (heartbeat) {
        clearInterval(heartbeat);
        heartbeat = null;
      }
      abortController.abort();
    };

    // "close" on req can fire once the body has been read, so detect disconnects on res.
    const onResClose = () => { if (!res.writableFinished) cleanup(); };
    res.on('close', onResClose);

    const canWrite = () => !clientClosed && res.writable && !res.writableEnded;
    const send = (payload) => { if (canWrite()) res.write(`data: ${JSON.stringify(payload)}\n\n`); };

    try {
      const parsed = MessageSchema.safeParse(req.body?.message);
      if (!parsed.success) throw new ValidationError(parsed.error.issues[0].message);

      const user = await this.authService.getUser(req);
      if (clientClosed) return;

      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');
      res.flushHeaders();

      heartbeat = setInterval(() => {
        if (canWrite()) res.write(': ping\n\n');
      }, 15_000);

      await this.assistantService.interpret({
        message: parsed.data,
        userContext: toCtx(user),
        onToken: (event) => send({ success: true, event }),
        signal: abortController.signal,
      });

      if (canWrite()) {
        res.write('data: [DONE]\n\n');
        res.end();
      }
    } catch (error) {
      if (error.name === 'AbortError' || abortController.signal.aborted) return;

      this.logger.error('[LLM_CHAT_ERROR]', {
        name: error.name,
        code: error.code,
        message: error.message,
      });

      if (!res.headersSent) return next(error);

      if (canWrite()) {
        send({ success: false, error: error.code ?? 'INTERNAL_ERROR' });
        res.end();
      }
    } finally {
      res.off('close', onResClose);
      cleanup();
    }
  }

  async confirm(req, res, next) {
    try {
      const parsed = PendingIdSchema.safeParse(req.body?.pending_id);
      if (!parsed.success) throw new ValidationError('pending_id must be a UUID');

      const user = await this.authService.getUser(req);
      const events = [];

      await this.assistantService.confirm({
        pendingId: parsed.data,
        userContext: toCtx(user),
        onToken: (e) => events.push(e),
      });

      res.setHeader('Cache-Control', 'no-store');
      res.json({ events });
    } catch (e) {
      next(e);
    }
  }
}
