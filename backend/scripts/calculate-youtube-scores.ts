import { prisma } from '../src/database/prisma.js';
import { calculateYoutubeChannelScores } from '../src/modules/videos/youtube-score.service.js';

try {
  const result = await calculateYoutubeChannelScores();
  console.log(JSON.stringify(result));
} finally {
  await prisma.$disconnect();
}
