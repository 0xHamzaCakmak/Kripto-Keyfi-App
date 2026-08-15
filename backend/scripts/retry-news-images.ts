import { prisma } from '../src/database/prisma.js';
import { retryNewsImages } from '../src/modules/news/news.worker.js';

let processed = 0;
let uploaded = 0;
for (;;) {
  const result = await retryNewsImages(25);
  processed += result.processed;
  uploaded += result.uploaded;
  if (result.processed === 0 || result.uploaded === 0) break;
}

console.log(JSON.stringify({ processed, uploaded }, null, 2));
await prisma.$disconnect();
