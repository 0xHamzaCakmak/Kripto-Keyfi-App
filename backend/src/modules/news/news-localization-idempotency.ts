export function shouldSkipNewsLocalization(input: {
  force: boolean;
  manualEditedAt: Date | null;
  aiEnabled: boolean;
  existingInputHash: string | null;
  inputHash: string;
  titleTr: string | null;
  summaryTr: string | null;
  hasAiSummary: boolean;
}) {
  if (input.force) return false;
  if (input.manualEditedAt || !input.aiEnabled) return true;
  if (input.existingInputHash === input.inputHash) return true;
  return Boolean(input.titleTr && input.summaryTr && input.hasAiSummary);
}
