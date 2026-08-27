import { timingSafeEqual } from 'node:crypto';
import { Router } from 'express';
import { env } from '../../config/env.js';
import { asyncHandler } from '../../utils/async-handler.js';
import { ApiError } from '../../utils/api-error.js';
import { aiMentorRequestSchema } from './ai-mentor.schema.js';
import { mentorDecision } from './ai-mentor.service.js';

export const aiMentorRouter = Router();

aiMentorRouter.use((req, _res, next) => {
  const supplied = req.headers.authorization?.replace(/^Bearer\s+/i, '') ?? '';
  const expected = env.TRADING_ENGINE_TOKEN;
  const valid = supplied.length === expected.length && supplied.length > 0 && timingSafeEqual(Buffer.from(supplied), Buffer.from(expected));
  if (!valid) return next(new ApiError(401, 'AI mentor authentication failed.', 'AI_MENTOR_UNAUTHORIZED'));
  next();
});

aiMentorRouter.post('/', asyncHandler(async (req, res) => {
  const input = aiMentorRequestSchema.parse(req.body);
  res.json(await mentorDecision(input));
}));
