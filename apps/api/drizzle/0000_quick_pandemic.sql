CREATE TABLE IF NOT EXISTS "inspections" (
	"id" text PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"address_line1" text NOT NULL,
	"address_city" text NOT NULL,
	"address_state" text NOT NULL,
	"address_zip" text NOT NULL,
	"inspector_name" text,
	"inspector_license" text,
	"property" jsonb,
	"four_point" jsonb,
	"wind_mit" jsonb,
	"status" text DEFAULT 'draft' NOT NULL,
	"inspected_on" text,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "photos" (
	"id" text PRIMARY KEY NOT NULL,
	"inspection_id" text NOT NULL,
	"tag" text NOT NULL,
	"storage_key" text NOT NULL,
	"ai_analysis" jsonb,
	"captured_at" text NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "photos" ADD CONSTRAINT "photos_inspection_id_inspections_id_fk" FOREIGN KEY ("inspection_id") REFERENCES "public"."inspections"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "inspections_status_idx" ON "inspections" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "inspections_updated_at_idx" ON "inspections" USING btree ("updated_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "photos_inspection_idx" ON "photos" USING btree ("inspection_id");