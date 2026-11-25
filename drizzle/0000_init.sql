CREATE TYPE "public"."admin_role" AS ENUM('owner', 'manager', 'staff');--> statement-breakpoint
CREATE TYPE "public"."order_decision" AS ENUM('pending', 'accepted', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."order_status" AS ENUM('new', 'preparing', 'ready', 'delivered', 'cancelled');--> statement-breakpoint
CREATE TABLE "admin_roles" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"role" "admin_role" DEFAULT 'staff' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "admin_roles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"actor_user_id" uuid,
	"action" text NOT NULL,
	"entity_type" text,
	"entity_id" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"ip_hash" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audit_logs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "categories_name_len" CHECK (char_length("categories"."name") between 1 and 80)
);
--> statement-breakpoint
ALTER TABLE "categories" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "order_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"product_id" uuid,
	"product_name" text NOT NULL,
	"unit_price_cents" integer NOT NULL,
	"quantity" integer NOT NULL,
	"line_total_cents" integer NOT NULL,
	CONSTRAINT "order_items_qty" CHECK ("order_items"."quantity" between 1 and 50),
	CONSTRAINT "order_items_total" CHECK ("order_items"."line_total_cents" = "order_items"."unit_price_cents" * "order_items"."quantity")
);
--> statement-breakpoint
ALTER TABLE "order_items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_number" text NOT NULL,
	"customer_name" text NOT NULL,
	"customer_phone" text NOT NULL,
	"address" text NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"location_consent" boolean DEFAULT false NOT NULL,
	"location_lat" text,
	"location_lng" text,
	"location_accuracy_m" integer,
	"status" "order_status" DEFAULT 'new' NOT NULL,
	"decision" "order_decision" DEFAULT 'pending' NOT NULL,
	"rejection_reason" text DEFAULT '' NOT NULL,
	"payment_method_id" uuid,
	"payment_method_name" text NOT NULL,
	"subtotal_cents" integer NOT NULL,
	"deposit_percent" integer NOT NULL,
	"deposit_cents" integer NOT NULL,
	"remaining_cents" integer NOT NULL,
	"ip_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "orders_amounts_valid" CHECK ("orders"."subtotal_cents" > 0 and "orders"."deposit_cents" >= 0 and "orders"."remaining_cents" >= 0 and "orders"."deposit_cents" + "orders"."remaining_cents" = "orders"."subtotal_cents"),
	CONSTRAINT "orders_deposit_percent" CHECK ("orders"."deposit_percent" between 1 and 100)
);
--> statement-breakpoint
ALTER TABLE "orders" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "payment_methods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"account_name" text DEFAULT '' NOT NULL,
	"account_number" text DEFAULT '' NOT NULL,
	"instructions" text DEFAULT '' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "payment_methods" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "payment_receipts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"storage_bucket" text NOT NULL,
	"storage_path" text NOT NULL,
	"mime_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"sha256" text NOT NULL,
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payment_receipts_size" CHECK ("payment_receipts"."size_bytes" between 1 and 10485760)
);
--> statement-breakpoint
ALTER TABLE "payment_receipts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category_id" uuid,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"price_cents" integer NOT NULL,
	"image_url" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_demo" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "products_price_range" CHECK ("products"."price_cents" between 0 and 10000000),
	CONSTRAINT "products_name_len" CHECK (char_length("products"."name") between 1 and 120)
);
--> statement-breakpoint
ALTER TABLE "products" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "rate_limits" (
	"key" text PRIMARY KEY NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"reset_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "rate_limits" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"mfa_verified" boolean DEFAULT false NOT NULL,
	"ip_hash" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"absolute_expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sessions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "site_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "site_settings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "stored_files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bucket" text NOT NULL,
	"path" text NOT NULL,
	"mime_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"data" "bytea" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "stored_files" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"display_name" text DEFAULT '' NOT NULL,
	"password_hash" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"mfa_enabled" boolean DEFAULT false NOT NULL,
	"mfa_secret_enc" text,
	"mfa_pending_secret_enc" text,
	"mfa_last_step" integer DEFAULT 0 NOT NULL,
	"failed_login_count" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_len" CHECK (char_length("users"."email") between 3 and 254)
);
--> statement-breakpoint
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "admin_roles" ADD CONSTRAINT "admin_roles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_payment_method_id_payment_methods_id_fk" FOREIGN KEY ("payment_method_id") REFERENCES "public"."payment_methods"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_receipts" ADD CONSTRAINT "payment_receipts_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "admin_roles_role_idx" ON "admin_roles" USING btree ("role");--> statement-breakpoint
CREATE INDEX "audit_logs_created_idx" ON "audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "audit_logs_action_idx" ON "audit_logs" USING btree ("action","created_at");--> statement-breakpoint
CREATE INDEX "audit_logs_actor_idx" ON "audit_logs" USING btree ("actor_user_id");--> statement-breakpoint
CREATE INDEX "categories_sort_idx" ON "categories" USING btree ("sort_order");--> statement-breakpoint
CREATE INDEX "order_items_order_idx" ON "order_items" USING btree ("order_id");--> statement-breakpoint
CREATE UNIQUE INDEX "orders_number_unique" ON "orders" USING btree ("order_number");--> statement-breakpoint
CREATE INDEX "orders_created_idx" ON "orders" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "orders_status_idx" ON "orders" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "orders_phone_idx" ON "orders" USING btree ("customer_phone");--> statement-breakpoint
CREATE INDEX "payment_methods_active_idx" ON "payment_methods" USING btree ("is_active","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_receipts_order_unique" ON "payment_receipts" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "products_category_idx" ON "products" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "products_active_sort_idx" ON "products" USING btree ("is_active","sort_order");--> statement-breakpoint
CREATE INDEX "rate_limits_reset_idx" ON "rate_limits" USING btree ("reset_at");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_expires_idx" ON "sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "stored_files_bucket_path_unique" ON "stored_files" USING btree ("bucket","path");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_unique" ON "users" USING btree (lower("email"));