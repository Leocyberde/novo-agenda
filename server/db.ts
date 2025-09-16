import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { users, merchants, services, employees, clients, appointments, employeeDaysOff, penalties } from "../shared/schema.js";
import { eq, sql } from "drizzle-orm";
import bcrypt from "bcrypt";
import { randomUUID } from "crypto";

// Initialize SQLite database
const sqlite = new Database("beauty_scheduler.db");
export const db = drizzle(sqlite, {
  schema: { users, merchants, services, employees, clients, appointments, employeeDaysOff, penalties }
});

// Initialize database with admin user
export async function initializeDatabase() {
  try {
    console.log("Starting database initialization...");

    // Create tables manually using raw SQL to ensure they exist
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'merchant',
        created_at INTEGER NOT NULL DEFAULT (unixepoch())
      );
    `);

    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS merchants (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        owner_name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL,
        phone TEXT NOT NULL,
        address TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        logo_url TEXT,
        is_open INTEGER NOT NULL DEFAULT 1,
        work_days TEXT NOT NULL DEFAULT '[0,1,2,3,4,5,6]',
        start_time TEXT NOT NULL DEFAULT '09:00',
        end_time TEXT NOT NULL DEFAULT '18:00',
        break_start_time TEXT DEFAULT '12:00',
        break_end_time TEXT DEFAULT '13:00',
        no_show_fee_enabled INTEGER NOT NULL DEFAULT 0,
        no_show_fee_amount INTEGER DEFAULT 0,
        late_fee_enabled INTEGER NOT NULL DEFAULT 0,
        late_fee_amount INTEGER DEFAULT 0,
        late_tolerance_minutes INTEGER DEFAULT 15,
        cancellation_policy_hours INTEGER DEFAULT 24,
        cancellation_fee_enabled INTEGER NOT NULL DEFAULT 0,
        cancellation_fee_amount INTEGER DEFAULT 0,
        created_at INTEGER NOT NULL DEFAULT (unixepoch()),
        updated_at INTEGER NOT NULL DEFAULT (unixepoch())
      );
    `);

    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS services (
        id TEXT PRIMARY KEY,
        merchant_id TEXT NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        description TEXT,
        price INTEGER NOT NULL,
        duration INTEGER NOT NULL,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at INTEGER NOT NULL DEFAULT (unixepoch()),
        updated_at INTEGER NOT NULL DEFAULT (unixepoch())
      );
    `);

    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS employees (
        id TEXT PRIMARY KEY,
        merchant_id TEXT NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL,
        phone TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'employee',
        specialties TEXT,
        work_days TEXT NOT NULL DEFAULT '[0,1,2,3,4,5,6]',
        start_time TEXT NOT NULL DEFAULT '09:00',
        end_time TEXT NOT NULL DEFAULT '18:00',
        break_start_time TEXT,
        break_end_time TEXT,
        is_active INTEGER NOT NULL DEFAULT 1,
        payment_type TEXT NOT NULL DEFAULT 'monthly',
        payment_value INTEGER NOT NULL DEFAULT 0,
        extended_end_time TEXT,
        overtime_hours INTEGER DEFAULT 0,
        last_overtime_date TEXT,
        created_at INTEGER NOT NULL DEFAULT (unixepoch()),
        updated_at INTEGER NOT NULL DEFAULT (unixepoch())
      );
    `);

    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS clients (
        id TEXT PRIMARY KEY,
        merchant_id TEXT NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL,
        phone TEXT NOT NULL,
        notes TEXT,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at INTEGER NOT NULL DEFAULT (unixepoch()),
        updated_at INTEGER NOT NULL DEFAULT (unixepoch())
      );
    `);

    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS appointments (
        id TEXT PRIMARY KEY,
        merchant_id TEXT NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
        service_id TEXT NOT NULL REFERENCES services(id) ON DELETE CASCADE,
        client_id TEXT REFERENCES clients(id),
        employee_id TEXT REFERENCES employees(id),
        client_name TEXT NOT NULL,
        client_phone TEXT NOT NULL,
        client_email TEXT,
        appointment_date TEXT NOT NULL,
        appointment_time TEXT NOT NULL,
        end_time TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        notes TEXT,
        reschedule_reason TEXT,
        cancel_reason TEXT,
        cancel_policy TEXT NOT NULL DEFAULT '24h',
        reminder_sent INTEGER NOT NULL DEFAULT 0,
        arrival_time TEXT,
        completed_at INTEGER,
        new_date TEXT,
        new_time TEXT,
        actual_start_time TEXT,
        actual_end_time TEXT,
        created_at INTEGER NOT NULL DEFAULT (unixepoch()),
        updated_at INTEGER NOT NULL DEFAULT (unixepoch())
      );
    `);

    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS employee_days_off (
        id TEXT PRIMARY KEY,
        merchant_id TEXT NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
        employee_id TEXT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
        date TEXT NOT NULL,
        reason TEXT,
        created_at INTEGER NOT NULL DEFAULT (unixepoch())
      );
    `);

    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS penalties (
        id TEXT PRIMARY KEY,
        merchant_id TEXT NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
        client_id TEXT REFERENCES clients(id),
        appointment_id TEXT REFERENCES appointments(id),
        client_name TEXT NOT NULL,
        client_phone TEXT NOT NULL,
        client_email TEXT,
        type TEXT NOT NULL,
        amount INTEGER NOT NULL,
        reason TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        paid_at INTEGER,
        paid_by TEXT,
        created_at INTEGER NOT NULL DEFAULT (unixepoch()),
        updated_at INTEGER NOT NULL DEFAULT (unixepoch())
      );
    `);

    // Check if tables exist
    const tables = db.select({ name: sql<string>`name` })
      .from(sql`sqlite_master`)
      .where(sql`type = 'table' AND name NOT LIKE 'sqlite_%'`)
      .all();

    console.log("Created tables:", tables.map(t => t.name));

    // Create admin user if it doesn't exist
    const adminEmail = "leolulu842@gmail.com";
    const existingAdmin = db.select().from(users).where(eq(users.email, adminEmail)).get();

    if (!existingAdmin) {
      const hashedPassword = await bcrypt.hash("123456", 10);
      db.insert(users).values({
        id: randomUUID(),
        email: adminEmail,
        password: hashedPassword,
        role: "admin",
        createdAt: new Date(),
      }).run();

      console.log("Admin user created successfully");
    }

    // Admin merchant creation moved to after column migration

    console.log("Database initialization completed successfully");
  } catch (error) {
    console.error("Database initialization failed:", error);
    throw error;
  }
}