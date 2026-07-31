import { prisma } from '../../database/prisma.js';

export const countUsers = () => prisma.user.count();

