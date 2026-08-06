-- AlterTable
ALTER TABLE `trading_bots` ALTER COLUMN `updatedAt` DROP DEFAULT;

-- AlterTable
ALTER TABLE `trading_risk_controls` ALTER COLUMN `updatedAt` DROP DEFAULT;

-- AlterTable
ALTER TABLE `trading_risk_profiles` ALTER COLUMN `updatedAt` DROP DEFAULT;

-- CreateTable
CREATE TABLE `news_sources` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `slug` VARCHAR(80) NOT NULL,
    `websiteUrl` VARCHAR(500) NOT NULL,
    `feedUrl` VARCHAR(500) NULL,
    `apiConfig` JSON NULL,
    `integrationType` ENUM('RSS', 'API') NOT NULL,
    `language` VARCHAR(12) NOT NULL DEFAULT 'tr',
    `category` VARCHAR(80) NULL,
    `logoUrl` VARCHAR(500) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT false,
    `isTrusted` BOOLEAN NOT NULL DEFAULT false,
    `autoPublish` BOOLEAN NOT NULL DEFAULT false,
    `commercialUseAllowed` BOOLEAN NOT NULL DEFAULT false,
    `excerptAllowed` BOOLEAN NOT NULL DEFAULT false,
    `imageUseAllowed` BOOLEAN NOT NULL DEFAULT false,
    `attributionRequired` BOOLEAN NOT NULL DEFAULT true,
    `termsUrl` VARCHAR(500) NULL,
    `lastTermsCheckedAt` DATETIME(3) NULL,
    `lastFetchedAt` DATETIME(3) NULL,
    `lastSuccessAt` DATETIME(3) NULL,
    `lastError` VARCHAR(500) NULL,
    `failureCount` INTEGER NOT NULL DEFAULT 0,
    `nextFetchAt` DATETIME(3) NULL,
    `fetchIntervalMinutes` INTEGER NOT NULL DEFAULT 30,
    `priority` INTEGER NOT NULL DEFAULT 100,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `news_sources_slug_key`(`slug`),
    INDEX `news_sources_isActive_nextFetchAt_priority_idx`(`isActive`, `nextFetchAt`, `priority`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `news_articles` (
    `id` VARCHAR(191) NOT NULL,
    `sourceId` VARCHAR(191) NULL,
    `providerNewsId` VARCHAR(191) NULL,
    `slug` VARCHAR(191) NOT NULL,
    `originalUrl` VARCHAR(700) NOT NULL,
    `canonicalUrl` VARCHAR(700) NULL,
    `title` VARCHAR(500) NOT NULL,
    `excerpt` TEXT NULL,
    `coverImageUrl` VARCHAR(1000) NULL,
    `coverImageAlt` VARCHAR(500) NULL,
    `category` VARCHAR(80) NULL,
    `authorName` VARCHAR(160) NULL,
    `language` VARCHAR(12) NOT NULL DEFAULT 'tr',
    `publishedAt` DATETIME(3) NOT NULL,
    `sourceUpdatedAt` DATETIME(3) NULL,
    `ingestedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `status` ENUM('PENDING', 'PUBLISHED', 'ARCHIVED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
    `isExternal` BOOLEAN NOT NULL DEFAULT true,
    `isFeatured` BOOLEAN NOT NULL DEFAULT false,
    `isBreaking` BOOLEAN NOT NULL DEFAULT false,
    `isEditorPick` BOOLEAN NOT NULL DEFAULT false,
    `archivedAt` DATETIME(3) NULL,
    `titleFingerprint` VARCHAR(64) NOT NULL,
    `storyKey` VARCHAR(120) NULL,
    `readingTimeMinutes` INTEGER NOT NULL DEFAULT 1,
    `viewCount` INTEGER NOT NULL DEFAULT 0,

    UNIQUE INDEX `news_articles_slug_key`(`slug`),
    UNIQUE INDEX `news_articles_originalUrl_key`(`originalUrl`),
    INDEX `news_articles_status_publishedAt_idx`(`status`, `publishedAt`),
    INDEX `news_articles_isExternal_publishedAt_idx`(`isExternal`, `publishedAt`),
    INDEX `news_articles_storyKey_idx`(`storyKey`),
    UNIQUE INDEX `news_articles_sourceId_providerNewsId_key`(`sourceId`, `providerNewsId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `news_tags` (
    `id` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(100) NOT NULL,
    `name` VARCHAR(100) NOT NULL,

    UNIQUE INDEX `news_tags_slug_key`(`slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `news_article_tags` (
    `articleId` VARCHAR(191) NOT NULL,
    `tagId` VARCHAR(191) NOT NULL,

    INDEX `news_article_tags_tagId_idx`(`tagId`),
    PRIMARY KEY (`articleId`, `tagId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `news_article_coins` (
    `articleId` VARCHAR(191) NOT NULL,
    `symbol` VARCHAR(30) NOT NULL,
    `name` VARCHAR(100) NULL,

    INDEX `news_article_coins_symbol_idx`(`symbol`),
    PRIMARY KEY (`articleId`, `symbol`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `news_article_relations` (
    `fromArticleId` VARCHAR(191) NOT NULL,
    `toArticleId` VARCHAR(191) NOT NULL,
    `type` ENUM('RELATED', 'ACADEMY', 'VIDEO') NOT NULL,

    INDEX `news_article_relations_toArticleId_type_idx`(`toArticleId`, `type`),
    PRIMARY KEY (`fromArticleId`, `toArticleId`, `type`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `news_ai_summaries` (
    `articleId` VARCHAR(191) NOT NULL,
    `whyItMatters` TEXT NULL,
    `marketImpact` TEXT NULL,
    `watchOuts` TEXT NULL,
    `provider` VARCHAR(80) NULL,
    `model` VARCHAR(120) NULL,
    `promptVersion` VARCHAR(80) NULL,
    `inputHash` VARCHAR(64) NULL,
    `generatedAt` DATETIME(3) NULL,

    PRIMARY KEY (`articleId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `news_saved_articles` (
    `userId` VARCHAR(191) NOT NULL,
    `articleId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `news_saved_articles_articleId_idx`(`articleId`),
    PRIMARY KEY (`userId`, `articleId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `news_articles` ADD CONSTRAINT `news_articles_sourceId_fkey` FOREIGN KEY (`sourceId`) REFERENCES `news_sources`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `news_article_tags` ADD CONSTRAINT `news_article_tags_articleId_fkey` FOREIGN KEY (`articleId`) REFERENCES `news_articles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `news_article_tags` ADD CONSTRAINT `news_article_tags_tagId_fkey` FOREIGN KEY (`tagId`) REFERENCES `news_tags`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `news_article_coins` ADD CONSTRAINT `news_article_coins_articleId_fkey` FOREIGN KEY (`articleId`) REFERENCES `news_articles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `news_article_relations` ADD CONSTRAINT `news_article_relations_fromArticleId_fkey` FOREIGN KEY (`fromArticleId`) REFERENCES `news_articles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `news_article_relations` ADD CONSTRAINT `news_article_relations_toArticleId_fkey` FOREIGN KEY (`toArticleId`) REFERENCES `news_articles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `news_ai_summaries` ADD CONSTRAINT `news_ai_summaries_articleId_fkey` FOREIGN KEY (`articleId`) REFERENCES `news_articles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `news_saved_articles` ADD CONSTRAINT `news_saved_articles_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `news_saved_articles` ADD CONSTRAINT `news_saved_articles_articleId_fkey` FOREIGN KEY (`articleId`) REFERENCES `news_articles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
