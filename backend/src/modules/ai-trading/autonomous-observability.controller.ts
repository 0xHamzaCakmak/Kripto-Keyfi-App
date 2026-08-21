import type { Request, Response } from 'express';
import { success } from '../../utils/response.js';
import type { AutonomousAuditQuery } from './autonomous-observability.schema.js';
import { getAutonomousSystemHealth, listAutonomousAudit } from './autonomous-observability.service.js';

export async function systemHealth(req: Request, res: Response) {
  const result = await getAutonomousSystemHealth(req.user!.id);
  req.log.info({ requestId: req.id, userId: req.user!.id, status: result.status }, 'autonomous trading health checked');
  return success(res, { ...result, correlationId: req.id });
}

export async function autonomousAudit(req: Request, res: Response) {
  return success(res, await listAutonomousAudit(req.user!.id, req.query as unknown as AutonomousAuditQuery));
}
