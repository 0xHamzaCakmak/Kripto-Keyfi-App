import { prisma } from '../src/database/prisma.js';
import { runAutonomousUniverseCycle } from '../src/modules/ai-trading/universe.worker.js';

try {
  console.log(JSON.stringify(await runAutonomousUniverseCycle(), null, 2));
} finally {
  await prisma.$disconnect();
}
