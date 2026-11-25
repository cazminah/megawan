CREATE TABLE `archived_interests` (
	`season` text NOT NULL,
	`user_id` text NOT NULL,
	`game_id` integer NOT NULL,
	`level` integer NOT NULL,
	`duration_min` integer,
	`duration_max` integer,
	`archived_at` integer NOT NULL,
	PRIMARY KEY(`season`, `user_id`, `game_id`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`game_id`) REFERENCES `games`(`igdb_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `archived_game_idx` ON `archived_interests` (`game_id`);