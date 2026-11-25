import "dotenv/config";
import { defineConfig } from "drizzle-kit";

// Credentials are read from the environment — never hard-code them here.
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
});
