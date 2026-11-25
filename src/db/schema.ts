import { sql } from "drizzle-orm";
import {
  bigserial,
  boolean,
  check,
  customType,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * Security model
 * ──────────────
 * All access goes through the Next.js server using a single server-side DB role.
 * Row Level Security is ENABLED on every table with NO policies, so if the database
 * is Supabase, the public `anon` / `authenticated` roles (PostgREST) can read or
 * write nothing. Customers and admins are separated in application code (RBAC).
 * Money is stored as integer piastres (cents) to avoid floating point errors.
 */

const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType() {
    return "bytea";
  },
});

export const adminRoleEnum = pgEnum("admin_role", ["owner", "manager", "staff"]);
export const orderStatusEnum = pgEnum("order_status", [
  "new",
  "preparing",
  "ready",
  "delivered",
  "cancelled",
]);
export const orderDecisionEnum = pgEnum("order_decision", ["pending", "accepted", "rejected"]);

// ───────────────────────────── users / roles / sessions
export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    displayName: text("display_name").notNull().default(""),
    passwordHash: text("password_hash").notNull(), // Argon2id
    isActive: boolean("is_active").notNull().default(true),
    mustChangePassword: boolean("must_change_password").notNull().default(false),
    mfaEnabled: boolean("mfa_enabled").notNull().default(false),
    mfaSecretEnc: text("mfa_secret_enc"), // AES-256-GCM encrypted TOTP secret
    mfaPendingSecretEnc: text("mfa_pending_secret_enc"),
    mfaLastStep: integer("mfa_last_step").notNull().default(0), // TOTP replay protection
    failedLoginCount: integer("failed_login_count").notNull().default(0),
    lockedUntil: timestamp("locked_until", { withTimezone: true }),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("users_email_unique").on(sql`lower(${t.email})`),
    check("users_email_len", sql`char_length(${t.email}) between 3 and 254`),
  ],
).enableRLS();

export const adminRoles = pgTable(
  "admin_roles",
  {
    userId: uuid("user_id")
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),
    role: adminRoleEnum("role").notNull().default("staff"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("admin_roles_role_idx").on(t.role)],
).enableRLS();

export const sessions = pgTable(
  "sessions",
  {
    // SHA-256 of the random session token (the raw token only lives in the cookie)
    id: text("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    mfaVerified: boolean("mfa_verified").notNull().default(false),
    ipHash: text("ip_hash"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    absoluteExpiresAt: timestamp("absolute_expires_at", { withTimezone: true }).notNull(),
  },
  (t) => [
    index("sessions_user_idx").on(t.userId),
    index("sessions_expires_idx").on(t.expiresAt),
  ],
).enableRLS();

// ───────────────────────────── catalogue
export const categories = pgTable(
  "categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("categories_sort_idx").on(t.sortOrder),
    check("categories_name_len", sql`char_length(${t.name}) between 1 and 80`),
  ],
).enableRLS();

export const products = pgTable(
  "products",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    categoryId: uuid("category_id").references(() => categories.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    priceCents: integer("price_cents").notNull(),
    imageUrl: text("image_url"),
    isActive: boolean("is_active").notNull().default(true),
    isDemo: boolean("is_demo").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("products_category_idx").on(t.categoryId),
    index("products_active_sort_idx").on(t.isActive, t.sortOrder),
    check("products_price_range", sql`${t.priceCents} between 0 and 10000000`),
    check("products_name_len", sql`char_length(${t.name}) between 1 and 120`),
  ],
).enableRLS();

// ───────────────────────────── payments
export const paymentMethods = pgTable(
  "payment_methods",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    accountName: text("account_name").notNull().default(""),
    accountNumber: text("account_number").notNull().default(""),
    instructions: text("instructions").notNull().default(""),
    isActive: boolean("is_active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("payment_methods_active_idx").on(t.isActive, t.sortOrder)],
).enableRLS();

// ───────────────────────────── orders
export const orders = pgTable(
  "orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderNumber: text("order_number").notNull(),
    customerName: text("customer_name").notNull(),
    customerPhone: text("customer_phone").notNull(),
    address: text("address").notNull(),
    notes: text("notes").notNull().default(""),
    locationConsent: boolean("location_consent").notNull().default(false),
    locationLat: text("location_lat"),
    locationLng: text("location_lng"),
    locationAccuracyM: integer("location_accuracy_m"),
    status: orderStatusEnum("status").notNull().default("new"),
    decision: orderDecisionEnum("decision").notNull().default("pending"),
    rejectionReason: text("rejection_reason").notNull().default(""),
    paymentMethodId: uuid("payment_method_id").references(() => paymentMethods.id, {
      onDelete: "set null",
    }),
    paymentMethodName: text("payment_method_name").notNull(),
    subtotalCents: integer("subtotal_cents").notNull(),
    depositPercent: integer("deposit_percent").notNull(),
    depositCents: integer("deposit_cents").notNull(),
    remainingCents: integer("remaining_cents").notNull(),
    ipHash: text("ip_hash"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("orders_number_unique").on(t.orderNumber),
    index("orders_created_idx").on(t.createdAt),
    index("orders_status_idx").on(t.status, t.createdAt),
    index("orders_phone_idx").on(t.customerPhone),
    check("orders_amounts_valid", sql`${t.subtotalCents} > 0 and ${t.depositCents} >= 0 and ${t.remainingCents} >= 0 and ${t.depositCents} + ${t.remainingCents} = ${t.subtotalCents}`),
    check("orders_deposit_percent", sql`${t.depositPercent} between 1 and 100`),
  ],
).enableRLS();

export const orderItems = pgTable(
  "order_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    productId: uuid("product_id").references(() => products.id, { onDelete: "set null" }),
    productName: text("product_name").notNull(),
    unitPriceCents: integer("unit_price_cents").notNull(),
    quantity: integer("quantity").notNull(),
    lineTotalCents: integer("line_total_cents").notNull(),
  },
  (t) => [
    index("order_items_order_idx").on(t.orderId),
    check("order_items_qty", sql`${t.quantity} between 1 and 50`),
    check("order_items_total", sql`${t.lineTotalCents} = ${t.unitPriceCents} * ${t.quantity}`),
  ],
).enableRLS();

export const paymentReceipts = pgTable(
  "payment_receipts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    storageBucket: text("storage_bucket").notNull(),
    storagePath: text("storage_path").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    sha256: text("sha256").notNull(),
    uploadedAt: timestamp("uploaded_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("payment_receipts_order_unique").on(t.orderId),
    check("payment_receipts_size", sql`${t.sizeBytes} between 1 and 10485760`),
  ],
).enableRLS();

// ───────────────────────────── settings / audit / infra
export const siteSettings = pgTable("site_settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}).enableRLS();

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    actorUserId: uuid("actor_user_id").references(() => users.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    entityType: text("entity_type"),
    entityId: text("entity_id"),
    metadata: jsonb("metadata").notNull().default({}),
    ipHash: text("ip_hash"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("audit_logs_created_idx").on(t.createdAt),
    index("audit_logs_action_idx").on(t.action, t.createdAt),
    index("audit_logs_actor_idx").on(t.actorUserId),
  ],
).enableRLS();

export const rateLimits = pgTable(
  "rate_limits",
  {
    key: text("key").primaryKey(),
    count: integer("count").notNull().default(0),
    resetAt: timestamp("reset_at", { withTimezone: true }).notNull(),
  },
  (t) => [index("rate_limits_reset_idx").on(t.resetAt)],
).enableRLS();

// Private file store used when Supabase Storage is not configured (never exposed publicly,
// receipts are only readable through short-lived signed URLs + an admin session).
export const storedFiles = pgTable(
  "stored_files",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bucket: text("bucket").notNull(),
    path: text("path").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    data: bytea("data").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("stored_files_bucket_path_unique").on(t.bucket, t.path)],
).enableRLS();

export type User = typeof users.$inferSelect;
export type Product = typeof products.$inferSelect;
export type Category = typeof categories.$inferSelect;
export type PaymentMethod = typeof paymentMethods.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type AdminRole = (typeof adminRoleEnum.enumValues)[number];
export type OrderStatus = (typeof orderStatusEnum.enumValues)[number];
