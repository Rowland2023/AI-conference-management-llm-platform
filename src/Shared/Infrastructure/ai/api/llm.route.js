import { Router } from 'express';

/**
 * @param {Object} dependencies
 * @param {import('./llm.controller.js').LLMController} dependencies.llmController
 * @param {Function} dependencies.authenticate - HTTP auth middleware
 * @returns {Router}
 */
export function createLLMRouter({ llmController, authenticate }) {
  if (!llmController) throw new Error('createLLMRouter: llmController required.');
  if (!authenticate) throw new Error('createLLMRouter: authenticate middleware required.');

  const router = Router();

  /**
   * POST /api/v1/assistant/chat
   * Body: { message: string }
   * Streams Server-Sent Events. A write action emits a `confirmation_required`
   * event containing a pending_id.
   */
  router.post('/chat', authenticate, llmController.chat);

  /**
   * POST /api/v1/assistant/confirm
   * Body: { pending_id: uuid }
   * Executes a previously proposed action once, for the same user and tenant.
   */
  router.post('/confirm', authenticate, llmController.confirm);

  return router;
}