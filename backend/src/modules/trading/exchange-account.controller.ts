import type { Request, Response } from 'express';
import { success } from '../../utils/response.js';
import type { CreateExchangeAccountInput, UpdateExecutionEngineInput } from './exchange-account.schema.js';
import { createExchangeAccount, deleteExchangeAccount, getExchangeBalances, listExchangeAccounts, testExchangeAccount, updateExecutionEngine } from './exchange-account.service.js';

export async function listAccounts(req: Request, res: Response) {
  return success(res, await listExchangeAccounts(req.user!.id));
}

export async function createAccount(req: Request, res: Response) {
  return success(res, await createExchangeAccount(req.user!.id, req.body as CreateExchangeAccountInput), 201);
}

export async function testAccount(req: Request, res: Response) {
  return success(res, await testExchangeAccount(req.user!.id, req.params.id as string));
}

export async function balances(req: Request, res: Response) {
  return success(res, await getExchangeBalances(req.user!.id, req.params.id as string));
}

export async function removeAccount(req: Request, res: Response) {
  return success(res, await deleteExchangeAccount(req.user!.id, req.params.id as string));
}

export async function changeExecutionEngine(req: Request, res: Response) {
  return success(res, await updateExecutionEngine(req.user!.id, req.params.id as string, req.body as UpdateExecutionEngineInput));
}
