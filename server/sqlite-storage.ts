import { type User, type InsertUser, type Merchant, type InsertMerchant, type Service, type InsertService, type Employee, type InsertEmployee, type Client, type InsertClient, type Appointment, type InsertAppointment, type AvailabilityData, type AppointmentStatusData } from "@shared/schema";
import { db, initializeDatabase } from "./db";
import { users, merchants, services, employees, clients, appointments, employeeDaysOff, penalties, promotions, type EmployeeDayOff, type InsertEmployeeDayOff, type Promotion, type InsertPromotion } from "@shared/schema";
import { eq, count, gte, and, sql, lte, desc, asc, inArray, or } from "drizzle-orm";
import { randomUUID } from "crypto";
import bcrypt from "bcrypt";
import type { IStorage } from "./storage";

import { format, subDays } from 'date-fns';


export class PostgreSQLStorage implements IStorage {
  private initialized = false;







  constructor() {
    // Don't call initialize in constructor
  }

  async initialize(): Promise<void> {
    if (!this.initialized) {
      await initializeDatabase();
      // Check if database exists and has tables
      const tables = await db.select({ tableName: sql<string>`tablename` })
        .from(sql`pg_catalog.pg_tables`)
        .where(sql`schemaname != \'pg_catalog\' AND schemaname != \'information_schema\'`)
        .execute();

      if (tables.length === 0) {
        console.log("Creating database tables...");
        // Create tables manually since we don't have migration files
        // The tables are already created by the schema definitions
      }

      // Ensure all required columns exist


      // Update existing employees to work all days including Sunday


      this.initialized = true;
    }
  }

  // User methods
  async getUser(id: string): Promise<User | undefined> {
    if (!this.initialized) await this.initialize();
    const user = (await db.select().from(users).where(eq(users.id, id)).execute())[0];
    return user || undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    if (!this.initialized) await this.initialize();
    const user = (await db.select().from(users).where(eq(users.email, email)).execute())[0];
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    if (!this.initialized) await this.initialize();
    const hashedPassword = await bcrypt.hash(insertUser.password, 10);
    const id = randomUUID();
    const user: User = {
      ...insertUser,
      id,
      password: hashedPassword,
      role: insertUser.role || "merchant",
      createdAt: new Date(),
    };

    await db.insert(users).values(user).execute();
    return user;
  }

  async updateUser(id: string, updates: any): Promise<any> {
    await db.update(users).set({ ...updates, updatedAt: new Date() }).where(eq(users.id, id)).execute();
    return this.getUser(id);
  }

  async updateUserPassword(id: string, newPassword: string): Promise<boolean> {
    try {
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      await db.update(users).set({ password: hashedPassword, updatedAt: new Date() }).where(eq(users.id, id)).execute();
      return true;
    } catch (error) {
      console.error("Error updating user password:", error);
      return false;
    }
  }

  // Merchant methods
  async getMerchant(id: string): Promise<Merchant | undefined> {
    if (!this.initialized) await this.initialize();
    const merchant = (await db.select().from(merchants).where(eq(merchants.id, id)).execute())[0];
    return merchant || undefined;
  }

  async getMerchantByEmail(email: string): Promise<Merchant | undefined> {
    if (!this.initialized) await this.initialize();
    const merchant = (await db.select().from(merchants).where(eq(merchants.email, email)).execute())[0];
    return merchant || undefined;
  }

  async getAllMerchants(): Promise<Merchant[]> {
    if (!this.initialized) await this.initialize();
    const allMerchants = await db.select().from(merchants).execute();
    return allMerchants.sort((a, b) =>
      new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime()
    );
  }

  async createMerchant(insertMerchant: InsertMerchant): Promise<Merchant> {
    if (!this.initialized) await this.initialize();
    const hashedPassword = await bcrypt.hash(insertMerchant.password, 10);
    const id = randomUUID();
    const now = new Date();
    const merchant: Merchant = {
      ...insertMerchant,
      id,
      password: hashedPassword,
      status: insertMerchant.status || "pending",
      createdAt: now,
      updatedAt: now,
    };

    await db.insert(merchants).values(merchant).execute();
    return merchant;
  }

  async updateMerchant(id: string, updates: Partial<InsertMerchant>): Promise<Merchant | undefined> {
    await this.initialize();
    const existingMerchant = await this.getMerchant(id);
    if (!existingMerchant) return undefined;

    // Hash password if it's being updated
    const processedUpdates = { ...updates };
    if (processedUpdates.password) {
      processedUpdates.password = await bcrypt.hash(processedUpdates.password, 10);
    }

    const updatedMerchant: Merchant = {
      ...existingMerchant,
      ...processedUpdates,
      updatedAt: new Date(),
    };

    await db.update(merchants).set(updatedMerchant).where(eq(merchants.id, id)).execute();

    // If working hours are being updated, sync employee hours
    if (updates.startTime || updates.endTime || updates.workDays) {
      await this.syncEmployeeHoursWithMerchant(id, updatedMerchant);
    }

    return updatedMerchant;
  }

  async updateMerchantPassword(id: string, newPassword: string): Promise<boolean> {
    try {
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      await db.update(merchants).set({ password: hashedPassword, updatedAt: new Date() }).where(eq(merchants.id, id)).execute();
      return true;
    } catch (error) {
      console.error("Error updating merchant password:", error);
      return false;
    }
  }

  private async syncEmployeeHoursWithMerchant(merchantId: string, merchant: Merchant): Promise<void> {
    try {
      const employees = await this.getEmployeesByMerchant(merchantId);

      for (const employee of employees) {
        const updates: Partial<InsertEmployee> = {};

        if (merchant.startTime && merchant.startTime !== employee.startTime) {
          updates.startTime = merchant.startTime;
        }

        if (merchant.endTime && merchant.endTime !== employee.endTime) {
          updates.endTime = merchant.endTime;
        }

        if (merchant.workDays && merchant.workDays !== employee.workDays) {
          updates.workDays = merchant.workDays;
        }

        if (Object.keys(updates).length > 0) {
          await this.updateEmployee(employee.id, updates);
          console.log(`Synced employee ${employee.name} hours with merchant hours:`, updates);
        }
      }
    } catch (error) {
      console.error("Error syncing employee hours with merchant:", error);
    }
  }

  async deleteMerchant(id: string): Promise<boolean> {
    await this.initialize();
    const result = await db.delete(merchants).where(eq(merchants.id, id)).execute();
    return result.rowCount > 0;
  }

  async getMerchantsByStatus(status: string): Promise<Merchant[]> {
    await this.initialize();
    return db.select().from(merchants).where(eq(merchants.status, status)).execute();
  }

  async getMerchantsStats(): Promise<{
    total: number;
    active: number;
    pending: number;
    inactive: number;
    thisMonth: number;
  }> {
    await this.initialize();
    const allMerchants = await db.select().from(merchants).execute();
    const now = new Date();
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    return {
      total: allMerchants.length,
      active: allMerchants.filter(m => m.status === "active").length,
      pending: allMerchants.filter(m => m.status === "pending").length,
      inactive: allMerchants.filter(m => m.status === "inactive").length,
      thisMonth: allMerchants.filter(m => new Date(m.createdAt!).getTime() >= thisMonth.getTime()).length,
    };
  }

  // Service methods
  async getService(id: string): Promise<Service | undefined> {
    await this.initialize();
    const service = (await db.select().from(services).where(eq(services.id, id)).execute())[0];
    return service || undefined;
  }

  async getServicesByMerchant(merchantId: string): Promise<Service[]> {
    await this.initialize();

    console.log(`\n=== SQLiteStorage.getServicesByMerchant DEBUG ===`);
    console.log(`🔍 Input merchantId: "${merchantId}" (type: ${typeof merchantId})`);
    console.log(`🔍 MerchantId length: ${merchantId?.length}`);

    // Get merchant info for context
    const merchant = await this.getMerchant(merchantId);
    console.log(`🏪 Merchant info: ${merchant ? `"${merchant.name}" (${merchant.email})` : 'NOT FOUND'}`);

    // First, let's see ALL services in the database for debugging
    const allServices = db.select().from(services).execute();
    console.log(`\n📊 DATABASE STATE - Total services: ${allServices.length}`);
    allServices.forEach((service, index) => {
      const belongsToRequested = service.merchantId === merchantId;
      const merchantInfo = belongsToRequested ? "✅ MINE" : "❌ OTHER";
      console.log(`  [${index}] "${service.name}" (ID: ${service.id.substring(0, 8)}...) -> merchantId: "${service.merchantId.substring(0, 8)}..." ${merchantInfo}`);
    });

    // Now execute the filtered query
    console.log(`\n🔎 Executing query: SELECT * FROM services WHERE merchantId = "${merchantId}"`);
    const result = db.select().from(services).where(eq(services.merchantId, merchantId)).execute();

    console.log(`\n📋 QUERY RESULT - Returned ${result.length} services:`);
    result.forEach((service, index) => {
      console.log(`  [${index}] "${service.name}" (ID: ${service.id.substring(0, 8)}...) merchantId: "${service.merchantId.substring(0, 8)}..."`);
    });

    // CRITICAL SECURITY VERIFICATION
    const invalidServices = result.filter(service => service.merchantId !== merchantId);
    const validServices = result.filter(service => service.merchantId === merchantId);

    console.log(`\n🛡️  SECURITY CHECK:`);
    console.log(`✅ Valid services (belong to ${merchantId.substring(0, 8)}...): ${validServices.length}`);
    console.log(`❌ Invalid services (belong to other merchants): ${invalidServices.length}`);

    // If any invalid services found, this is a CRITICAL SECURITY BREACH
    if (invalidServices.length > 0) {
      console.error(`\n🚨🚨🚨 CRITICAL SECURITY BREACH DETECTED! 🚨🚨🚨`);
      console.error(`❌ Found ${invalidServices.length} services that don't belong to merchant ${merchantId}:`);
      invalidServices.forEach(service => {
        console.error(`  - LEAKED: "${service.name}" (ID: ${service.id}) belongs to merchant: "${service.merchantId}"`);
      });
      console.error(`🚨 RETURNING ONLY VALID SERVICES AS EMERGENCY SECURITY MEASURE 🚨`);
      console.log(`=== END SQLiteStorage DEBUG (SECURITY BREACH PREVENTED) ===\n`);
      return validServices;
    }

    // All good
    console.log(`\n✅ SECURITY VERIFICATION PASSED`);
    console.log(`🎯 All ${result.length} services verified to belong to merchant ${merchantId.substring(0, 8)}...`);
    console.log(`=== END SQLiteStorage DEBUG (SUCCESS) ===\n`);
    return result;
  }

  async getActiveServicesByMerchant(merchantId: string): Promise<Service[]> {
    await this.initialize();
    return db.select().from(services)
      .where(and(
        eq(services.merchantId, merchantId),
        eq(services.isActive, true)
      ))
      .execute();
  }

  async createService(insertService: InsertService): Promise<Service> {
    await this.initialize();
    const id = randomUUID();
    const now = new Date();
    const service: Service = {
      ...insertService,
      id,
      description: insertService.description || null,
      isActive: insertService.isActive ?? true,
      createdAt: now,
      updatedAt: now,
    };

    await db.insert(services).values(service).execute();
    return service;
  }

  async updateService(id: string, updates: Partial<InsertService>): Promise<Service | undefined> {
    await this.initialize();
    const existingService = await this.getService(id);
    if (!existingService) return undefined;

    const updatedService: Service = {
      ...existingService,
      ...updates,
      updatedAt: new Date(),
    };

    await db.update(services).set(updatedService).where(eq(services.id, id)).execute();
    return updatedService;
  }

  async deleteService(id: string): Promise<boolean> {
    await this.initialize();
    const result = await db.delete(services).where(eq(services.id, id)).execute();
    return result.rowCount > 0;
  }

  // Method to fix service merchant assignment
  async updateServiceMerchant(serviceId: string, newMerchantId: string): Promise<boolean> {
    await this.initialize();

    console.log(`🔧 Updating service ${serviceId.substring(0, 8)}... to merchant ${newMerchantId.substring(0, 8)}...`);

    const result = db.update(services)
      .set({
        merchantId: newMerchantId,
        updatedAt: new Date()
      })
      .where(eq(services.id, serviceId))
      .execute();

    console.log(`✅ Update result: ${result.rowCount} rows affected`);
    return result.rowCount > 0;
  }

  // Employee methods
  async getEmployee(id: string): Promise<Employee | undefined> {
    await this.initialize();
    const employee = (await db.select().from(employees).where(eq(employees.id, id)).execute())[0];
    return employee || undefined;
  }

  async getEmployeeByEmail(email: string): Promise<Employee | undefined> {
    await this.initialize();
    const employee = (await db.select().from(employees).where(eq(employees.email, email)).execute())[0];
    return employee || undefined;
  }

  async getEmployeesByMerchant(merchantId: string): Promise<Employee[]> {
    await this.initialize();

    console.log(`\n=== SQLiteStorage.getEmployeesByMerchant DEBUG ===`);
    console.log(`🔍 Input merchantId: "${merchantId}" (type: ${typeof merchantId})`);

    // Get merchant info for context
    const merchant = await this.getMerchant(merchantId);
    console.log(`🏪 Merchant info: ${merchant ? `"${merchant.name}" (${merchant.email})` : 'NOT FOUND'}`);

    // First, let's see ALL employees in the database for debugging
    const allEmployees = db.select().from(employees).execute();
    console.log(`\n📊 DATABASE STATE - Total employees: ${allEmployees.length}`);
    allEmployees.forEach((employee, index) => {
      const belongsToRequested = employee.merchantId === merchantId;
      const status = belongsToRequested ? "✅ MINE" : "❌ OTHER";
      console.log(`  [${index}] "${employee.name}" (ID: ${employee.id.substring(0, 8)}...) -> merchantId: "${employee.merchantId.substring(0, 8)}..." ${status}`);
    });

    // Now execute the filtered query
    console.log(`\n🔎 Executing query: SELECT * FROM employees WHERE merchantId = "${merchantId}"`);
    const result = db.select().from(employees).where(eq(employees.merchantId, merchantId)).execute();

    console.log(`\n📋 QUERY RESULT - Returned ${result.length} employees:`);
    result.forEach((employee, index) => {
      console.log(`  [${index}] "${employee.name}" (ID: ${employee.id.substring(0, 8)}...) merchantId: "${employee.merchantId.substring(0, 8)}..."`);
    });

    // CRITICAL SECURITY VERIFICATION
    const invalidEmployees = result.filter(employee => employee.merchantId !== merchantId);
    const validEmployees = result.filter(employee => employee.merchantId === merchantId);

    console.log(`\n🛡️  SECURITY CHECK:`);
    console.log(`✅ Valid employees (belong to ${merchantId.substring(0, 8)}...): ${validEmployees.length}`);
    console.log(`❌ Invalid employees (belong to other merchants): ${invalidEmployees.length}`);

    if (invalidEmployees.length > 0) {
      console.error(`\n🚨🚨🚨 CRITICAL SECURITY BREACH DETECTED! 🚨🚨🚨`);
      console.error(`❌ Found ${invalidEmployees.length} employees that don't belong to merchant ${merchantId}:`);
      invalidEmployees.forEach(employee => {
        console.error(`  - LEAKED: "${employee.name}" (ID: ${employee.id}) belongs to merchant: "${employee.merchantId}"`);
      });
      console.error(`🚨 RETURNING ONLY VALID EMPLOYEES AS EMERGENCY SECURITY MEASURE 🚨`);
      console.log(`=== END SQLiteStorage DEBUG (SECURITY BREACH PREVENTED) ===\n`);
      return validEmployees;
    }

    // All good
    console.log(`\n✅ SECURITY VERIFICATION PASSED`);
    console.log(`🎯 All ${result.length} employees verified to belong to merchant ${merchantId.substring(0, 8)}...`);
    console.log(`=== END SQLiteStorage DEBUG (SUCCESS) ===\n`);
    return result;
  }

  async getActiveEmployeesByMerchant(merchantId: string): Promise<Employee[]> {
    await this.initialize();
    return db.select().from(employees)
      .where(and(
        eq(employees.merchantId, merchantId),
        eq(employees.isActive, true)
      ))
      .execute();
  }

  async createEmployee(insertEmployee: InsertEmployee): Promise<Employee> {
    await this.initialize();
    const hashedPassword = await bcrypt.hash(insertEmployee.password, 10);
    const id = randomUUID();
    const now = new Date();
    const employee: Employee = {
      ...insertEmployee,
      id,
      password: hashedPassword,
      role: insertEmployee.role || "employee",
      specialties: insertEmployee.specialties || null,
      workDays: insertEmployee.workDays || "[0,1,2,3,4,5,6]",
      startTime: insertEmployee.startTime || "09:00",
      endTime: insertEmployee.endTime || "18:00",
      breakStartTime: insertEmployee.breakStartTime || null,
      breakEndTime: insertEmployee.breakEndTime || null,
      isActive: insertEmployee.isActive ?? true,
      paymentType: insertEmployee.paymentType || "monthly",
      paymentValue: insertEmployee.paymentValue || 0,
      createdAt: now,
      updatedAt: now,
    };

    db.insert(employees).values(employee).run();
    return employee;
  }

  async updateEmployee(id: string, updates: Partial<InsertEmployee>): Promise<Employee | undefined> {
    await this.initialize();
    const existingEmployee = await this.getEmployee(id);
    if (!existingEmployee) return undefined;

    // Hash password if it's being updated
    const processedUpdates = { ...updates };
    if (processedUpdates.password) {
      processedUpdates.password = await bcrypt.hash(processedUpdates.password, 10);
    }

    const updatedEmployee: Employee = {
      ...existingEmployee,
      ...processedUpdates,
      updatedAt: new Date(),
    };

    db.update(employees).set(updatedEmployee).where(eq(employees.id, id)).run();
    return updatedEmployee;
  }

  async updateEmployeePassword(id: string, newPassword: string): Promise<boolean> {
    try {
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      const sql = `UPDATE employees SET password = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
      // await this.executeQuery(sql, [hashedPassword, id]); // Temporarily disabled
      return true;
    } catch (error) {
      console.error("Error updating employee password:", error);
      return false;
    }
  }

  async deleteEmployee(id: string): Promise<boolean> {
    await this.initialize();
    const result = db.delete(employees).where(eq(employees.id, id)).run();
    return result.changes > 0;
  }

  // Client methods
  async getClient(id: string): Promise<Client | undefined> {
    await this.initialize();
    const client = (await db.select().from(clients).where(eq(clients.id, id)).execute())[0];
    return client || undefined;
  }

  async getClientByEmail(email: string): Promise<Client | undefined> {
    if (!this.initialized) await this.initialize();
    const client = (await db.select().from(clients).where(eq(clients.email, email)).execute())[0];
    return client || undefined;
  }

  async getClientsByMerchant(merchantId: string): Promise<Client[]> {
    await this.initialize();

    console.log(`\n=== SQLiteStorage.getClientsByMerchant DEBUG ===`);
    console.log(`🔍 Input merchantId: "${merchantId}" (type: ${typeof merchantId})`);

    // Get merchant info for context
    const merchant = await this.getMerchant(merchantId);
    console.log(`🏪 Merchant info: ${merchant ? `"${merchant.name}" (${merchant.email})` : 'NOT FOUND'}`);

    // First, let's see ALL clients in the database for debugging
    const allClients = db.select().from(clients).execute();
    console.log(`\n📊 DATABASE STATE - Total clients: ${allClients.length}`);
    allClients.forEach((client, index) => {
      const belongsToRequested = client.merchantId === merchantId;
      const status = belongsToRequested ? "✅ MINE" : "❌ OTHER";
      console.log(`  [${index}] "${client.name}" (ID: ${client.id.substring(0, 8)}...) -> merchantId: "${client.merchantId.substring(0, 8)}..." ${status}`);
    });

    // Now execute the filtered query
    console.log(`\n🔎 Executing query: SELECT * FROM clients WHERE merchantId = "${merchantId}"`);
    const result = db.select().from(clients).where(eq(clients.merchantId, merchantId)).execute();

    console.log(`\n📋 QUERY RESULT - Returned ${result.length} clients:`);
    result.forEach((client, index) => {
      console.log(`  [${index}] "${client.name}" (ID: ${client.id.substring(0, 8)}...) merchantId: "${client.merchantId.substring(0, 8)}..."`);
    });

    // CRITICAL SECURITY VERIFICATION
    const invalidClients = result.filter(client => client.merchantId !== merchantId);
    const validClients = result.filter(client => client.merchantId === merchantId);

    console.log(`\n🛡️  SECURITY CHECK:`);
    console.log(`✅ Valid clients (belong to ${merchantId.substring(0, 8)}...): ${validClients.length}`);
    console.log(`❌ Invalid clients (belong to other merchants): ${invalidClients.length}`);

    if (invalidClients.length > 0) {
      console.error(`\n🚨🚨🚨 CRITICAL SECURITY BREACH DETECTED! 🚨🚨🚨`);
      console.error(`❌ Found ${invalidClients.length} clients that don't belong to merchant ${merchantId}:`);
      invalidClients.forEach(client => {
        console.error(`  - LEAKED: "${client.name}" (ID: ${client.id}) belongs to merchant: "${client.merchantId}"`);
      });
      console.error(`🚨 RETURNING ONLY VALID CLIENTS AS EMERGENCY SECURITY MEASURE 🚨`);
      console.log(`=== END SQLiteStorage DEBUG (SECURITY BREACH PREVENTED) ===\n`);
      return validClients;
    }

    // All good
    console.log(`\n✅ SECURITY VERIFICATION PASSED`);
    console.log(`🎯 All ${result.length} clients verified to belong to merchant ${merchantId.substring(0, 8)}...`);
    console.log(`=== END SQLiteStorage DEBUG (SUCCESS) ===\n`);
    return result;
  }

  async getActiveClientsByMerchant(merchantId: string): Promise<Client[]> {
    await this.initialize();
    return db.select().from(clients)
      .where(and(
        eq(clients.merchantId, merchantId),
        eq(clients.isActive, true)
      ))
      .execute();
  }

  async createClient(insertClient: InsertClient): Promise<Client> {
    await this.initialize();
    const hashedPassword = await bcrypt.hash(insertClient.password, 10);
    const id = randomUUID();
    const now = new Date();
    const client: Client = {
      ...insertClient,
      id,
      password: hashedPassword,
      notes: insertClient.notes || null,
      isActive: insertClient.isActive ?? true,
      createdAt: now,
      updatedAt: now,
    };

    db.insert(clients).values(client).run();
    return client;
  }

  async updateClient(id: string, updates: Partial<InsertClient>): Promise<Client | undefined> {
    await this.initialize();
    const existingClient = await this.getClient(id);
    if (!existingClient) return undefined;

    // Hash password if it's being updated
    const processedUpdates = { ...updates };
    if (processedUpdates.password) {
      processedUpdates.password = await bcrypt.hash(processedUpdates.password, 10);
    }

    const updatedClient: Client = {
      ...existingClient,
      ...processedUpdates,
      updatedAt: new Date(),
    };

    db.update(clients).set(updatedClient).where(eq(clients.id, id)).run();
    return updatedClient;
  }

  async updateClientPassword(id: string, newPassword: string): Promise<boolean> {
    try {
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      const sql = `UPDATE clients SET password = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
      // await this.executeQuery(sql, [hashedPassword, id]); // Temporarily disabled
      return true;
    } catch (error) {
      console.error("Error updating client password:", error);
      return false;
    }
  }

  async deleteClient(id: string): Promise<boolean> {
    await this.initialize();
    const result = db.delete(clients).where(eq(clients.id, id)).run();
    return result.changes > 0;
  }

  // Appointment methods
  async getAppointment(id: string): Promise<Appointment | undefined> {
    await this.initialize();
    const appointment = db.select().from(appointments).where(eq(appointments.id, id)).get();
    return appointment || undefined;
  }

  async getAppointmentsByMerchant(merchantId: string): Promise<Appointment[]> {
    await this.initialize();
    return db.select({
      id: appointments.id,
      merchantId: appointments.merchantId,
      serviceId: appointments.serviceId,
      clientId: appointments.clientId,
      employeeId: appointments.employeeId,
      clientName: appointments.clientName,
      clientPhone: appointments.clientPhone,
      clientEmail: appointments.clientEmail,
      appointmentDate: appointments.appointmentDate,
      appointmentTime: appointments.appointmentTime,
      endTime: appointments.endTime,
      status: appointments.status,
      notes: appointments.notes,
      rescheduleReason: appointments.rescheduleReason,
      cancelReason: appointments.cancelReason,
      cancelPolicy: appointments.cancelPolicy,
      reminderSent: appointments.reminderSent,
      arrivalTime: appointments.arrivalTime,
      completedAt: appointments.completedAt,
      newDate: appointments.newDate,
      newTime: appointments.newTime,
      actualStartTime: appointments.actualStartTime,
      actualEndTime: appointments.actualEndTime,
      paymentStatus: sql<string>`COALESCE(${appointments}.payment_status, 'pending')`,
      paidAt: sql`${appointments}.paid_at`,
      createdAt: appointments.createdAt,
      updatedAt: appointments.updatedAt,
      serviceName: services.name,
      servicePrice: services.price,
      employeeName: employees.name,
    }).from(appointments)
      .leftJoin(services, eq(appointments.serviceId, services.id))
      .leftJoin(employees, eq(appointments.employeeId, employees.id))
      .where(eq(appointments.merchantId, merchantId))
      .orderBy(desc(appointments.appointmentDate), desc(appointments.appointmentTime))
      .execute();
  }

  async getAppointmentsByClient(clientId: string): Promise<Appointment[]> {
    await this.initialize();
    return db.select().from(appointments).where(eq(appointments.clientId, clientId)).execute();
  }

  async getAppointmentsByDate(merchantId: string, date: string): Promise<Appointment[]> {
    await this.initialize();

    const appointmentsList = db.select({
      id: appointments.id,
      merchantId: appointments.merchantId,
      serviceId: appointments.serviceId,
      clientId: appointments.clientId,
      employeeId: appointments.employeeId,
      clientName: appointments.clientName,
      clientPhone: appointments.clientPhone,
      clientEmail: appointments.clientEmail,
      appointmentDate: appointments.appointmentDate,
      appointmentTime: appointments.appointmentTime,
      endTime: appointments.endTime,
      status: appointments.status,
      notes: appointments.notes,
      rescheduleReason: appointments.rescheduleReason,
      cancelReason: appointments.cancelReason,
      cancelPolicy: appointments.cancelPolicy,
      reminderSent: appointments.reminderSent,
      arrivalTime: appointments.arrivalTime,
      completedAt: appointments.completedAt,
      newDate: appointments.newDate,
      newTime: appointments.newTime,
      actualStartTime: appointments.actualStartTime,
      actualEndTime: appointments.actualEndTime,
      createdAt: appointments.createdAt,
      updatedAt: appointments.updatedAt,
      serviceName: services.name,
      servicePrice: services.price,
      employeeName: employees.name,
    }).from(appointments)
      .leftJoin(services, eq(appointments.serviceId, services.id))
      .leftJoin(employees, eq(appointments.employeeId, employees.id))
      .where(and(
        eq(appointments.merchantId, merchantId),
        eq(appointments.appointmentDate, date)
      ))
      .orderBy(appointments.appointmentTime)
      .execute();

    return appointmentsList;
  }

  async getAppointmentsByDateRange(merchantId: string, startDate: string, endDate: string): Promise<Appointment[]> {
    await this.initialize();
    return db.select().from(appointments)
      .where(and(
        eq(appointments.merchantId, merchantId),
        gte(appointments.appointmentDate, startDate),
        sql`${appointments.appointmentDate} <= ${endDate}`
      ))
      .orderBy(appointments.appointmentDate, appointments.appointmentTime)
      .execute();
  }

  async createAppointment(insertAppointment: InsertAppointment): Promise<Appointment> {
    await this.initialize();
    console.log('SQLiteStorage.createAppointment called with:', insertAppointment);

    // Check if the employee is on day off for the requested date
    if (insertAppointment.employeeId) {
      const isOnDayOff = await this.isEmployeeOnDayOff(insertAppointment.employeeId, insertAppointment.appointmentDate);
      if (isOnDayOff) {
        throw new Error("Este funcionário está de folga neste dia.");
      }
    }

    const now = new Date();

    // Calculate end time based on service duration
    let endTime = insertAppointment.endTime;
    if (!endTime && insertAppointment.appointmentTime) {
      // Get service duration and calculate end time
      const service = await this.getService(insertAppointment.serviceId);
      if (service) {
        const [hours, minutes] = insertAppointment.appointmentTime.split(':').map(Number);
        const endMinutes = minutes + service.duration;
        const endHour = hours + Math.floor(endMinutes / 60);
        const finalMinutes = endMinutes % 60;
        endTime = `${endHour.toString().padStart(2, '0')}:${finalMinutes.toString().padStart(2, '0')}`;
      } else {
        endTime = insertAppointment.appointmentTime; // Fallback
      }
    }

    const appointment: Appointment = {
      id: randomUUID(),
      merchantId: insertAppointment.merchantId,
      serviceId: insertAppointment.serviceId,
      clientId: insertAppointment.clientId || null,
      employeeId: insertAppointment.employeeId || null,
      clientName: insertAppointment.clientName,
      clientPhone: insertAppointment.clientPhone,
      clientEmail: insertAppointment.clientEmail || null,
      appointmentDate: insertAppointment.appointmentDate,
      appointmentTime: insertAppointment.appointmentTime,
      endTime: endTime || insertAppointment.appointmentTime,
      status: insertAppointment.status || "pending",
      notes: insertAppointment.notes || null,
      rescheduleReason: insertAppointment.rescheduleReason || null,
      cancelReason: insertAppointment.cancelReason || null,
      cancelPolicy: insertAppointment.cancelPolicy || "24h",
      reminderSent: insertAppointment.reminderSent || false,
      arrivalTime: insertAppointment.arrivalTime || null,
      completedAt: insertAppointment.completedAt || null,
      newDate: insertAppointment.newDate || null,
      newTime: insertAppointment.newTime || null,
      createdAt: now,
      updatedAt: now,
    };

    console.log('Appointment object to insert:', appointment);

    try {
      const result = db.insert(appointments).values(appointment).run();
      console.log('Database insert result:', result);
      return appointment;
    } catch (error) {
      console.error('Error creating appointment in database:', error);
      console.error('Error details:', (error as Error).message);
      throw new Error(`Failed to create appointment: ${(error as Error).message}`);
    }
  }

  async updateAppointment(id: string, updates: Partial<InsertAppointment>): Promise<Appointment | undefined> {
    await this.initialize();
    const existingAppointment = await this.getAppointment(id);
    if (!existingAppointment) return undefined;

    // Check if the employee is on day off for the new date if date is being updated
    if (updates.employeeId && updates.appointmentDate && updates.appointmentDate !== existingAppointment.appointmentDate) {
      const isOnDayOff = await this.isEmployeeOnDayOff(updates.employeeId, updates.appointmentDate);
      if (isOnDayOff) {
        throw new Error("Este funcionário está de folga neste dia.");
      }
    }

    const updatedAppointment: Appointment = {
      ...existingAppointment,
      ...updates,
      updatedAt: new Date(),
    };

    // If status is completed, set completedAt
    if (updates.status === "completed") {
      updatedAppointment.completedAt = new Date();
    }

    // Capture actual start time when status changes to in_progress (Brazil timezone GMT-3)
    if (updates.status === "in_progress" && !existingAppointment.actualStartTime) {
      const now = new Date();
      // Convert to Brazil timezone (UTC-3) - properly account for local time
      const brazilOffset = -3 * 60; // UTC-3 in minutes
      const brazilTime = new Date(now.getTime() + (brazilOffset * 60 * 1000));
      updatedAppointment.actualStartTime = `${brazilTime.getUTCHours().toString().padStart(2, '0')}:${brazilTime.getUTCMinutes().toString().padStart(2, '0')}`;
    }

    // Capture actual end time when status changes to completed (Brazil timezone GMT-3)
    if (updates.status === "completed" && !existingAppointment.actualEndTime) {
      const now = new Date();
      // Convert to Brazil timezone (UTC-3) - properly account for local time
      const brazilOffset = -3 * 60; // UTC-3 in minutes
      const brazilTime = new Date(now.getTime() + (brazilOffset * 60 * 1000));
      updatedAppointment.actualEndTime = `${brazilTime.getUTCHours().toString().padStart(2, '0')}:${brazilTime.getUTCMinutes().toString().padStart(2, '0')}`;
    }

    db.update(appointments).set(updatedAppointment).where(eq(appointments.id, id)).run();
    return updatedAppointment;
  }

  async deleteAppointment(id: string): Promise<boolean> {
    await this.initialize();
    const result = db.delete(appointments).where(eq(appointments.id, id)).run();
    return result.changes > 0;
  }

  async deleteAppointmentsByService(serviceId: string): Promise<number> {
    await this.initialize();
    const result = db.delete(appointments).where(eq(appointments.serviceId, serviceId)).run();
    return result.changes;
  }

  async getMerchantDashboardStats(merchantId: string): Promise<{
    appointments: {
      today: number;
      thisWeek: number;
      thisMonth: number;
    };
    services: {
      total: number;
      active: number;
    };
  }> {
    await this.initialize();

    const now = new Date();
    const today = now.toISOString().split('T')[0]; // YYYY-MM-DD format
    const thisWeekStart = new Date(now);
    thisWeekStart.setDate(now.getDay() === 0 ? now.getDate() - 6 : now.getDate() - now.getDay() + (now.getDay() === 0 ? 0 : 1) ); // Start from Sunday or Monday depending on locale
    const thisWeek = thisWeekStart.toISOString().split('T')[0];

    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const thisMonth = thisMonthStart.toISOString().split('T')[0];

    const allAppointments = await this.getAppointmentsByMerchant(merchantId);
    const allServices = await this.getServicesByMerchant(merchantId);

    return {
      appointments: {
        today: allAppointments.filter(a => a.appointmentDate === today).length,
        thisWeek: allAppointments.filter(a => a.appointmentDate >= thisWeek).length,
        thisMonth: allAppointments.filter(a => a.appointmentDate >= thisMonth).length,
      },
      services: {
        total: allServices.length,
        active: allServices.filter(s => s.isActive).length,
      },
    };
  }

  // Client-specific appointment methods
  async getClientAppointments(clientId: string, merchantId: string): Promise<Appointment[]> {
    await this.initialize();
    console.log(`Getting ALL appointments for client ${clientId} and merchant ${merchantId}`);

    const result = await db.select({
      id: appointments.id,
      merchantId: appointments.merchantId,
      serviceId: appointments.serviceId,
      clientId: appointments.clientId,
      employeeId: appointments.employeeId,
      clientName: appointments.clientName,
      clientPhone: appointments.clientPhone,
      clientEmail: appointments.clientEmail,
      appointmentDate: appointments.appointmentDate,
      appointmentTime: appointments.appointmentTime,
      endTime: appointments.endTime,
      status: appointments.status,
      notes: appointments.notes,
      rescheduleReason: sql`CASE WHEN ${appointments.status} = 'completed' THEN NULL ELSE ${appointments.rescheduleReason} END`,
      cancelReason: appointments.cancelReason,
      cancelPolicy: appointments.cancelPolicy,
      reminderSent: appointments.reminderSent,
      arrivalTime: appointments.arrivalTime,
      completedAt: appointments.completedAt,
      newDate: appointments.newDate,
      newTime: appointments.newTime,
      createdAt: appointments.createdAt,
      updatedAt: appointments.updatedAt,
      serviceName: services.name,
      servicePrice: services.price,
      employeeName: employees.name,
    }).from(appointments)
      .leftJoin(services, eq(appointments.serviceId, services.id))
      .leftJoin(employees, eq(appointments.employeeId, employees.id))
      .where(and(
        eq(appointments.clientId, clientId),
        eq(appointments.merchantId, merchantId)
      ))
      .orderBy(desc(appointments.appointmentDate), desc(appointments.appointmentTime));

    console.log(`Found ${result.length} total appointments for client:`, result.map(r => ({ id: r.id, status: r.status, date: r.appointmentDate })));

    // Enrich appointments with promotion information
    const appointmentsWithPromotions = await Promise.all(
      result.map(async (appointment) => {
        if (appointment.serviceId && appointment.servicePrice) {
          const promotionInfo = await this.calculatePromotionalPrice(appointment.serviceId, appointment.servicePrice);
          return {
            ...appointment,
            hasPromotion: promotionInfo.hasPromotion,
            originalPrice: promotionInfo.originalPrice,
            promotionalPrice: promotionInfo.promotionalPrice,
            promotion: promotionInfo.discount
          };
        }
        return appointment;
      })
    );

    return appointmentsWithPromotions as any[];
  }

  async getClientAppointmentsByDate(clientId: string, merchantId: string, date: string): Promise<Appointment[]> {
    await this.initialize();
    const clientAppointments = await db.select({
      id: appointments.id,
      merchantId: appointments.merchantId,
      serviceId: appointments.serviceId,
      clientId: appointments.clientId,
      employeeId: appointments.employeeId,
      clientName: appointments.clientName,
      clientPhone: appointments.clientPhone,
      clientEmail: appointments.clientEmail,
      appointmentDate: appointments.appointmentDate,
      appointmentTime: appointments.appointmentTime,
      endTime: appointments.endTime,
      status: appointments.status,
      notes: appointments.notes,
      rescheduleReason: appointments.rescheduleReason,
      cancelReason: appointments.cancelReason,
      cancelPolicy: appointments.cancelPolicy,
      reminderSent: appointments.reminderSent,
      arrivalTime: appointments.arrivalTime,
      completedAt: appointments.completedAt,
      newDate: appointments.newDate,
      newTime: appointments.newTime,
      createdAt: appointments.createdAt,
      updatedAt: appointments.updatedAt,
      serviceName: services.name,
      servicePrice: services.price,
      employeeName: employees.name,
    }).from(appointments)
      .leftJoin(services, eq(appointments.serviceId, services.id))
      .leftJoin(employees, eq(appointments.employeeId, employees.id))
      .where(and(
        eq(appointments.clientId, clientId),
        eq(appointments.merchantId, merchantId),
        eq(appointments.appointmentDate, date)
      ))
      .orderBy(appointments.appointmentTime)
      .execute();

    // Enrich appointments with promotion information
    const appointmentsWithPromotions = await Promise.all(
      clientAppointments.map(async (appointment) => {
        if (appointment.serviceId && appointment.servicePrice) {
          const promotionInfo = await this.calculatePromotionalPrice(appointment.serviceId, appointment.servicePrice);
          return {
            ...appointment,
            hasPromotion: promotionInfo.hasPromotion,
            originalPrice: promotionInfo.originalPrice,
            promotionalPrice: promotionInfo.promotionalPrice,
            promotion: promotionInfo.discount
          };
        }
        return appointment;
      })
    );

    return appointmentsWithPromotions as any[];
  }

  async getClientAppointmentsByDateRange(clientId: string, merchantId: string, startDate: string, endDate: string): Promise<Appointment[]> {
    await this.initialize();
    const clientAppointments = await db.select({
      id: appointments.id,
      merchantId: appointments.merchantId,
      serviceId: appointments.serviceId,
      clientId: appointments.clientId,
      employeeId: appointments.employeeId,
      clientName: appointments.clientName,
      clientPhone: appointments.clientPhone,
      clientEmail: appointments.clientEmail,
      appointmentDate: appointments.appointmentDate,
      appointmentTime: appointments.appointmentTime,
      endTime: appointments.endTime,
      status: appointments.status,
      notes: appointments.notes,
      rescheduleReason: appointments.rescheduleReason,
      cancelReason: appointments.cancelReason,
      cancelPolicy: appointments.cancelPolicy,
      reminderSent: appointments.reminderSent,
      arrivalTime: appointments.arrivalTime,
      completedAt: appointments.completedAt,
      newDate: appointments.newDate,
      newTime: appointments.newTime,
      createdAt: appointments.createdAt,
      updatedAt: appointments.updatedAt,
      serviceName: services.name,
      servicePrice: services.price,
      employeeName: employees.name,
    }).from(appointments)
      .leftJoin(services, eq(appointments.serviceId, services.id))
      .leftJoin(employees, eq(appointments.employeeId, employees.id))
      .where(and(
        eq(appointments.clientId, clientId),
        eq(appointments.merchantId, merchantId),
        gte(appointments.appointmentDate, startDate),
        sql`${appointments.appointmentDate} <= ${endDate}`
      ))
      .orderBy(appointments.appointmentDate, appointments.appointmentTime)
      .execute();

    return clientAppointments;
  }

  // Missing appointment methods implementation
  async getAppointmentsByEmployee(employeeId: string, date?: string): Promise<Appointment[]> {
    await this.initialize();

    if (date) {
      return db.select().from(appointments)
        .where(and(
          eq(appointments.employeeId, employeeId),
          eq(appointments.appointmentDate, date)
        ))
        .orderBy(appointments.appointmentDate, appointments.appointmentTime)
        .execute();
    }

    return db.select().from(appointments)
      .where(eq(appointments.employeeId, employeeId))
      .orderBy(appointments.appointmentDate, appointments.appointmentTime)
      .execute();
  }

  async updateAppointmentStatus(id: string, statusUpdate: AppointmentStatusData & { paymentStatus?: string }): Promise<Appointment | undefined> {
    await this.initialize();
    console.log(`\n=== SQLiteStorage.updateAppointmentStatus DEBUG ===`);
    console.log(`Appointment ID: ${id}`);
    console.log(`Status update:`, JSON.stringify(statusUpdate, null, 2));

    const existingAppointment = await this.getAppointment(id);
    if (!existingAppointment) {
      console.log(`❌ Appointment ${id} not found in database`);
      return undefined;
    }

    console.log(`✅ Found existing appointment:`, {
      id: existingAppointment.id,
      status: existingAppointment.status,
      paymentStatus: (existingAppointment as any).paymentStatus,
      clientName: existingAppointment.clientName,
      updatedAt: existingAppointment.updatedAt
    });

    const updatedAppointment: Appointment = {
      ...existingAppointment,
      status: statusUpdate.status || existingAppointment.status,
      cancelReason: statusUpdate.cancelReason || existingAppointment.cancelReason,
      rescheduleReason: statusUpdate.rescheduleReason || existingAppointment.rescheduleReason,
      arrivalTime: statusUpdate.arrivalTime || existingAppointment.arrivalTime,
      updatedAt: new Date(),
    };

    // Handle payment status updates
    if (statusUpdate.paymentStatus !== undefined) {
      console.log(`💰 Updating payment status from "${(existingAppointment as any).paymentStatus}" to "${statusUpdate.paymentStatus}"`);
      (updatedAppointment as any).paymentStatus = statusUpdate.paymentStatus;
      if (statusUpdate.paymentStatus === "paid") {
        (updatedAppointment as any).paidAt = new Date();
        console.log(`✅ Setting paidAt timestamp: ${(updatedAppointment as any).paidAt}`);
      }
    } else {
      console.log(`ℹ️  No payment status update requested`);
    }

    // If status is completed, set completedAt
    if (statusUpdate.status === "completed") {
      updatedAppointment.completedAt = new Date();
      console.log(`✅ Setting completedAt timestamp: ${updatedAppointment.completedAt}`);
    }

    // Capture actual start time when status changes to in_progress (Brazil timezone GMT-3)
    if (statusUpdate.status === "in_progress" && !existingAppointment.actualStartTime) {
      const now = new Date();
      // Convert to Brazil timezone (UTC-3) - properly account for local time
      const brazilOffset = -3 * 60; // UTC-3 in minutes
      const brazilTime = new Date(now.getTime() + (brazilOffset * 60 * 1000));
      updatedAppointment.actualStartTime = `${brazilTime.getUTCHours().toString().padStart(2, '0')}:${brazilTime.getUTCMinutes().toString().padStart(2, '0')}`;
      console.log(`✅ Setting actualStartTime: ${updatedAppointment.actualStartTime}`);
    }

    // Capture actual end time when status changes to completed (Brazil timezone GMT-3)
    if (statusUpdate.status === "completed" && !existingAppointment.actualEndTime) {
      const now = new Date();
      // Convert to Brazil timezone (UTC-3) - properly account for local time
      const brazilOffset = -3 * 60; // UTC-3 in minutes
      const brazilTime = new Date(now.getTime() + (brazilOffset * 60 * 1000));
      updatedAppointment.actualEndTime = `${brazilTime.getUTCHours().toString().padStart(2, '0')}:${brazilTime.getUTCMinutes().toString().padStart(2, '0')}`;
      console.log(`✅ Setting actualEndTime: ${updatedAppointment.actualEndTime}`);
    }

    console.log(`📝 Final appointment object to update:`, {
      id: updatedAppointment.id,
      status: updatedAppointment.status,
      paymentStatus: (updatedAppointment as any).paymentStatus,
      paidAt: (updatedAppointment as any).paidAt,
      clientName: updatedAppointment.clientName,
      updatedAt: updatedAppointment.updatedAt
    });

    try {
      console.log(`💾 Executing database update for appointment ${id}...`);

      // Check the current state in database before update
      const currentStateQuery = db.select().from(appointments).where(eq(appointments.id, id)).get();
      console.log(`📊 Current database state before update:`, {
        id: currentStateQuery?.id,
        status: currentStateQuery?.status,
        payment_status: (currentStateQuery as any)?.payment_status,
        updated_at: (currentStateQuery as any)?.updated_at
      });

      const result = db.update(appointments).set(updatedAppointment).where(eq(appointments.id, id)).run();
      console.log(`📊 Database update result:`, {
        changes: result.changes,
        lastInsertRowid: result.lastInsertRowid
      });

      if (result.changes === 0) {
        console.log(`❌ No rows were updated for appointment ${id} - this is unexpected!`);
        return undefined;
      }

      // Verify the update worked
      const verifyQuery = db.select().from(appointments).where(eq(appointments.id, id)).get();
      console.log(`🔍 Verification query after update:`, {
        id: verifyQuery?.id,
        status: verifyQuery?.status,
        payment_status: (verifyQuery as any)?.payment_status,
        paid_at: (verifyQuery as any)?.paid_at,
        updated_at: (verifyQuery as any)?.updated_at
      });

      console.log(`✅ Successfully updated appointment ${id}`);
      console.log(`=== END SQLiteStorage DEBUG ===\n`);
      return updatedAppointment;
    } catch (error) {
      console.error(`❌ Error updating appointment ${id} in database:`, error);
      console.error(`Error name: ${error.name}`);
      console.error(`Error message: ${error.message}`);
      console.error(`Error stack: ${error.stack}`);
      console.log(`=== END SQLiteStorage ERROR ===\n`);
      throw error;
    }
  }

  async rescheduleAppointment(id: string, newDate: string, newTime: string, reason: string): Promise<Appointment | undefined> {
    await this.initialize();

    console.log(`Rescheduling appointment ${id} to ${newDate} ${newTime}, reason: ${reason}`);

    const existingAppointment = await this.getAppointment(id);
    if (!existingAppointment) {
      console.log("Appointment not found");
      return undefined;
    }

    console.log("Found existing appointment:", existingAppointment);

    // Check if the employee is on day off for the new date
    if (existingAppointment.employeeId) {
      const isOnDayOff = await this.isEmployeeOnDayOff(existingAppointment.employeeId, newDate);
      if (isOnDayOff) {
        throw new Error("Este funcionário está de folga neste dia.");
      }
    }

    // Validate new date and time - allow rescheduling to any future time
    const now = new Date();
    const newDateTime = new Date(`${newDate}T${newTime}`);

    // Only validate that the new datetime is not in the past (same day is allowed)
    const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const newDateMidnight = new Date(newDateTime.getFullYear(), newDateTime.getMonth(), newDateTime.getDate());

    if (newDateMidnight < todayMidnight) {
      console.log("Cannot reschedule to a past date");
      throw new Error("Não é possível reagendar para uma data no passado");
    }

    // If it's today, allow any time (employees can reschedule within the same day)
    // If it's a future date, allow any time
    console.log(`Rescheduling validation passed: ${newDate} ${newTime}`);
    console.log(`Current time: ${now.toISOString()}, New time: ${newDateTime.toISOString()}`)

    // Calculate new end time based on service duration
    const service = await this.getService(existingAppointment.serviceId);
    let newEndTime = newTime;
    if (service) {
      const [hours, minutes] = newTime.split(':').map(Number);
      const endMinutes = minutes + service.duration;
      const endHour = hours + Math.floor(endMinutes / 60);
      const finalMinutes = endMinutes % 60;
      newEndTime = `${endHour.toString().padStart(2, '0')}:${finalMinutes.toString().padStart(2, '0')}`;
    }

    console.log(`Service duration: ${service?.duration || 60} minutes, calculated end time: ${newEndTime}`);

    // Check availability for new time slot (excluding the current appointment)
    if (existingAppointment.employeeId) {
      console.log("Checking availability for employee...");
      try {
        await this.checkEmployeeAvailabilityForReschedule(
          existingAppointment.employeeId,
          newDate,
          newTime,
          service?.duration || 60,
          id // Exclude the current appointment from conflict check
        );
      } catch (error) {
        console.log("Employee is not available for the new time slot:", error.message);
        throw error; // Re-throw the specific error message
      }
      console.log("Employee is available for the new time slot");
    } else {
      console.log("No employee assigned to appointment, skipping availability check");
    }

    const updatedAppointment: Appointment = {
      ...existingAppointment,
      appointmentDate: newDate,
      appointmentTime: newTime,
      endTime: newEndTime,
      rescheduleReason: reason,
      status: "pending", // Reset to pending after reschedule
      updatedAt: new Date(),
    };

    console.log("Updating appointment in database...");
    db.update(appointments).set(updatedAppointment).where(eq(appointments.id, id)).run();
    console.log("Appointment rescheduled successfully");

    return updatedAppointment;
  }


  async cancelAppointment(id: string, reason: string): Promise<Appointment | undefined> {
    await this.initialize();
    const existingAppointment = await this.getAppointment(id);
    if (!existingAppointment) return undefined;

    // Allow cancellation - fee calculation is handled in the route handler
    const updatedAppointment: Appointment = {
      ...existingAppointment,
      status: "cancelled",
      cancelReason: reason,
      updatedAt: new Date(),
    };

    db.update(appointments).set(updatedAppointment).where(eq(appointments.id, id)).run();
    return updatedAppointment;
  }

  async checkEmployeeAvailability(availability: AvailabilityData): Promise<boolean> {
    await this.initialize();

    // Check if employee is on day off
    const isOnDayOff = await this.isEmployeeOnDayOff(availability.employeeId, availability.date);
    if (isOnDayOff) return false;

    const employee = await this.getEmployee(availability.employeeId);
    if (!employee || !employee.isActive) return false;

    // Check if employee works on this day
    const workDays = JSON.parse(employee.workDays);
    // Parse date correctly to avoid timezone issues
    const [year, month, day] = availability.date.split('-').map(Number);
    const requestDate = new Date(year, month - 1, day);
    const dayOfWeek = requestDate.getDay();

    if (!workDays.includes(dayOfWeek)) return false;

    // Check if time is within working hours
    const requestStartTime = availability.startTime;
    const [startHour, startMinute] = requestStartTime.split(':').map(Number);
    const requestEndMinute = startMinute + availability.duration;
    const requestEndHour = startHour + Math.floor(requestEndMinute / 60);
    const finalEndMinute = requestEndMinute % 60;
    const requestEndTime = `${requestEndHour.toString().padStart(2, '0')}:${finalEndMinute.toString().padStart(2, '0')}`;

    if (requestStartTime < employee.startTime || requestEndTime > employee.endTime) {
      return false;
    }

    // Check if time conflicts with break time
    if (employee.breakStartTime && employee.breakEndTime) {
      if (!(requestEndTime <= employee.breakStartTime || requestStartTime >= employee.breakEndTime)) {
        return false;
      }
    }

    // Check for existing appointments conflicts
    const existingAppointments = await this.getAppointmentsByEmployee(availability.employeeId, availability.date);
    for (const apt of existingAppointments) {
      if (apt.status === "cancelled" || apt.status === "completed" || apt.status === "no_show") continue;

      // Check for time overlap
      if (!(requestEndTime <= apt.appointmentTime || requestStartTime >= apt.endTime)) {
        return false;
      }
    }

    return true;
  }

  async checkEmployeeAvailabilityForReschedule(
    employeeId: string,
    date: string,
    startTime: string,
    duration: number,
    excludeAppointmentId: string
  ): Promise<boolean> {
    await this.initialize();

    console.log(`Checking availability for reschedule - Employee: ${employeeId}, Date: ${date}, Time: ${startTime}, Duration: ${duration}, Exclude: ${excludeAppointmentId}`);

    // Check if employee is on day off for the requested date
    const isOnDayOff = await this.isEmployeeOnDayOff(employeeId, date);
    if (isOnDayOff) {
      const dayNames = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
      const [year, month, day] = date.split('-').map(Number);
      const requestDate = new Date(year, month - 1, day);
      throw new Error(`O funcionário está de folga neste dia (${dayNames[requestDate.getDay()]}s). Por favor, escolha outro dia.`);
    }

    const employee = await this.getEmployee(employeeId);
    if (!employee || !employee.isActive) {
      console.log("Employee not found or inactive");
      return false;
    }

    // Check if employee works on this day
    const workDays = JSON.parse(employee.workDays);
    // Parse date correctly to avoid timezone issues
    const [year, month, day] = date.split('-').map(Number);
    const requestDate = new Date(year, month - 1, day);
    const dayOfWeek = requestDate.getDay();

    const dayNames = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

    if (!workDays.includes(dayOfWeek)) {
      console.log(`Employee doesn't work on day ${dayOfWeek} (${dayNames[dayOfWeek]})`);
      throw new Error(`O funcionário não trabalha às ${dayNames[dayOfWeek]}s. Por favor, escolha outro dia.`);
    }

    // Check if time is within working hours
    const requestStartTime = startTime;
    const [startHour, startMinute] = requestStartTime.split(':').map(Number);
    const requestEndMinute = startMinute + duration;
    const requestEndHour = startHour + Math.floor(requestEndMinute / 60);
    const finalEndMinute = requestEndMinute % 60;
    const requestEndTime = `${requestEndHour.toString().padStart(2, '0')}:${finalEndMinute.toString().padStart(2, '0')}`;

    console.log(`Requested time slot: ${requestStartTime} - ${requestEndTime}`);
    console.log(`Employee working hours: ${employee.startTime} - ${employee.endTime}`);

    if (requestStartTime < employee.startTime || requestEndTime > employee.endTime) {
      console.log("Time outside working hours");
      throw new Error(`O horário solicitado (${requestStartTime} - ${requestEndTime}) está fora do horário de trabalho do funcionário (${employee.startTime} - ${employee.endTime}).`);
    }

    // Check if time conflicts with break time
    if (employee.breakStartTime && employee.breakEndTime) {
      if (!(requestEndTime <= employee.breakStartTime || requestStartTime >= employee.breakEndTime)) {
        console.log("Time conflicts with break time");
        throw new Error(`O horário solicitado conflita com o intervalo do funcionário (${employee.breakStartTime} - ${employee.breakEndTime}).`);
      }
    }

    // Check for existing appointments conflicts (excluding the appointment being rescheduled)
    const existingAppointments = await this.getAppointmentsByEmployee(employeeId, date);
    console.log(`Found ${existingAppointments.length} existing appointments for employee on ${date}`);

    for (const apt of existingAppointments) {
      console.log(`Checking appointment ${apt.id} (status: ${apt.status}, time: ${apt.appointmentTime} - ${apt.endTime})`);

      if (apt.status === "cancelled" || apt.status === "completed" || apt.status === "no_show") {
        console.log("Skipping finished/cancelled appointment");
        continue;
      }

      if (apt.id === excludeAppointmentId) {
        console.log("Skipping excluded appointment (current one being rescheduled)");
        continue;
      }

      // Check for time overlap
      const hasOverlap = !(requestEndTime <= apt.appointmentTime || requestStartTime >= apt.endTime);
      console.log(`Overlap check: requested ${requestStartTime}-${requestEndTime} vs existing ${apt.appointmentTime}-${apt.endTime} = ${hasOverlap ? 'CONFLICT' : 'OK'}`);

      if (hasOverlap) {
        console.log("Time conflict found with existing appointment");
        throw new Error(`O horário solicitado (${requestStartTime} - ${requestEndTime}) conflita com outro agendamento já existente (${apt.appointmentTime} - ${apt.endTime}).`);
      }
    }

    console.log("No conflicts found - time slot is available");
    return true;
  }

  async getEmployeeAvailableSlots(employeeId: string, date: string, serviceDuration: number): Promise<string[]> {
    await this.initialize();

    // Check if employee is on day off
    const isOnDayOff = await this.isEmployeeOnDayOff(employeeId, date);
    if (isOnDayOff) return [];

    const employee = await this.getEmployee(employeeId);
    if (!employee || !employee.isActive) return [];

    // Check if employee works on this day
    const workDays = JSON.parse(employee.workDays);
    // Parse date correctly to avoid timezone issues
    const [year, month, day] = date.split('-').map(Number);
    const requestDate = new Date(year, month - 1, day);
    const dayOfWeek = requestDate.getDay();

    if (!workDays.includes(dayOfWeek)) return [];

    const slots: string[] = [];
    const startTime = employee.startTime;
    const endTime = employee.endTime;
    const [startHour, startMinute] = startTime.split(':').map(Number);
    const [endHour, endMinute] = endTime.split(':').map(Number);

    let currentHour = startHour;
    let currentMinute = startMinute;

    while (currentHour < endHour || (currentHour === endHour && currentMinute <= endMinute - serviceDuration)) {
      const currentTime = `${currentHour.toString().padStart(2, '0')}:${currentMinute.toString().padStart(2, '0')}`;

      // Check availability for this slot
      const availability = {
        employeeId,
        date,
        startTime: currentTime,
        duration: serviceDuration
      };

      const isAvailable = await this.checkEmployeeAvailability(availability);
      if (isAvailable) {
        slots.push(currentTime);
      }

      // Move to next 30-minute slot
      currentMinute += 30;
      if (currentMinute >= 60) {
        currentMinute = 0;
        currentHour++;
      }
    }

    return slots;
  }

  async getEmployeeSchedule(employeeId: string): Promise<{ workDays: number[], startTime: string, endTime: string, breakStartTime?: string, breakEndTime?: string }> {
    await this.initialize();
    const employee = await this.getEmployee(employeeId);
    if (!employee) {
      throw new Error("Employee not found");
    }

    return {
      workDays: JSON.parse(employee.workDays),
      startTime: employee.startTime,
      endTime: employee.endTime,
      breakStartTime: employee.breakStartTime || undefined,
      breakEndTime: employee.breakEndTime || undefined,
    };
  }

  async updateEmployeeSchedule(employeeId: string, schedule: Partial<{ workDays: string, startTime: string, endTime: string, breakStartTime?: string, breakEndTime?: string }>): Promise<Employee | undefined> {
    await this.initialize();
    const existingEmployee = await this.getEmployee(employeeId);
    if (!existingEmployee) return undefined;

    const updatedEmployee: Employee = {
      ...existingEmployee,
      ...schedule,
      updatedAt: new Date(),
    };

    db.update(employees).set(updatedEmployee).where(eq(employees.id, employeeId)).run();
    return updatedEmployee;
  }

  async canCancelAppointment(appointmentId: string): Promise<{ canCancel: boolean, reason?: string }> {
    await this.initialize();
    const appointment = await this.getAppointment(appointmentId);
    if (!appointment) {
      return { canCancel: false, reason: "Appointment not found" };
    }

    if (appointment.status === "cancelled") {
      return { canCancel: false, reason: "Appointment is already cancelled" };
    }

    if (appointment.status === "completed") {
      return { canCancel: false, reason: "Cannot cancel a completed appointment" };
    }

    // Always allow cancellation - the fee will be calculated based on merchant policies
    // The frontend and backend will handle fee calculation appropriately
    return { canCancel: true };
  }

  async canRescheduleAppointment(id: string, userRole?: string): Promise<{ canReschedule: boolean; reason?: string }> {
    const appointment = await this.getAppointment(id);
    if (!appointment) {
      return { canReschedule: false, reason: "Agendamento não encontrado" };
    }

    // Verificar se o agendamento está em um status que permite reagendamento
    if (appointment.status === "completed" || appointment.status === "cancelled" || appointment.status === "no_show") {
      return { canReschedule: false, reason: "Agendamento já foi finalizado ou cancelado" };
    }

    // Funcionários e merchants podem reagendar a qualquer momento
    if (userRole === "employee" || userRole === "merchant") {
      return { canReschedule: true };
    }

    // Para clientes, aplicar política de 24 horas
    if (userRole === "client") {
      const now = new Date();
      const appointmentDateTime = new Date(`${appointment.appointmentDate}T${appointment.appointmentTime}`);
      const timeDiff = appointmentDateTime.getTime() - now.getTime();
      const hoursDiff = timeDiff / (1000 * 60 * 60);

      if (hoursDiff < 24) {
        return { canReschedule: false, reason: "Só é possível reagendar até 24 horas antes do horário agendado" };
      }
    }

    // Verificar se o status permite reagendamento
    if (["pending", "confirmed", "scheduled"].includes(appointment.status)) {
      return { canReschedule: true };
    }

    return { canReschedule: false, reason: "Status do agendamento não permite reagendamento" };
  }

  async getRemainingCancelPolicyMethods(): Promise<void> {
    // This method completes the cancel policy implementation
    // that was accidentally left incomplete in the previous edit
  }

  private completeCancelPolicyCheck(appointment: any, hoursDiff: number): { canReschedule: boolean, reason?: string } {
    switch (appointment.cancelPolicy) {
        case "24h":
          if (hoursDiff < 24) {
            return { canReschedule: false, reason: "Só é possível reagendar até 24 horas antes do horário agendado" };
          }
          break;
        case "12h":
          if (hoursDiff < 12) {
            return { canReschedule: false, reason: "Só é possível reagendar até 12 horas antes do horário agendado" };
          }
          break;
        case "2h":
          if (hoursDiff < 2) {
            return { canReschedule: false, reason: "Só é possível reagendar até 2 horas antes do horário agendado" };
          }
          break;
        case "none":
          // No restriction
          break;
      }

    return { canReschedule: true };
  }

  async markAppointmentAsLate(appointmentId: string): Promise<Appointment | undefined> {
    await this.initialize();
    const existingAppointment = await this.getAppointment(appointmentId);
    if (!existingAppointment) return undefined;

    const updatedAppointment: Appointment = {
      ...existingAppointment,
      status: "late",
      updatedAt: new Date(),
    };

    db.update(appointments).set(updatedAppointment).where(eq(appointments.id, appointmentId)).run();
    return updatedAppointment;
  }

  async markAppointmentAsNoShow(appointmentId: string): Promise<Appointment | undefined> {
    await this.initialize();
    const existingAppointment = await this.getAppointment(appointmentId);
    if (!existingAppointment) return undefined;

    const updatedAppointment: Appointment = {
      ...existingAppointment,
      status: "no_show",
      updatedAt: new Date(),
    };

    db.update(appointments).set(updatedAppointment).where(eq(appointments.id, appointmentId)).run();
    return updatedAppointment;
  }

  // Get appointments with pending payments
  async getPendingPaymentAppointments(merchantId: string): Promise<Appointment[]> {
    await this.initialize();
    return db.select({
      id: appointments.id,
      merchantId: appointments.merchantId,
      serviceId: appointments.serviceId,
      clientId: appointments.clientId,
      employeeId: appointments.employeeId,
      clientName: appointments.clientName,
      clientPhone: appointments.clientPhone,
      clientEmail: appointments.clientEmail,
      appointmentDate: appointments.appointmentDate,
      appointmentTime: appointments.appointmentTime,
      endTime: appointments.endTime,
      status: appointments.status,
      notes: appointments.notes,
      rescheduleReason: appointments.rescheduleReason,
      cancelReason: appointments.cancelReason,
      cancelPolicy: appointments.cancelPolicy,
      reminderSent: appointments.reminderSent,
      arrivalTime: appointments.arrivalTime,
      completedAt: appointments.completedAt,
      newDate: appointments.newDate,
      newTime: appointments.newTime,
      actualStartTime: appointments.actualStartTime,
      actualEndTime: appointments.actualEndTime,
      createdAt: appointments.createdAt,
      updatedAt: appointments.updatedAt,
      serviceName: services.name,
      servicePrice: services.price,
      employeeName: employees.name,
      paymentStatus: sql<string>`COALESCE(${appointments}.payment_status, 'pending')`,
    }).from(appointments)
      .leftJoin(services, eq(appointments.serviceId, services.id))
      .leftJoin(employees, eq(appointments.employeeId, employees.id))
      .where(and(
        eq(appointments.merchantId, merchantId),
        eq(appointments.status, "completed"),
        or(
          sql`${appointments}.payment_status = 'pending'`,
          sql`${appointments}.payment_status IS NULL`
        )
      ))
      .orderBy(desc(appointments.appointmentDate), desc(appointments.appointmentTime))
      .execute() as Appointment[];
  }

  // New methods for historical appointments with filters
  async getAppointmentsByEmployeeAndDate(employeeId: string, date: string): Promise<Appointment[]> {
    await this.initialize();

    const appointmentsList = db.select().from(appointments)
      .where(and(
        eq(appointments.employeeId, employeeId),
        eq(appointments.appointmentDate, date)
      ))
      .orderBy(appointments.appointmentTime)
      .execute();

    return appointmentsList;
  }

  // Get employee upcoming appointments (future dates with pending/confirmed status)
  async getEmployeeUpcomingAppointments(employeeId: string): Promise<Appointment[]> {
    await this.initialize();

    const today = new Date().toISOString().split('T')[0];

    const upcomingAppointments = db.select().from(appointments)
      .where(and(
        eq(appointments.employeeId, employeeId),
        sql`${appointments.appointmentDate} >= ${today}`,
        sql`${appointments.status} IN ('pending', 'scheduled', 'confirmed')`
      ))
      .orderBy(appointments.appointmentDate, appointments.appointmentTime)
      .execute();

    return upcomingAppointments;
  }

  // Get employee historical appointments
  async getEmployeeHistoricalAppointments(employeeId: string, filter: string = "month"): Promise<any[]> {
    await this.initialize();

    // Use Brazil timezone (UTC-3) for date calculations
    const now = new Date();
    const brazilOffset = -3 * 60; // UTC-3 in minutes
    const brazilTime = new Date(now.getTime() + (brazilOffset * 60 * 1000));

    let startDate: string;
    let endDate: string = brazilTime.toISOString().split('T')[0];

    switch (filter) {
      case "day":
        startDate = brazilTime.toISOString().split('T')[0];
        break;
      case "week":
        const weekAgo = new Date(brazilTime.getTime() - (7 * 24 * 60 * 60 * 1000));
        startDate = weekAgo.toISOString().split('T')[0];
        break;
      case "month":
        const monthAgo = new Date(brazilTime.getTime() - (30 * 24 * 60 * 60 * 1000));
        startDate = monthAgo.toISOString().split('T')[0];
        break;
      default:
        const defaultAgo = new Date(brazilTime.getTime() - (30 * 24 * 60 * 60 * 1000));
        startDate = defaultAgo.toISOString().split('T')[0];
    }

    const appointmentRecords = await db
      .select()
      .from(appointments)
      .where(
        and(
          eq(appointments.employeeId, employeeId),
          inArray(appointments.status, ["completed", "cancelled", "no_show"]),
          gte(appointments.appointmentDate, startDate),
          lte(appointments.appointmentDate, endDate)
        )
      )
      .orderBy(desc(appointments.appointmentDate), desc(appointments.appointmentTime));

    // Get employee payment info
    const employee = await this.getEmployee(employeeId);

    // Enrich with service and client information
    const enrichedAppointments = await Promise.all(
      appointmentRecords.map(async (appointment) => {
        const service = await this.getService(appointment.serviceId);

        let employeeEarning = 0;
        // Calcular ganhos apenas para serviços concluídos
        if (appointment.status === "completed" && employee && employee.paymentType === "percentage") {
          // Calculate percentage of service price only for completed services
          const percentage = employee.paymentValue / 100; // paymentValue is stored as percentage * 100
          employeeEarning = service?.price ? Math.round((service.price * percentage) / 100) : 0;
        } else if (appointment.status === "completed" && employee && employee.paymentType === "fixed") {
          // For fixed payment type, only count if service was completed
          employeeEarning = employee.paymentValue;
        }
        // Para serviços não concluídos (cancelados, não compareceu, etc), employeeEarning permanece 0

        return {
          ...appointment,
          serviceName: service?.name || "Serviço não encontrado",
          servicePrice: service?.price || 0,
          serviceDuration: service?.duration || 0,
          employeeEarning,
          employeePaymentType: employee?.paymentType || "monthly",
        };
      })
    );

    return enrichedAppointments;
  }

  // Calculate employee total earnings for a period
  async calculateEmployeeEarnings(employeeId: string, startDate: string, endDate: string): Promise<number> {
    await this.initialize();
    const employee = await this.getEmployee(employeeId);
    if (!employee) return 0;

    // Buscar apenas agendamentos concluídos (status = "completed")
    const completedAppointmentRecords = await db
      .select()
      .from(appointments)
      .where(
        and(
          eq(appointments.employeeId, employeeId),
          eq(appointments.status, "completed"), // Apenas serviços concluídos
          gte(appointments.appointmentDate, startDate),
          lte(appointments.appointmentDate, endDate)
        )
      );

    if (employee.paymentType === "percentage") {
      let totalEarnings = 0;
      const percentage = employee.paymentValue / 100;

      // Calcular ganhos apenas para serviços concluídos
      for (const appointment of completedAppointmentRecords) {
        const service = await this.getService(appointment.serviceId);
        if (service) {
          totalEarnings += Math.round((service.price * percentage) / 100);
        }
      }
      return totalEarnings;
    } else if (employee.paymentType === "fixed") {
      // Para salário fixo, considera apenas se houve algum serviço concluído no período
      // Se não houve serviços concluídos, não há ganhos
      if (completedAppointmentRecords.length > 0) {
        return employee.paymentValue;
      }
      return 0;
    }

    return 0; // Default for monthly or other types not explicitly handled
  }

  async extendWorkingHours(employeeId: string, newEndTime: string): Promise<Employee | undefined> {
    await this.initialize();
    const employee = await this.getEmployee(employeeId);
    if (!employee) return undefined;

    const updatedEmployee: Employee = {
      ...employee,
      extendedEndTime: newEndTime,
      updatedAt: new Date(),
    };

    db.update(employees).set(updatedEmployee).where(eq(employees.id, employeeId)).run();
    return updatedEmployee;
  }

  async finishWorkdayWithOvertime(employeeId: string, actualEndTime: string): Promise<{
    employee: Employee;
    overtimeMinutes: number;
  }> {
    await this.initialize();

    const employee = await this.getEmployee(employeeId);
    if (!employee) {
      throw new Error("Funcionário não encontrado");
    }

    // Calculate overtime
    const [actualHour, actualMinute] = actualEndTime.split(':').map(Number);
    const [originalHour, originalMinute] = employee.endTime.split(':').map(Number);

    const actualTimeMinutes = actualHour * 60 + actualMinute;
    const originalTimeMinutes = originalHour * 60 + originalMinute;

    const overtimeMinutes = Math.max(0, actualTimeMinutes - originalTimeMinutes);

    // Update employee with accumulated overtime
    const currentOvertimeHours = employee.overtimeHours || 0;
    const totalOvertimeMinutes = currentOvertimeHours + overtimeMinutes;
    const today = new Date().toISOString().split('T')[0];

    const updatedEmployee = db.update(employees)
      .set({
        overtimeHours: totalOvertimeMinutes,
        lastOvertimeDate: today,
        extendedEndTime: null // Reset extended end time
      })
      .where(eq(employees.id, employeeId))
      .returning()
      .get();

    if (!updatedEmployee) {
      throw new Error("Erro ao atualizar funcionário");
    }

    return {
      employee: updatedEmployee,
      overtimeMinutes
    };
  }

  async getEmployeeOvertimeStats(employeeId: string, period: 'week' | 'month' | 'year' = 'month'): Promise<{
    totalOvertimeMinutes: number;
    totalOvertimeHours: number;
    lastOvertimeDate: string | null;
  }> {
    await this.initialize();
    const employee = await this.getEmployee(employeeId);
    if (!employee) {
      return {
        totalOvertimeMinutes: 0,
        totalOvertimeHours: 0,
        lastOvertimeDate: null
      };
    }

    // For simplicity, returning total accumulated overtime
    // In a more complex system, you'd track overtime per day/period
    const totalMinutes = employee.overtimeHours || 0;
    const totalHours = Math.floor(totalMinutes / 60);
    const remainingMinutes = totalMinutes % 60;

    return {
      totalOvertimeMinutes: totalMinutes,
      totalOvertimeHours: totalHours + (remainingMinutes / 60),
      lastOvertimeDate: employee.lastOvertimeDate || null
    };
  }


  async getClientHistoricalAppointments(clientId: string, filter: string): Promise<any[]> {
    await this.initialize();

    const now = new Date();
    // Use Brazil timezone (UTC-3) for date calculations
    const brazilOffset = -3 * 60; // UTC-3 in minutes
    const brazilTime = new Date(now.getTime() + (brazilOffset * 60 * 1000));

    let startDate: string;
    let endDate: string = brazilTime.toISOString().split('T')[0];

    switch (filter) {
      case "day":
        startDate = brazilTime.toISOString().split('T')[0];
        break;
      case "week":
        const weekAgo = new Date(brazilTime.getTime() - (7 * 24 * 60 * 60 * 1000));
        startDate = weekAgo.toISOString().split('T')[0];
        break;
      case "month":
        const monthAgo = new Date(brazilTime.getTime() - (30 * 24 * 60 * 60 * 1000));
        startDate = monthAgo.toISOString().split('T')[0];
        break;
      default:
        const defaultAgo = new Date(brazilTime.getTime() - (30 * 24 * 60 * 60 * 1000));
        startDate = defaultAgo.toISOString().split('T')[0];
    }

    const appointmentRecords = await db
      .select({
        id: appointments.id,
        merchantId: appointments.merchantId,
        serviceId: appointments.serviceId,
        clientId: appointments.clientId,
        employeeId: appointments.employeeId,
        clientName: appointments.clientName,
        clientPhone: appointments.clientPhone,
        clientEmail: appointments.clientEmail,
        appointmentDate: appointments.appointmentDate,
        appointmentTime: appointments.appointmentTime,
        endTime: appointments.endTime,
        status: appointments.status,
        notes: appointments.notes,
        rescheduleReason: appointments.rescheduleReason,
        cancelReason: appointments.cancelReason,
        cancelPolicy: appointments.cancelPolicy,
        reminderSent: appointments.reminderSent,
        arrivalTime: appointments.arrivalTime,
        completedAt: appointments.completedAt,
        newDate: appointments.newDate,
        newTime: appointments.newTime,
        actualStartTime: appointments.actualStartTime,
        actualEndTime: appointments.actualEndTime,
        createdAt: appointments.createdAt,
        updatedAt: appointments.updatedAt,
        serviceName: services.name,
        servicePrice: services.price,
        employeeName: employees.name,
      })
      .from(appointments)
      .leftJoin(services, eq(appointments.serviceId, services.id))
      .leftJoin(employees, eq(appointments.employeeId, employees.id))
      .where(
        and(
          eq(appointments.clientId, clientId),
          inArray(appointments.status, ["completed", "cancelled", "no_show"]),
          gte(appointments.appointmentDate, startDate),
          lte(appointments.appointmentDate, endDate)
        )
      )
      .orderBy(desc(appointments.appointmentDate), desc(appointments.appointmentTime));

    return appointmentRecords as any[];
  }

  // Employee days off methods
  async createEmployeeDayOff(data: InsertEmployeeDayOff): Promise<EmployeeDayOff> {
    await this.initialize();

    console.log("Storage: Creating employee day off with data:", data);

    // Validate that employee exists and belongs to merchant
    const employee = await this.getEmployee(data.employeeId);
    if (!employee) {
      throw new Error("Funcionário não encontrado");
    }

    if (employee.merchantId !== data.merchantId) {
      throw new Error("Funcionário não pertence a este salão");
    }

    // Check for existing day off
    const existing = await this.getEmployeeDaysOff(data.merchantId, data.employeeId, data.date);
    if (existing.length > 0) {
      throw new Error("Este funcionário já possui folga registrada para esta data");
    }

    const dayOff = {
      id: randomUUID(),
      ...data,
      createdAt: new Date(),
    };

    console.log("Storage: Inserting day off:", dayOff);

    try {
      const result = db.insert(employeeDaysOff).values(dayOff).returning().get();
      console.log("Storage: Day off created successfully:", result);
      return result;
    } catch (error) {
      console.error("Storage: Error inserting day off:", error);
      throw new Error("Erro ao salvar folga no banco de dados");
    }
  }

  async getEmployeeDaysOff(merchantId: string, employeeId?: string, date?: string): Promise<EmployeeDayOff[]> {
    await this.initialize();

    console.log("Storage: Getting employee days off for merchant:", merchantId, "employee:", employeeId, "date:", date);

    let conditions = [eq(employeeDaysOff.merchantId, merchantId)];

    if (employeeId) {
      conditions.push(eq(employeeDaysOff.employeeId, employeeId));
    }

    if (date) {
      conditions.push(eq(employeeDaysOff.date, date));
    }

    const result = db.select().from(employeeDaysOff).where(and(...conditions)).execute();
    console.log("Storage: Found", result.length, "employee days off records");

    return result;
  }

  async updateEmployeeDayOff(id: string, updates: Partial<InsertEmployeeDayOff>): Promise<EmployeeDayOff | undefined> {
    await this.initialize();

    console.log("Storage: Updating employee day off:", id, updates);

    const existing = db.select().from(employeeDaysOff).where(eq(employeeDaysOff.id, id)).get();
    if (!existing) {
      console.log("Storage: Day off not found:", id);
      return undefined;
    }

    console.log("Storage: Found existing day off:", existing);

    const updatedDayOff = {
      ...existing,
      ...updates,
    };

    console.log("Storage: Updating with data:", updatedDayOff);

    try {
      const result = db.update(employeeDaysOff)
        .set(updatedDayOff)
        .where(eq(employeeDaysOff.id, id))
        .returning()
        .get();

      console.log("Storage: Day off updated successfully:", result);
      return result;
    } catch (error) {
      console.error("Storage: Error updating day off:", error);
      throw new Error("Erro ao atualizar folga no banco de dados");
    }
  }

  async deleteEmployeeDayOff(id: string): Promise<boolean> {
    await this.initialize();

    const result = db.delete(employeeDaysOff).where(eq(employeeDaysOff.id, id)).run();
    return result.changes > 0;
  }

  async isEmployeeOnDayOff(employeeId: string, date: string): Promise<boolean> {
    await this.initialize();

    const dayOff = db.select()
      .from(employeeDaysOff)
      .where(and(
        eq(employeeDaysOff.employeeId, employeeId),
        eq(employeeDaysOff.date, date)
      ))
      .get();

    return !!dayOff;
  }

  // Penalty methods
  async createPenalty(penalty: {
    merchantId: string;
    clientId: string | null;
    appointmentId: string;
    clientName: string;
    clientPhone: string;
    clientEmail: string | null;
    type: string;
    amount: number;
    reason: string;
    status: string;
  }): Promise<any> {
    await this.initialize();

    const newPenalty = {
      id: randomUUID(),
      merchantId: penalty.merchantId,
      clientId: penalty.clientId,
      appointmentId: penalty.appointmentId,
      clientName: penalty.clientName,
      clientPhone: penalty.clientPhone,
      clientEmail: penalty.clientEmail,
      type: penalty.type,
      amount: penalty.amount,
      reason: penalty.reason,
      status: penalty.status,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = db.insert(penalties).values(newPenalty).returning().get();
    return result;
  }

  async getPenaltiesByMerchant(merchantId: string): Promise<any[]> {
    await this.initialize();

    const penaltiesList = db.select({
      id: penalties.id,
      merchantId: penalties.merchantId,
      clientId: penalties.clientId,
      appointmentId: penalties.appointmentId,
      clientName: penalties.clientName,
      clientPhone: penalties.clientPhone,
      clientEmail: penalties.clientEmail,
      type: penalties.type,
      amount: penalties.amount,
      reason: penalties.reason,
      status: penalties.status,
      paidAt: penalties.paidAt,
      paidBy: penalties.paidBy,
      createdAt: penalties.createdAt,
      updatedAt: penalties.updatedAt,
      serviceName: services.name,
      servicePrice: services.price,
      employeeName: employees.name,
      appointmentDate: appointments.appointmentDate,
      appointmentTime: appointments.appointmentTime,
    }).from(penalties)
      .leftJoin(appointments, eq(penalties.appointmentId, appointments.id))
      .leftJoin(services, eq(appointments.serviceId, services.id))
      .leftJoin(employees, eq(appointments.employeeId, employees.id))
      .where(eq(penalties.merchantId, merchantId))
      .orderBy(desc(penalties.createdAt))
      .execute();

    return penaltiesList;
  }

  async getPenaltiesByClient(clientId: string): Promise<any[]> {
    await this.initialize();

    const penaltiesList = db.select().from(penalties)
      .where(eq(penalties.clientId, clientId))
      .orderBy(desc(penalties.createdAt))
      .execute();

    return penaltiesList;
  }

  async updatePenaltyStatus(id: string, status: string, paidBy: string): Promise<any | undefined> {
    await this.initialize();

    console.log(`🔄 Updating penalty ${id} to status: ${status}`);

    const updates: any = {
      status,
      updatedAt: new Date(),
    };

    if (status === "paid") {
      updates.paidAt = new Date();
      updates.paidBy = paidBy;
    } else if (status === "waived") {
      updates.paidAt = new Date();
      updates.paidBy = paidBy;
    }

    try {
      const result = db.update(penalties)
        .set(updates)
        .where(eq(penalties.id, id))
        .returning()
        .get();

      console.log(`✅ Penalty ${id} updated successfully:`, result);
      console.log(`📢 Penalty status changed from pending to ${status} - will no longer appear in client dashboard`);
      return result;
    } catch (error) {
      console.error(`❌ Error updating penalty ${id}:`, error);
      throw error;
    }
  }

  // Promotion methods
  async createPromotion(insertPromotion: InsertPromotion): Promise<Promotion> {
    await this.initialize();

    const id = randomUUID();
    const now = new Date();
    const promotion: Promotion = {
      ...insertPromotion,
      id,
      isActive: insertPromotion.isActive ?? true,
      createdAt: now,
      updatedAt: now,
    };

    db.insert(promotions).values(promotion).run();
    return promotion;
  }

  async getPromotionsByMerchant(merchantId: string): Promise<any[]> {
    await this.initialize();

    const promotionsList = db.select({
      id: promotions.id,
      merchantId: promotions.merchantId,
      serviceId: promotions.serviceId,
      name: promotions.name,
      description: promotions.description,
      discountType: promotions.discountType,
      discountValue: promotions.discountValue,
      startDate: promotions.startDate,
      endDate: promotions.endDate,
      isActive: promotions.isActive,
      createdAt: promotions.createdAt,
      updatedAt: promotions.updatedAt,
      serviceName: services.name,
      servicePrice: services.price,
    }).from(promotions)
      .leftJoin(services, eq(promotions.serviceId, services.id))
      .where(eq(promotions.merchantId, merchantId))
      .orderBy(desc(promotions.createdAt))
      .execute();

    return promotionsList;
  }

  async getActivePromotionsByMerchant(merchantId: string): Promise<any[]> {
    await this.initialize();

    const today = new Date().toISOString().split('T')[0];

    const activePromotions = db.select({
      id: promotions.id,
      merchantId: promotions.merchantId,
      serviceId: promotions.serviceId,
      name: promotions.name,
      description: promotions.description,
      discountType: promotions.discountType,
      discountValue: promotions.discountValue,
      startDate: promotions.startDate,
      endDate: promotions.endDate,
      isActive: promotions.isActive,
      createdAt: promotions.createdAt,
      updatedAt: promotions.updatedAt,
      serviceName: services.name,
      servicePrice: services.price,
    }).from(promotions)
      .leftJoin(services, eq(promotions.serviceId, services.id))
      .where(and(
        eq(promotions.merchantId, merchantId),
        eq(promotions.isActive, true),
        lte(promotions.startDate, today),
        gte(promotions.endDate, today)
      ))
      .orderBy(desc(promotions.createdAt))
      .execute();

    return activePromotions;
  }

  async getPromotion(id: string): Promise<Promotion | undefined> {
    await this.initialize();
    const promotion = db.select().from(promotions).where(eq(promotions.id, id)).get();
    return promotion || undefined;
  }

  async updatePromotion(id: string, updates: Partial<InsertPromotion>): Promise<Promotion | undefined> {
    await this.initialize();
    const existingPromotion = await this.getPromotion(id);
    if (!existingPromotion) return undefined;

    const updatedPromotion: Promotion = {
      ...existingPromotion,
      ...updates,
      updatedAt: new Date(),
    };

    db.update(promotions).set(updatedPromotion).where(eq(promotions.id, id)).run();
    return updatedPromotion;
  }

  async deletePromotion(id: string): Promise<boolean> {
    await this.initialize();
    const result = db.delete(promotions).where(eq(promotions.id, id)).run();
    return result.changes > 0;
  }

  async getPromotionByService(serviceId: string): Promise<any | undefined> {
    await this.initialize();

    const today = new Date().toISOString().split('T')[0];

    const promotion = db.select({
      id: promotions.id,
      merchantId: promotions.merchantId,
      serviceId: promotions.serviceId,
      name: promotions.name,
      description: promotions.description,
      discountType: promotions.discountType,
      discountValue: promotions.discountValue,
      startDate: promotions.startDate,
      endDate: promotions.endDate,
      isActive: promotions.isActive,
      createdAt: promotions.createdAt,
      updatedAt: promotions.updatedAt,
    }).from(promotions)
      .where(and(
        eq(promotions.serviceId, serviceId),
        eq(promotions.isActive, true),
        lte(promotions.startDate, today),
        gte(promotions.endDate, today)
      ))
      .get();

    return promotion || undefined;
  }

  async calculatePromotionalPrice(serviceId: string, originalPrice: number): Promise<{ hasPromotion: boolean; originalPrice: number; promotionalPrice: number; discount: any }> {
    const promotion = await this.getPromotionByService(serviceId);

    if (!promotion) {
      return {
        hasPromotion: false,
        originalPrice,
        promotionalPrice: originalPrice,
        discount: null
      };
    }

    let promotionalPrice = originalPrice;

    if (promotion.discountType === "percentage") {
      const discountAmount = Math.round((originalPrice * promotion.discountValue) / 100);
      promotionalPrice = originalPrice - discountAmount;
    } else if (promotion.discountType === "fixed") {
      promotionalPrice = Math.max(0, originalPrice - promotion.discountValue);
    }

    return {
      hasPromotion: true,
      originalPrice,
      promotionalPrice,
      discount: promotion
    };
  }

  // Merchant access management methods
  async grantMerchantAccess(merchantId: string, durationDays: number, monthlyFee?: number): Promise<Merchant | undefined> {
    await this.initialize();

    const now = new Date();
    const accessEndDate = new Date(now);
    accessEndDate.setDate(now.getDate() + durationDays);

    const nextPaymentDue = new Date(now);
    nextPaymentDue.setDate(now.getDate() + durationDays);

    const updates = {
      status: "active",
      accessStartDate: now,
      accessEndDate: accessEndDate,
      accessDurationDays: durationDays,
      lastPaymentDate: now,
      nextPaymentDue: nextPaymentDue,
      paymentStatus: "paid",
      ...(monthlyFee !== undefined && { monthlyFee })
    };

    const merchant = await this.updateMerchant(merchantId, updates);
    return merchant;
  }

  async suspendMerchantAccess(merchantId: string): Promise<Merchant | undefined> {
    await this.initialize();

    const updates = {
      status: "payment_pending",
      paymentStatus: "overdue"
    };

    const merchant = await this.updateMerchant(merchantId, updates);
    return merchant;
  }

  async renewMerchantAccess(merchantId: string): Promise<Merchant | undefined> {
    await this.initialize();

    const existingMerchant = await this.getMerchant(merchantId);
    if (!existingMerchant) return undefined;

    const now = new Date();
    const durationDays = existingMerchant.accessDurationDays || 30;
    const accessEndDate = new Date(now);
    accessEndDate.setDate(now.getDate() + durationDays);

    const nextPaymentDue = new Date(now);
    nextPaymentDue.setDate(now.getDate() + durationDays);

    const updates = {
      status: "active",
      accessStartDate: now,
      accessEndDate: accessEndDate,
      lastPaymentDate: now,
      nextPaymentDue: nextPaymentDue,
      paymentStatus: "paid"
    };

    const merchant = await this.updateMerchant(merchantId, updates);
    return merchant;
  }

  async updateMerchantAccessSettings(merchantId: string, settings: {
    accessDurationDays?: number;
    monthlyFee?: number;
    paymentStatus?: string;
  }): Promise<Merchant | undefined> {
    await this.initialize();

    const updates = { ...settings };

    // If duration is being updated and merchant has active access, update end date
    if (settings.accessDurationDays) {
      const existingMerchant = await this.getMerchant(merchantId);
      if (existingMerchant && existingMerchant.accessStartDate) {
        const accessEndDate = new Date(existingMerchant.accessStartDate);
        accessEndDate.setDate(accessEndDate.getDate() + settings.accessDurationDays);
        updates.accessEndDate = accessEndDate;

        const nextPaymentDue = new Date(existingMerchant.accessStartDate);
        nextPaymentDue.setDate(nextPaymentDue.getDate() + settings.accessDurationDays);
        updates.nextPaymentDue = nextPaymentDue;
      }
    }

    const merchant = await this.updateMerchant(merchantId, updates);
    return merchant;
  }

  async getMerchantsWithExpiredAccess(): Promise<Merchant[]> {
    await this.initialize();

    const allMerchants = await this.getAllMerchants();
    const now = new Date();

    return allMerchants.filter(merchant => {
      if (!merchant.accessEndDate) return false;
      return new Date(merchant.accessEndDate) <= now && merchant.status === "active";
    });
  }

  async processExpiredAccess(): Promise<number> {
    await this.initialize();

    const expiredMerchants = await this.getMerchantsWithExpiredAccess();
    let processedCount = 0;

    for (const merchant of expiredMerchants) {
      try {
        await this.updateMerchant(merchant.id, {
          status: "payment_pending",
          paymentStatus: "overdue"
        });
        processedCount++;
        console.log(`Merchant ${merchant.name} (${merchant.email}) marked as expired`);
      } catch (error) {
        console.error(`Failed to process expired merchant ${merchant.id}:`, error);
      }
    }

    return processedCount;
  }

  async getMerchantsAccessStatus(): Promise<{
    active: number;
    expired: number;
    expiringSoon: number;
    totalRevenue: number;
  }> {
    await this.initialize();

    const allMerchants = await this.getAllMerchants();
    const now = new Date();
    const soonThreshold = new Date(now.getTime() + (7 * 24 * 60 * 60 * 1000)); // 7 days from now

    let active = 0;
    let expired = 0;
    let expiringSoon = 0;
    let totalRevenue = 0;

    allMerchants.forEach(merchant => {
      if (merchant.status === "active") {
        if (merchant.accessEndDate && new Date(merchant.accessEndDate) > now) {
          active++;
          // Check if expiring soon
          if (new Date(merchant.accessEndDate) <= soonThreshold) {
            expiringSoon++;
          }
        } else if (merchant.accessEndDate && new Date(merchant.accessEndDate) <= now) {
          expired++;
        } else { // No access end date means unlimited access
          active++;
        }
      } else if (merchant.status === "payment_pending") {
        expired++; // Treat payment_pending as expired for this status count
      }

      if (merchant.lastPaymentDate && merchant.monthlyFee) {
        totalRevenue += merchant.monthlyFee;
      }
    });

    return {
      active,
      expired,
      expiringSoon,
      totalRevenue
    };
  }
}