CREATE TABLE `inspections` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`address_line1` text NOT NULL,
	`address_city` text NOT NULL,
	`address_state` text NOT NULL,
	`address_zip` text NOT NULL,
	`inspector_name` text,
	`inspector_license` text,
	`property` text,
	`four_point` text,
	`wind_mit` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`inspected_on` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `inspections_status_idx` ON `inspections` (`status`);--> statement-breakpoint
CREATE INDEX `inspections_updated_at_idx` ON `inspections` (`updated_at`);--> statement-breakpoint
CREATE TABLE `photos` (
	`id` text PRIMARY KEY NOT NULL,
	`inspection_id` text NOT NULL,
	`tag` text NOT NULL,
	`storage_key` text NOT NULL,
	`ai_analysis` text,
	`captured_at` text NOT NULL,
	FOREIGN KEY (`inspection_id`) REFERENCES `inspections`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `photos_inspection_idx` ON `photos` (`inspection_id`);