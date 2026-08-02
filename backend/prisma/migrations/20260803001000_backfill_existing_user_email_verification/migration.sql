-- Existing accounts predate email verification tracking. Preserve their prior
-- verified UI state; new password registrations start unverified.
UPDATE `users`
SET `emailVerifiedAt` = CURRENT_TIMESTAMP(3)
WHERE `emailVerifiedAt` IS NULL
  AND `createdAt` < '2026-08-03 00:00:00.000';
