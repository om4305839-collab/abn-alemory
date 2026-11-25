#!/usr/bin/env node
/**
 * Secure admin bootstrap — the ONLY way to create admin accounts (there is no public sign-up).
 *
 *   node scripts/create-admin.mjs --email owner@example.com [--name "الاسم"] [--role owner|manager|staff]
 *   node scripts/create-admin.mjs --email owner@example.com --reset-password
 *   add --must-change to force the user to choose a new password at first login (temporary credentials)
 *   node scripts/create-admin.mjs --email owner@example.com --reset-mfa
 *
 * The password is typed interactively (hidden) and never stored in shell history or in the repo.
 * For automation only you may pass ADMIN_PASSWORD as a one-off environment variable.
 * Password hashing: Argon2id.
 */
import "dotenv/config";
import readline from "node:readline";
import pg from "pg";
import { hash } from "@node-rs/argon2";

const args = process.argv.slice(2);
const getArg = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const has = (name) => args.includes(`--${name}`);

const email = (getArg("email") ?? "").trim().toLowerCase();
const role = getArg("role") ?? "owner";
const displayName = getArg("name") ?? "";
const mustChange = has("must-change");

if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || email.length > 254) fail("Provide a valid --email");
if (!["owner", "manager", "staff"].includes(role)) fail("--role must be owner, manager or staff");
if (!process.env.DATABASE_URL) fail("DATABASE_URL is not set");

function fail(msg) {
  console.error(`✖ ${msg}`);
  process.exit(1);
}

function ask(question, hidden = false) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    if (hidden) {
      rl._writeToOutput = (s) => process.stdout.write(s.includes(question) ? s : "*");
    }
    rl.question(question, (answer) => {
      rl.close();
      if (hidden) process.stdout.write("\n");
      resolve(answer);
    });
  });
}

function checkPasswordPolicy(pw) {
  if (pw.length < 14) return "Password must be at least 14 characters";
  if (pw.length > 256) return "Password too long";
  const lower = pw.toLowerCase();
  if (["password", "12345678", "qwerty", "admin", "koshary", "kushari"].some((w) => lower.includes(w)))
    return "Password contains a very common word/sequence";
  if (lower.includes(email.split("@")[0])) return "Password must not contain the e-mail name";
  const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((r) => r.test(pw)).length;
  if (classes < 3) return "Use at least 3 of: lowercase, uppercase, digits, symbols (or a long passphrase)";
  return null;
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1 });

try {
  const { rows } = await pool.query("select id from users where lower(email) = $1", [email]);
  const existing = rows[0];

  if (has("reset-mfa")) {
    if (!existing) fail("User not found");
    await pool.query(
      "update users set mfa_enabled=false, mfa_secret_enc=null, mfa_pending_secret_enc=null, mfa_last_step=0, updated_at=now() where id=$1",
      [existing.id],
    );
    await pool.query("delete from sessions where user_id=$1", [existing.id]);
    await pool.query("insert into audit_logs (actor_user_id, action, entity_type, entity_id, metadata) values (null,'admin.cli_reset_mfa','user',$1,'{}')", [existing.id]);
    console.log("✔ MFA reset. The user must enroll a new authenticator on next login.");
    process.exit(0);
  }

  if (existing && !has("reset-password")) fail("User already exists. Use --reset-password to change the password.");
  if (!existing && has("reset-password")) fail("User not found");

  let password = process.env.ADMIN_PASSWORD;
  if (!password) {
    password = await ask("Password (hidden): ", true);
    const again = await ask("Repeat password: ", true);
    if (password !== again) fail("Passwords do not match");
  }
  const problem = checkPasswordPolicy(password);
  if (problem) fail(problem);

  const passwordHash = await hash(password, { memoryCost: 19456, timeCost: 2, parallelism: 1 });

  if (existing) {
    await pool.query(
      "update users set password_hash=$1, must_change_password=$3, failed_login_count=0, locked_until=null, updated_at=now() where id=$2",
      [passwordHash, existing.id, mustChange],
    );
    await pool.query("delete from sessions where user_id=$1", [existing.id]);
    await pool.query("insert into audit_logs (action, entity_type, entity_id, metadata) values ('admin.cli_reset_password','user',$1,'{}')", [existing.id]);
    console.log(`✔ Password updated for ${email}; all sessions revoked.`);
  } else {
    const client = await pool.connect();
    try {
      await client.query("begin");
      const ins = await client.query(
        "insert into users (email, display_name, password_hash, must_change_password) values ($1,$2,$3,$4) returning id",
        [email, displayName.slice(0, 80), passwordHash, mustChange],
      );
      await client.query("insert into admin_roles (user_id, role) values ($1,$2)", [ins.rows[0].id, role]);
      await client.query("insert into audit_logs (action, entity_type, entity_id, metadata) values ('admin.cli_create','user',$1,$2)", [ins.rows[0].id, JSON.stringify({ role })]);
      await client.query("commit");
    } catch (e) {
      await client.query("rollback");
      throw e;
    } finally {
      client.release();
    }
    console.log(`✔ Admin created: ${email} (${role}). Log in at /admin/login — you will be asked to enroll MFA.`);
  }
} catch (e) {
  console.error("✖ Failed:", e instanceof Error ? e.message : e);
  process.exitCode = 1;
} finally {
  await pool.end();
}
