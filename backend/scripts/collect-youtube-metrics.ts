import { prisma } from '../src/database/prisma.js';
import { runYoutubeMetricsCollection } from '../src/modules/videos/youtube-metrics.worker.js';

try {
  const result = await runYoutubeMetricsCollection();
  console.log(JSON.stringify(result));
  if (result.failed > 0) process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
