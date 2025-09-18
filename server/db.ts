import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import { users, merchants, services, employees, clients, appointments, employeeDaysOff, penalties } from "../shared/schema.js";
import { eq, sql } from "drizzle-orm";
import bcrypt from "bcrypt";
import { randomUUID } from "crypto";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export const db = drizzle(pool, {
  schema: { users, merchants, services, employees, clients, appointments, employeeDaysOff, penalties }
});

export async function initializeDatabase() {
  try {
    console.log("Starting database initialization...");

    // Run migrations
    await migrate(db, { migrationsFolder: "drizzle" });

    // Create admin user if it doesn't exist
    const adminEmail = process.env.EMAIL_USER || "leolulu842@gmail.com";
    const existingAdmin = await db.select().from(users).where(eq(users.email, adminEmail)).execute();

    if (existingAdmin.length === 0) {
      const hashedPassword = await bcrypt.hash(process.env.EMAIL_PASSWORD || "123456", 10);
      await db.insert(users).values({
        id: randomUUID(),
        email: adminEmail,
        password: hashedPassword,
        role: "admin",
        createdAt: new Date(),
      }).execute();

      console.log("Admin user created successfully");
    }

    console.log("Database initialization completed successfully");
  } catch (error) {
    console.error("Database initialization failed:", error);
    throw error;
  }
}


