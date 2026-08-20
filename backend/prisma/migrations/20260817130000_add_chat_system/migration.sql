CREATE TABLE `chat_rooms` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `slug` VARCHAR(100) NOT NULL,
  `name` VARCHAR(100) NOT NULL,
  `category` VARCHAR(50) NOT NULL,
  `icon` VARCHAR(50) NULL,
  `display_order` INTEGER NOT NULL DEFAULT 0,
  `status` ENUM('active', 'closed', 'hidden') NOT NULL DEFAULT 'active',
  `message_count` INTEGER NOT NULL DEFAULT 0,
  `created_by` VARCHAR(191) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `chat_rooms_slug_key`(`slug`),
  INDEX `chat_rooms_category_display_order_idx`(`category`, `display_order`),
  INDEX `chat_rooms_created_by_idx`(`created_by`),
  PRIMARY KEY (`id`),
  CONSTRAINT `chat_rooms_created_by_fkey` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `chat_messages` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `room_id` INTEGER NOT NULL,
  `user_id` VARCHAR(191) NOT NULL,
  `content` TEXT NOT NULL,
  `metadata` JSON NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `idx_room_created`(`room_id`, `created_at`),
  INDEX `chat_messages_user_id_created_at_idx`(`user_id`, `created_at`),
  PRIMARY KEY (`id`),
  CONSTRAINT `chat_messages_room_id_fkey` FOREIGN KEY (`room_id`) REFERENCES `chat_rooms`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `chat_messages_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `chat_message_reactions` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `message_id` BIGINT UNSIGNED NOT NULL,
  `user_id` VARCHAR(191) NOT NULL,
  `reaction_type` VARCHAR(30) NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `unique_reaction`(`message_id`, `user_id`, `reaction_type`),
  INDEX `chat_message_reactions_user_id_idx`(`user_id`),
  PRIMARY KEY (`id`),
  CONSTRAINT `chat_message_reactions_message_id_fkey` FOREIGN KEY (`message_id`) REFERENCES `chat_messages`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `chat_message_reactions_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT INTO `chat_rooms` (`slug`, `name`, `category`, `icon`, `display_order`) VALUES
  ('global-stream', 'Global Stream', 'Piyasalar', 'globe', 10),
  ('bitcoin', 'Bitcoin', 'Piyasalar', 'bitcoin', 20),
  ('ethereum', 'Ethereum', 'Piyasalar', 'ethereum', 30),
  ('altcoin', 'Altcoin', 'Piyasalar', 'coins', 40),
  ('defi', 'DeFi', 'Piyasalar', 'landmark', 50),
  ('solidity', 'Solidity', 'Teknik', 'code', 10),
  ('smart-contract-security', 'Smart Contract Security', 'Teknik', 'shield', 20),
  ('layer-2', 'Layer-2', 'Teknik', 'layers', 30),
  ('developer-hub', 'Developer Hub', 'Teknik', 'terminal', 40),
  ('yeni-baslayanlar', 'Yeni Başlayanlar', 'Akademi', 'graduation-cap', 10),
  ('web3-kariyer', 'Web3 Kariyer', 'Akademi', 'briefcase', 20),
  ('egitim-sorulari', 'Eğitim Soruları', 'Akademi', 'circle-help', 30),
  ('proje-tanitimi', 'Proje Tanıtımı', 'Topluluk', 'rocket', 10),
  ('airdrop', 'Airdrop', 'Topluluk', 'gift', 20),
  ('guvenlik-uyarilari', 'Güvenlik Uyarıları', 'Topluluk', 'shield-alert', 30);
