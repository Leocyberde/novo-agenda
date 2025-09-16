import { type User, type InsertUser, type Merchant, type InsertMerchant, type Service, type InsertService, type Employee, type InsertEmployee, type Client, type InsertClient, type Appointment, type InsertAppointment, type AvailabilityData, type AppointmentStatusData } from "@shared/schema";
import { randomUUID } from "crypto";
import bcrypt from "bcrypt";

export interface IStorage {
  // User methods
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUserPassword(id: string, newPassword: string): Promise<boolean>;

  // Merchant methods
  getMerchant(id: string): Promise<Merchant | undefined>;
  getMerchantByEmail(email: string): Promise<Merchant | undefined>;
  getAllMerchants(): Promise<Merchant[]>;
  createMerchant(merchant: InsertMerchant): Promise<Merchant>;
  updateMerchant(id: string, updates: Partial<InsertMerchant>): Promise<Merchant | undefined>;
  updateMerchantPassword(id: string, newPassword: string): Promise<boolean>;
  deleteMerchant(id: string): Promise<boolean>;
  getMerchantsByStatus(status: string): Promise<Merchant[]>;
  getMerchantsStats(): Promise<{
    total: number;
    active: number;
    pending: number;
    inactive: number;
    thisMonth: number;
  }>;

  // Service methods
  getService(id: string): Promise<Service | undefined>;
  getServicesByMerchant(merchantId: string): Promise<Service[]>;
  getActiveServicesByMerchant(merchantId: string): Promise<Service[]>;
  createService(service: InsertService): Promise<Service>;
  updateService(id: string, updates: Partial<InsertService>): Promise<Service | undefined>;
  deleteService(id: string): Promise<boolean>;

  // Employee methods
  getEmployee(id: string): Promise<Employee | undefined>;
  getEmployeeByEmail(email: string): Promise<Employee | undefined>;
  getEmployeesByMerchant(merchantId: string): Promise<Employee[]>;
  getActiveEmployeesByMerchant(merchantId: string): Promise<Employee[]>;
  createEmployee(employee: InsertEmployee): Promise<Employee>;
  updateEmployee(id: string, updates: Partial<InsertEmployee>): Promise<Employee | undefined>;
  updateEmployeePassword(id: string, newPassword: string): Promise<boolean>;
  deleteEmployee(id: string): Promise<boolean>;

  // Client methods
  getClient(id: string): Promise<Client | undefined>;
  getClientByEmail(email: string): Promise<Client | undefined>;
  getClientsByMerchant(merchantId: string): Promise<Client[]>;
  getActiveClientsByMerchant(merchantId: string): Promise<Client[]>;
  createClient(client: InsertClient): Promise<Client>;
  updateClient(id: string, updates: Partial<InsertClient>): Promise<Client | undefined>;
  updateClientPassword(id: string, newPassword: string): Promise<boolean>;
  deleteClient(id: string): Promise<boolean>;

  // Appointment methods
  getAppointment(id: string): Promise<Appointment | undefined>;
  getAppointmentsByMerchant(merchantId: string): Promise<Appointment[]>;
  getAppointmentsByDate(merchantId: string, date: string): Promise<Appointment[]>;
  getAppointmentsByDateRange(merchantId: string, startDate: string, endDate: string): Promise<Appointment[]>;
  getAppointmentsByEmployee(employeeId: string, date?: string): Promise<Appointment[]>;
  getClientAppointments(clientId: string, merchantId: string): Promise<Appointment[]>;
  getClientAppointmentsByDate(clientId: string, merchantId: string, date: string): Promise<Appointment[]>;
  getClientAppointmentsByDateRange(clientId: string, merchantId: string, startDate: string, endDate: string): Promise<Appointment[]>;
  getPendingPaymentAppointments(merchantId: string): Promise<Appointment[]>;
  createAppointment(appointment: InsertAppointment): Promise<Appointment>;
  updateAppointment(id: string, updates: Partial<InsertAppointment>): Promise<Appointment | undefined>;
  updateAppointmentStatus(id: string, statusUpdate: AppointmentStatusData): Promise<Appointment | undefined>;
  rescheduleAppointment(id: string, newDate: string, newTime: string, reason: string): Promise<Appointment | undefined>;
  cancelAppointment(id: string, reason: string): Promise<Appointment | undefined>;
  deleteAppointment(id: string): Promise<boolean>;
  deleteAppointmentsByService(serviceId: string): Promise<number>;

  // Availability and scheduling methods
  checkEmployeeAvailability(availability: AvailabilityData): Promise<boolean>;
  getEmployeeAvailableSlots(employeeId: string, date: string, serviceDuration: number): Promise<string[]>;
  getEmployeeSchedule(employeeId: string): Promise<{ workDays: number[], startTime: string, endTime: string, breakStartTime?: string, breakEndTime?: string }>;
  updateEmployeeSchedule(employeeId: string, schedule: Partial<{ workDays: string, startTime: string, endTime: string, breakStartTime?: string, breakEndTime?: string }>): Promise<Employee | undefined>;
  updateEmployeeDayOff(id: string, updates: Partial<{ date: string, reason: string, employeeId: string }>): Promise<{ id: string, date: string, reason: string, employeeId: string } | undefined>;

  // Business rules validation
  canCancelAppointment(appointmentId: string): Promise<{ canCancel: boolean, reason?: string }>;
  canRescheduleAppointment(appointmentId: string): Promise<{ canReschedule: boolean, reason?: string }>;
  markAppointmentAsLate(appointmentId: string): Promise<Appointment | undefined>;
  markAppointmentAsNoShow(appointmentId: string): Promise<Appointment | undefined>;
  getMerchantDashboardStats(merchantId: string): Promise<{
    appointments: {
      today: number;
      thisWeek: number;
      thisMonth: number;
    };
    services: {
      total: number;
      active: number;
    };
  }>;
  getClientHistoricalAppointments(clientId: string, filter: string): Promise<any[]>;

  // Penalty methods
  createPenalty(penalty: {
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
  }): Promise<any>;
  getPenaltiesByMerchant(merchantId: string): Promise<any[]>;
  updatePenaltyStatus(id: string, status: string, paidBy: string): Promise<any | undefined>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private merchants: Map<string, Merchant>;
  private services: Map<string, Service>;
  private employees: Map<string, Employee>;
  private clients: Map<string, Client>;
  private appointments: Map<string, Appointment>;

  constructor() {
    this.users = new Map();
    this.merchants = new Map();
    this.services = new Map();
    this.employees = new Map();
    this.clients = new Map();
    this.appointments = new Map();
    this.initializeAdminUser();
  }

  private async initializeAdminUser() {
    const adminEmail = "leolulu842@gmail.com";
    const existingAdmin = Array.from(this.users.values()).find(u => u.email === adminEmail);

    if (!existingAdmin) {
      const hashedPassword = await bcrypt.hash("123456", 10);
      const adminUser: User = {
        id: randomUUID(),
        email: adminEmail,
        password: hashedPassword,
        role: "admin",
        createdAt: new Date(),
      };
      this.users.set(adminUser.id, adminUser);
    }
  }

  // User methods
  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(user => user.email === email);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const hashedPassword = await bcrypt.hash(insertUser.password, 10);
    const id = randomUUID();
    const user: User = {
      ...insertUser,
      id,
      password: hashedPassword,
      role: insertUser.role || "merchant",
      createdAt: new Date(),
    };
    this.users.set(id, user);
    return user;
  }

  async updateUserPassword(id: string, newPassword: string): Promise<boolean> {
    const user = this.users.get(id);
    if (!user) return false;

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    const updatedUser: User = {
      ...user,
      password: hashedPassword,
    };
    this.users.set(id, updatedUser);
    return true;
  }

  // Merchant methods
  async getMerchant(id: string): Promise<Merchant | undefined> {
    return this.merchants.get(id);
  }

  async getMerchantByEmail(email: string): Promise<Merchant | undefined> {
    return Array.from(this.merchants.values()).find(merchant => merchant.email === email);
  }

  async getAllMerchants(): Promise<Merchant[]> {
    return Array.from(this.merchants.values()).sort((a, b) => 
      new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime()
    );
  }

  async createMerchant(insertMerchant: InsertMerchant): Promise<Merchant> {
    const id = randomUUID();
    const now = new Date();
    const merchant: Merchant = {
      ...insertMerchant,
      id,
      status: insertMerchant.status || "pending",
      createdAt: now,
      updatedAt: now,
    };
    this.merchants.set(id, merchant);
    return merchant;
  }

  async updateMerchant(id: string, updates: Partial<InsertMerchant>): Promise<Merchant | undefined> {
    const merchant = this.merchants.get(id);
    if (!merchant) return undefined;

    const updatedMerchant: Merchant = {
      ...merchant,
      ...updates,
      updatedAt: new Date(),
    };
    this.merchants.set(id, updatedMerchant);
    return updatedMerchant;
  }

  async updateMerchantPassword(id: string, newPassword: string): Promise<boolean> {
    const merchant = this.merchants.get(id);
    if (!merchant) return false;

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    const updatedMerchant: Merchant = {
      ...merchant,
      password: hashedPassword,
      updatedAt: new Date(),
    };
    this.merchants.set(id, updatedMerchant);
    return true;
  }

  async deleteMerchant(id: string): Promise<boolean> {
    return this.merchants.delete(id);
  }

  async getMerchantsByStatus(status: string): Promise<Merchant[]> {
    return Array.from(this.merchants.values()).filter(merchant => merchant.status === status);
  }

  async getMerchantsStats(): Promise<{
    total: number;
    active: number;
    pending: number;
    inactive: number;
    thisMonth: number;
  }> {
    const merchants = Array.from(this.merchants.values());
    const now = new Date();
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    return {
      total: merchants.length,
      active: merchants.filter(m => m.status === "active").length,
      pending: merchants.filter(m => m.status === "pending").length,
      inactive: merchants.filter(m => m.status === "inactive").length,
      thisMonth: merchants.filter(m => new Date(m.createdAt!) >= thisMonth).length,
    };
  }

  // Service methods
  async getService(id: string): Promise<Service | undefined> {
    return this.services.get(id);
  }

  async getServicesByMerchant(merchantId: string): Promise<Service[]> {
    return Array.from(this.services.values()).filter(service => service.merchantId === merchantId);
  }

  async getActiveServicesByMerchant(merchantId: string): Promise<Service[]> {
    return Array.from(this.services.values()).filter(service => 
      service.merchantId === merchantId && service.isActive
    );
  }

  async createService(insertService: InsertService): Promise<Service> {
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
    this.services.set(id, service);
    return service;
  }

  async updateService(id: string, updates: Partial<InsertService>): Promise<Service | undefined> {
    const service = this.services.get(id);
    if (!service) return undefined;

    const updatedService: Service = {
      ...service,
      ...updates,
      updatedAt: new Date(),
    };
    this.services.set(id, updatedService);
    return updatedService;
  }

  async deleteService(id: string): Promise<boolean> {
    return this.services.delete(id);
  }

  // Employee methods
  async getEmployee(id: string): Promise<Employee | undefined> {
    return this.employees.get(id);
  }

  async getEmployeeByEmail(email: string): Promise<Employee | undefined> {
    return Array.from(this.employees.values()).find(employee => employee.email === email);
  }

  async getEmployeesByMerchant(merchantId: string): Promise<Employee[]> {
    return Array.from(this.employees.values()).filter(employee => employee.merchantId === merchantId);
  }

  async getActiveEmployeesByMerchant(merchantId: string): Promise<Employee[]> {
    return Array.from(this.employees.values()).filter(employee => 
      employee.merchantId === merchantId && employee.isActive
    );
  }

  async createEmployee(insertEmployee: InsertEmployee): Promise<Employee> {
    const hashedPassword = await bcrypt.hash(insertEmployee.password, 10);
    const id = randomUUID();
    const now = new Date();
    const employee: Employee = {
      ...insertEmployee,
      id,
      password: hashedPassword,
      role: insertEmployee.role || "employee",
      specialties: insertEmployee.specialties || null,
      workDays: insertEmployee.workDays || "[1,2,3,4,5,6]",
      startTime: insertEmployee.startTime || "09:00",
      endTime: insertEmployee.endTime || "18:00",
      breakStartTime: insertEmployee.breakStartTime || null,
      breakEndTime: insertEmployee.breakEndTime || null,
      isActive: insertEmployee.isActive ?? true,
      createdAt: now,
      updatedAt: now,
    };
    this.employees.set(id, employee);
    return employee;
  }

  async updateEmployee(id: string, updates: Partial<InsertEmployee>): Promise<Employee | undefined> {
    const employee = this.employees.get(id);
    if (!employee) return undefined;

    const processedUpdates = { ...updates };
    if (processedUpdates.password) {
      processedUpdates.password = await bcrypt.hash(processedUpdates.password, 10);
    }

    const updatedEmployee: Employee = {
      ...employee,
      ...processedUpdates,
      updatedAt: new Date(),
    };
    this.employees.set(id, updatedEmployee);
    return updatedEmployee;
  }

  async updateEmployeePassword(id: string, newPassword: string): Promise<boolean> {
    const employee = this.employees.get(id);
    if (!employee) return false;

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    const updatedEmployee: Employee = {
      ...employee,
      password: hashedPassword,
      updatedAt: new Date(),
    };
    this.employees.set(id, updatedEmployee);
    return true;
  }

  async deleteEmployee(id: string): Promise<boolean> {
    return this.employees.delete(id);
  }

  // Client methods
  async getClient(id: string): Promise<Client | undefined> {
    return this.clients.get(id);
  }

  async getClientByEmail(email: string): Promise<Client | undefined> {
    return Array.from(this.clients.values()).find(client => client.email === email);
  }

  async getClientsByMerchant(merchantId: string): Promise<Client[]> {
    return Array.from(this.clients.values()).filter(client => client.merchantId === merchantId);
  }

  async getActiveClientsByMerchant(merchantId: string): Promise<Client[]> {
    return Array.from(this.clients.values()).filter(client => 
      client.merchantId === merchantId && client.isActive
    );
  }

  async createClient(insertClient: InsertClient): Promise<Client> {
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
    this.clients.set(id, client);
    return client;
  }

  async updateClient(id: string, updates: Partial<InsertClient>): Promise<Client | undefined> {
    const client = this.clients.get(id);
    if (!client) return undefined;

    const processedUpdates = { ...updates };
    if (processedUpdates.password) {
      processedUpdates.password = await bcrypt.hash(processedUpdates.password, 10);
    }

    const updatedClient: Client = {
      ...client,
      ...processedUpdates,
      updatedAt: new Date(),
    };
    this.clients.set(id, updatedClient);
    return updatedClient;
  }

  async updateClientPassword(id: string, newPassword: string): Promise<boolean> {
    const client = this.clients.get(id);
    if (!client) return false;

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    const updatedClient: Client = {
      ...client,
      password: hashedPassword,
      updatedAt: new Date(),
    };
    this.clients.set(id, updatedClient);
    return true;
  }

  async deleteClient(id: string): Promise<boolean> {
    return this.clients.delete(id);
  }

  // Appointment methods
  async getAppointment(id: string): Promise<Appointment | undefined> {
    return this.appointments.get(id);
  }

  async getAppointmentsByMerchant(merchantId: string): Promise<Appointment[]> {
    return Array.from(this.appointments.values()).filter(appointment => appointment.merchantId === merchantId);
  }

  async getAppointmentsByDate(merchantId: string, date: string): Promise<Appointment[]> {
    return Array.from(this.appointments.values())
      .filter(appointment => 
        appointment.merchantId === merchantId && appointment.appointmentDate === date
      )
      .sort((a, b) => a.appointmentTime.localeCompare(b.appointmentTime));
  }

  async getAppointmentsByDateRange(merchantId: string, startDate: string, endDate: string): Promise<Appointment[]> {
    return Array.from(this.appointments.values())
      .filter(appointment => 
        appointment.merchantId === merchantId && 
        appointment.appointmentDate >= startDate && 
        appointment.appointmentDate <= endDate
      )
      .sort((a, b) => {
        const dateCompare = a.appointmentDate.localeCompare(b.appointmentDate);
        return dateCompare !== 0 ? dateCompare : a.appointmentTime.localeCompare(b.appointmentTime);
      });
  }

  async createAppointment(insertAppointment: InsertAppointment): Promise<Appointment> {
    const id = randomUUID();
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
      ...insertAppointment,
      id,
      clientId: insertAppointment.clientId || null,
      employeeId: insertAppointment.employeeId || null,
      clientEmail: insertAppointment.clientEmail || null,
      endTime: endTime || insertAppointment.appointmentTime,
      status: insertAppointment.status || "pending",
      notes: insertAppointment.notes || null,
      rescheduleReason: insertAppointment.rescheduleReason || null,
      cancelReason: insertAppointment.cancelReason || null,
      cancelPolicy: insertAppointment.cancelPolicy || "24h",
      reminderSent: insertAppointment.reminderSent || false,
      arrivalTime: insertAppointment.arrivalTime || null,
      completedAt: insertAppointment.completedAt || null,
      createdAt: now,
      updatedAt: now,
    };
    this.appointments.set(id, appointment);
    return appointment;
  }

  async updateAppointment(id: string, updates: Partial<InsertAppointment>): Promise<Appointment | undefined> {
    const appointment = this.appointments.get(id);
    if (!appointment) return undefined;

    const updatedAppointment: Appointment = {
      ...appointment,
      ...updates,
      updatedAt: new Date(),
    };
    this.appointments.set(id, updatedAppointment);
    return updatedAppointment;
  }

  async deleteAppointment(id: string): Promise<boolean> {
    return this.appointments.delete(id);
  }

  async deleteAppointmentsByService(serviceId: string): Promise<number> {
    const appointmentsToDelete = Array.from(this.appointments.values())
      .filter(appointment => appointment.serviceId === serviceId);

    let deletedCount = 0;
    for (const appointment of appointmentsToDelete) {
      if (this.appointments.delete(appointment.id)) {
        deletedCount++;
      }
    }
    return deletedCount;
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
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const thisWeekStart = new Date(now);
    thisWeekStart.setDate(now.getDate() - now.getDay());
    const thisWeek = thisWeekStart.toISOString().split('T')[0];
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const thisMonth = thisMonthStart.toISOString().split('T')[0];

    const merchantAppointments = await this.getAppointmentsByMerchant(merchantId);
    const merchantServices = await this.getServicesByMerchant(merchantId);

    return {
      appointments: {
        today: merchantAppointments.filter(a => a.appointmentDate === today).length,
        thisWeek: merchantAppointments.filter(a => a.appointmentDate >= thisWeek).length,
        thisMonth: merchantAppointments.filter(a => a.appointmentDate >= thisMonth).length,
      },
      services: {
        total: merchantServices.length,
        active: merchantServices.filter(s => s.isActive).length,
      },
    };
  }

  // Missing appointment methods implementation
  async getAppointmentsByEmployee(employeeId: string, date?: string): Promise<Appointment[]> {
    let appointments = Array.from(this.appointments.values())
      .filter(appointment => appointment.employeeId === employeeId);

    if (date) {
      appointments = appointments.filter(appointment => appointment.appointmentDate === date);
    }

    return appointments.sort((a, b) => {
      const dateCompare = a.appointmentDate.localeCompare(b.appointmentDate);
      return dateCompare !== 0 ? dateCompare : a.appointmentTime.localeCompare(b.appointmentTime);
    });
  }

  async getClientAppointments(clientId: string, merchantId: string): Promise<Appointment[]> {
    return Array.from(this.appointments.values())
      .filter(appointment => 
        appointment.clientId === clientId && appointment.merchantId === merchantId
      )
      .sort((a, b) => {
        const dateCompare = a.appointmentDate.localeCompare(b.appointmentDate);
        return dateCompare !== 0 ? dateCompare : a.appointmentTime.localeCompare(b.appointmentTime);
      });
  }

  async getClientAppointmentsByDate(clientId: string, merchantId: string, date: string): Promise<Appointment[]> {
    return Array.from(this.appointments.values())
      .filter(appointment => 
        appointment.clientId === clientId && 
        appointment.merchantId === merchantId && 
        appointment.appointmentDate === date
      )
      .sort((a, b) => a.appointmentTime.localeCompare(b.appointmentTime));
  }

  async getClientAppointmentsByDateRange(clientId: string, merchantId: string, startDate: string, endDate: string): Promise<Appointment[]> {
    return Array.from(this.appointments.values())
      .filter(appointment => 
        appointment.clientId === clientId && 
        appointment.merchantId === merchantId && 
        appointment.appointmentDate >= startDate && 
        appointment.appointmentDate <= endDate
      )
      .sort((a, b) => {
        const dateCompare = a.appointmentDate.localeCompare(b.appointmentDate);
        return dateCompare !== 0 ? dateCompare : a.appointmentTime.localeCompare(b.appointmentTime);
      });
  }

  async getPendingPaymentAppointments(merchantId: string): Promise<Appointment[]> {
    return Array.from(this.appointments.values())
      .filter(appointment => 
        appointment.merchantId === merchantId && 
        appointment.status === "completed" && 
        appointment.paymentStatus === "pending"
      )
      .sort((a, b) => {
        const dateCompare = b.appointmentDate.localeCompare(a.appointmentDate); // Most recent first
        return dateCompare !== 0 ? dateCompare : b.appointmentTime.localeCompare(a.appointmentTime);
      });
  }

  async updateAppointmentStatus(id: string, statusUpdate: AppointmentStatusData): Promise<Appointment | undefined> {
    const appointment = this.appointments.get(id);
    if (!appointment) return undefined;

    const updatedAppointment: Appointment = {
      ...appointment,
      status: statusUpdate.status,
      cancelReason: statusUpdate.cancelReason || appointment.cancelReason,
      rescheduleReason: statusUpdate.rescheduleReason || appointment.rescheduleReason,
      arrivalTime: statusUpdate.arrivalTime || appointment.arrivalTime,
      updatedAt: new Date(),
    };

    // If status is completed, set completedAt and initialize payment status
    if (statusUpdate.status === "completed") {
      updatedAppointment.completedAt = new Date();
      updatedAppointment.paymentStatus = statusUpdate.paymentStatus || "pending";
    }

    // Update payment status if provided
    if (statusUpdate.paymentStatus) {
      updatedAppointment.paymentStatus = statusUpdate.paymentStatus;
      if (statusUpdate.paymentStatus === "paid") {
        updatedAppointment.paidAt = new Date();
      }
    }

    this.appointments.set(id, updatedAppointment);
    return updatedAppointment;
  }

  async rescheduleAppointment(id: string, newDate: string, newTime: string, reason: string): Promise<Appointment | undefined> {
    const appointment = this.appointments.get(id);
    if (!appointment) return undefined;

    // Check if appointment can be rescheduled
    const canReschedule = await this.canRescheduleAppointment(id);
    if (!canReschedule.canReschedule) {
      throw new Error(canReschedule.reason || "Appointment cannot be rescheduled");
    }

    // Calculate new end time based on service duration
    const service = await this.getService(appointment.serviceId);
    let newEndTime = newTime;
    if (service) {
      const [hours, minutes] = newTime.split(':').map(Number);
      const endMinutes = minutes + service.duration;
      const endHour = hours + Math.floor(endMinutes / 60);
      const finalMinutes = endMinutes % 60;
      newEndTime = `${endHour.toString().padStart(2, '0')}:${finalMinutes.toString().padStart(2, '0')}`;
    }

    // Check availability for new time slot
    if (appointment.employeeId) {
      const availability = {
        employeeId: appointment.employeeId,
        date: newDate,
        startTime: newTime,
        duration: service?.duration || 60
      };

      const isAvailable = await this.checkEmployeeAvailability(availability);
      if (!isAvailable) {
        throw new Error("Employee is not available for the new time slot");
      }
    }

    const updatedAppointment: Appointment = {
      ...appointment,
      appointmentDate: newDate,
      appointmentTime: newTime,
      endTime: newEndTime,
      rescheduleReason: reason,
      status: "pending", // Reset to pending after reschedule
      updatedAt: new Date(),
    };

    this.appointments.set(id, updatedAppointment);
    return updatedAppointment;
  }

  async cancelAppointment(id: string, reason: string): Promise<Appointment | undefined> {
    const appointment = this.appointments.get(id);
    if (!appointment) return undefined;

    // Check if appointment can be cancelled
    const canCancel = await this.canCancelAppointment(id);
    if (!canCancel.canCancel) {
      throw new Error(canCancel.reason || "Appointment cannot be cancelled");
    }

    const updatedAppointment: Appointment = {
      ...appointment,
      status: "cancelled",
      cancelReason: reason,
      updatedAt: new Date(),
    };

    this.appointments.set(id, updatedAppointment);
    return updatedAppointment;
  }

  async checkEmployeeAvailability(availability: AvailabilityData): Promise<boolean> {
    const employee = await this.getEmployee(availability.employeeId);
    if (!employee || !employee.isActive) return false;

    // Check if employee works on this day
    const workDays = JSON.parse(employee.workDays);
    const requestDate = new Date(availability.date);
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

  async getEmployeeAvailableSlots(employeeId: string, date: string, serviceDuration: number): Promise<string[]> {
    const employee = await this.getEmployee(employeeId);
    if (!employee || !employee.isActive) return [];

    // Check if employee works on this day
    const workDays = JSON.parse(employee.workDays);
    const requestDate = new Date(date);
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
    const employee = await this.getEmployee(employeeId);
    if (!employee) return undefined;

    const updatedEmployee: Employee = {
      ...employee,
      ...schedule,
      updatedAt: new Date(),
    };

    this.employees.set(employeeId, updatedEmployee);
    return updatedEmployee;
  }

  async canCancelAppointment(appointmentId: string): Promise<{ canCancel: boolean, reason?: string }> {
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

    // Check cancellation policy
    const now = new Date();
    const appointmentDateTime = new Date(`${appointment.appointmentDate}T${appointment.appointmentTime}`);
    const timeDiff = appointmentDateTime.getTime() - now.getTime();
    const hoursDiff = timeDiff / (1000 * 60 * 60);

    switch (appointment.cancelPolicy) {
      case "24h":
        if (hoursDiff < 24) {
          return { canCancel: false, reason: "Cannot cancel within 24 hours of appointment" };
        }
        break;
      case "12h":
        if (hoursDiff < 12) {
          return { canCancel: false, reason: "Cannot cancel within 12 hours of appointment" };
        }
        break;
      case "2h":
        if (hoursDiff < 2) {
          return { canCancel: false, reason: "Cannot cancel within 2 hours of appointment" };
        }
        break;
      case "none":
        // No restriction
        break;
    }

    return { canCancel: true };
  }

  async canRescheduleAppointment(appointmentId: string, userRole?: string): Promise<{ canReschedule: boolean, reason?: string }> {
    const appointment = await this.getAppointment(appointmentId);
    if (!appointment) {
      return { canReschedule: false, reason: "Appointment not found" };
    }

    if (appointment.status === "cancelled") {
      return { canReschedule: false, reason: "Cannot reschedule a cancelled appointment" };
    }

    if (appointment.status === "completed") {
      return { canReschedule: false, reason: "Cannot reschedule a completed appointment" };
    }

    // Funcionários e merchants podem reagendar a qualquer momento
    if (userRole === "employee" || userRole === "merchant") {
      return { canReschedule: true };
    }

    // Para clientes, aplicar a política de cancelamento (24h mínimo)
    const now = new Date();
    const appointmentDateTime = new Date(`${appointment.appointmentDate}T${appointment.appointmentTime}`);
    const timeDiff = appointmentDateTime.getTime() - now.getTime();
    const hoursDiff = timeDiff / (1000 * 60 * 60);

    switch (appointment.cancelPolicy) {
      case "24h":
        if (hoursDiff < 24) {
          return { canReschedule: false, reason: "Cannot reschedule within 24 hours of appointment" };
        }
        break;
      case "12h":
        if (hoursDiff < 12) {
          return { canReschedule: false, reason: "Cannot reschedule within 12 hours of appointment" };
        }
        break;
      case "2h":
        if (hoursDiff < 2) {
          return { canReschedule: false, reason: "Cannot reschedule within 2 hours of appointment" };
        }
        break;
      case "none":
        // No restriction
        break;
    }

    return { canReschedule: true };
  }

  async markAppointmentAsLate(appointmentId: string): Promise<Appointment | undefined> {
    const appointment = await this.getAppointment(appointmentId);
    if (!appointment) return undefined;

    const updatedAppointment: Appointment = {
      ...appointment,
      status: "late",
      updatedAt: new Date(),
    };

    this.appointments.set(appointmentId, updatedAppointment);
    return updatedAppointment;
  }

  async markAppointmentAsNoShow(appointmentId: string): Promise<Appointment | undefined> {
    const appointment = await this.getAppointment(appointmentId);
    if (!appointment) return undefined;

    const updatedAppointment: Appointment = {
      ...appointment,
      status: "no_show",
      updatedAt: new Date(),
    };

    this.appointments.set(appointmentId, updatedAppointment);
    return updatedAppointment;
  }

  async getClientHistoricalAppointments(clientId: string, filter: string): Promise<any[]> {
    // This method seems to be part of a different implementation (e.g., SQLiteStorage)
    // and is not fully implemented in MemStorage. 
    // For the purpose of this task, we'll leave it as a placeholder or throw an error.
    throw new Error("getClientHistoricalAppointments not implemented in MemStorage");
  }

  async updateEmployeeDayOff(id: string, updates: Partial<{ date: string, reason: string, employeeId: string }>): Promise<{ id: string, date: string, reason: string, employeeId: string } | undefined> {
    // This method is not implemented in MemStorage as it relies on a database schema not present here.
    // In a real scenario, this would involve querying and updating a 'employeeDaysOff' table.
    console.warn("updateEmployeeDayOff called on MemStorage, which does not support this functionality.");
    return undefined;
  }
}

import { SQLiteStorage } from "./sqlite-storage";

export const storage = new SQLiteStorage();