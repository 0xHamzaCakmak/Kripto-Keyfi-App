import { z } from 'zod';

const weight = z.number().min(0).max(100);

export const updateYoutubeScoreWeightsBodySchema = z.object({
  reach: weight,
  engagement: weight,
  viewPower: weight,
  consistency: weight,
  growth: weight,
}).superRefine((weights, context) => {
  const total = weights.reach + weights.engagement + weights.viewPower + weights.consistency + weights.growth;
  if (Math.abs(total - 100) > 0.001) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'Skor ağırlıklarının toplamı tam olarak %100 olmalıdır.' });
  }
});
