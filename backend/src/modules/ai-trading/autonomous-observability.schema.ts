import { z } from 'zod';

export const autonomousAuditQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
}).strict();

export type AutonomousAuditQuery = z.infer<typeof autonomousAuditQuerySchema>;
