import { sql } from "drizzle-orm";
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  role: text("role").notNull().default("admin"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
});

export const merchants = sqliteTable("merchants", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  ownerName: text("owner_name").notNull(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  phone: text("phone").notNull(),
  address: text("address").notNull(),
  status: text("status").notNull().default("pending"), // pending, active, inactive, payment_pending
  logoUrl: text("logo_url"), // URL for the salon logo
  isOpen: integer("is_open", { mode: "boolean" }).notNull().default(true), // Open/closed status
  workDays: text("work_days").notNull().default("[1,2,3,4,5,6]"), // JSON array of days (0=Sunday, 1=Monday, etc.)
  startTime: text("start_time").notNull().default("09:00"), // HH:MM format
  endTime: text("end_time").notNull().default("18:00"), // HH:MM format
  breakStartTime: text("break_start_time").default("12:00"), // Optional lunch break
  breakEndTime: text("break_end_time").default("13:00"), // Optional lunch break
  // Access control fields
  accessStartDate: integer("access_start_date", { mode: "timestamp" }), // When access was granted
  accessEndDate: integer("access_end_date", { mode: "timestamp" }), // When access expires
  accessDurationDays: integer("access_duration_days").default(30), // Duration in days (default 30 days)
  lastPaymentDate: integer("last_payment_date", { mode: "timestamp" }), // Last payment date
  nextPaymentDue: integer("next_payment_due", { mode: "timestamp" }), // Next payment due date
  monthlyFee: integer("monthly_fee").default(5000), // Monthly fee in cents (default R$ 50.00)
  paymentStatus: text("payment_status").notNull().default("pending"), // pending, paid, overdue
  // Booking policies
  noShowFeeEnabled: integer("no_show_fee_enabled", { mode: "boolean" }).notNull().default(false), // Enable/disable no-show fee
  noShowFeeAmount: integer("no_show_fee_amount").default(0), // Fee amount in cents for no-show
  lateFeeEnabled: integer("late_fee_enabled", { mode: "boolean" }).notNull().default(false), // Enable/disable late fee
  lateFeeAmount: integer("late_fee_amount").default(0), // Fee amount in cents for being late
  lateToleranceMinutes: integer("late_tolerance_minutes").default(15), // Minutes of tolerance before considering late
  cancellationPolicyHours: integer("cancellation_policy_hours").default(24), // Hours required for free cancellation
  cancellationFeeEnabled: integer("cancellation_fee_enabled", { mode: "boolean" }).notNull().default(false), // Enable/disable cancellation fee
  cancellationFeeAmount: integer("cancellation_fee_amount").default(0), // Fee amount in cents for late cancellation
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
});

export const services = sqliteTable("services", {
  id: text("id").primaryKey(),
  merchantId: text("merchant_id").notNull().references(() => merchants.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  price: integer("price").notNull(), // price in cents
  duration: integer("duration").notNull(), // duration in minutes
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
});

export const employees = sqliteTable("employees", {
  id: text("id").primaryKey(),
  merchantId: text("merchant_id").notNull().references(() => merchants.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  phone: text("phone").notNull(),
  role: text("role").notNull().default("employee"), // employee, manager
  specialties: text("specialties"), // JSON array of service IDs they can perform
  workDays: text("work_days").notNull().default("[1,2,3,4,5,6]"), // JSON array of days (0=Sunday, 1=Monday, etc.)
  startTime: text("start_time").notNull().default("09:00"), // HH:MM format
  endTime: text("end_time").notNull().default("18:00"), // HH:MM format
  breakStartTime: text("break_start_time").default("12:00"), // Optional lunch break
  breakEndTime: text("break_end_time").default("13:00"), // Optional lunch break
  paymentType: text("payment_type").notNull().default("monthly"), // monthly, weekly, daily, percentage
  paymentValue: integer("payment_value").notNull().default(0), // value in cents for fixed payments or percentage * 100 for percentage
  extendedEndTime: text("extended_end_time"), // Temporary extended end time for current day
  overtimeHours: integer("overtime_hours").default(0), // Total accumulated overtime in minutes
  lastOvertimeDate: text("last_overtime_date"), // Last date when overtime was recorded
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
});

export const clients = sqliteTable("clients", {
  id: text("id").primaryKey(),
  merchantId: text("merchant_id").notNull().references(() => merchants.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  phone: text("phone").notNull(),
  notes: text("notes"), // client notes/preferences
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
});

export const appointments = sqliteTable("appointments", {
  id: text("id").primaryKey(),
  merchantId: text("merchant_id").notNull().references(() => merchants.id, { onDelete: "cascade" }),
  serviceId: text("service_id").notNull().references(() => services.id, { onDelete: "cascade" }),
  clientId: text("client_id").references(() => clients.id), // Optional - for registered clients
  employeeId: text("employee_id").references(() => employees.id), // Who performs the service
  clientName: text("client_name").notNull(), // For walk-ins or non-registered clients
  clientPhone: text("client_phone").notNull(),
  clientEmail: text("client_email"),
  appointmentDate: text("appointment_date").notNull(), // YYYY-MM-DD format
  appointmentTime: text("appointment_time").notNull(), // HH:MM format
  endTime: text("end_time").notNull(), // HH:MM format - calculated from start + service duration
  status: text("status").notNull().default("pending"), // pending, confirmed, in_progress, completed, cancelled, no_show, late, rescheduled
  notes: text("notes"),
  rescheduleReason: text("reschedule_reason"), // Reason for rescheduling
  cancelReason: text("cancel_reason"), // Reason for cancellation
  cancelPolicy: text("cancel_policy").notNull().default("24h"), // 24h, 12h, 2h, none
  reminderSent: integer("reminder_sent", { mode: "boolean" }).notNull().default(false),
  arrivalTime: text("arrival_time"), // When client actually arrived (HH:MM)
  completedAt: integer("completed_at", { mode: "timestamp" }), // When service was completed
  paymentStatus: text("payment_status").default("pending"), // pending, paid - for completed appointments
  paidAt: integer("paid_at", { mode: "timestamp" }), // When payment was marked as paid
  actualStartTime: text("actual_start_time"), // When service actually started (HH:MM)
  actualEndTime: text("actual_end_time"), // When service actually ended (HH:MM)
  newDate: text("new_date"), // New date when rescheduled (YYYY-MM-DD format)
  newTime: text("new_time"), // New time when rescheduled (HH:MM format)
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
});

// Penalties table for tracking cancellation fees and other penalties
export const penalties = sqliteTable("penalties", {
  id: text("id").primaryKey(),
  merchantId: text("merchant_id").notNull().references(() => merchants.id, { onDelete: "cascade" }),
  clientId: text("client_id").references(() => clients.id),
  appointmentId: text("appointment_id").references(() => appointments.id),
  clientName: text("client_name").notNull(),
  clientPhone: text("client_phone").notNull(),
  clientEmail: text("client_email"),
  type: text("type").notNull(), // "cancellation", "no_show", "late"
  amount: integer("amount").notNull(), // Amount in cents
  reason: text("reason").notNull(), // Description of penalty
  status: text("status").notNull().default("pending"), // "pending", "paid", "waived"
  paidAt: integer("paid_at", { mode: "timestamp" }), // When penalty was marked as paid
  paidBy: text("paid_by"), // Who marked as paid (user ID)
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
});

export const promotions = sqliteTable("promotions", {
  id: text("id").primaryKey(),
  merchantId: text("merchant_id").notNull().references(() => merchants.id, { onDelete: "cascade" }),
  serviceId: text("service_id").notNull().references(() => services.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  discountType: text("discount_type").notNull().default("percentage"), // "percentage", "fixed"
  discountValue: integer("discount_value").notNull(), // Percentage (1-99) or fixed amount in cents
  startDate: text("start_date").notNull(), // YYYY-MM-DD format
  endDate: text("end_date").notNull(), // YYYY-MM-DD format
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
});

export const employeeDaysOff = sqliteTable("employee_days_off", {
  id: text("id").primaryKey(),
  merchantId: text("merchant_id").notNull().references(() => merchants.id, { onDelete: "cascade" }),
  employeeId: text("employee_id").notNull().references(() => employees.id, { onDelete: "cascade" }),
  date: text("date").notNull(), // YYYY-MM-DD format
  reason: text("reason"), // Optional reason for the day off
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
});

export const insertMerchantSchema = createInsertSchema(merchants).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertServiceSchema = createInsertSchema(services).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertEmployeeSchema = createInsertSchema(employees).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const employeePaymentSchema = insertEmployeeSchema.extend({
  paymentType: z.enum(["monthly", "weekly", "daily", "percentage"]).default("monthly"),
  paymentValue: z.number().min(0, "Valor de pagamento deve ser maior ou igual a zero"),
});

export const insertClientSchema = createInsertSchema(clients).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPenaltySchema = createInsertSchema(penalties).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAppointmentSchema = createInsertSchema(appointments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertEmployeeDayOffSchema = createInsertSchema(employeeDaysOff).omit({
  id: true,
  createdAt: true,
});

export const insertPromotionSchema = createInsertSchema(promotions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Schema for merchant access management
export const merchantAccessSchema = z.object({
  accessDurationDays: z.number().min(1, "Duração deve ser pelo menos 1 dia").max(365, "Duração máxima é 365 dias"),
  monthlyFee: z.number().min(0, "Taxa mensal deve ser maior ou igual a zero"),
  paymentStatus: z.enum(["pending", "paid", "overdue"], {
    invalid_type_error: "Status de pagamento inválido"
  }),
});

export const loginSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(1, "Senha é obrigatória"),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Senha atual é obrigatória"),
  newPassword: z.string().min(6, "Nova senha deve ter pelo menos 6 caracteres"),
  confirmPassword: z.string().min(1, "Confirmação de senha é obrigatória"),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Nova senha e confirmação devem ser iguais",
  path: ["confirmPassword"],
});

export const serviceSchema = insertServiceSchema.extend({
  name: z.string().min(1, "Nome do serviço é obrigatório"),
  price: z.number().min(0, "Preço deve ser maior ou igual a zero"),
  duration: z.number().min(15, "Duração mínima é 15 minutos"),
});

export const appointmentSchema = insertAppointmentSchema.extend({
  clientName: z.string().min(1, "Nome do cliente é obrigatório"),
  clientPhone: z.string().min(10, "Telefone deve ter pelo menos 10 dígitos"),
  clientEmail: z.string().email("Email inválido").optional().or(z.literal("")),
  appointmentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data deve estar no formato YYYY-MM-DD"),
  appointmentTime: z.string().regex(/^\d{2}:\d{2}$/, "Horário deve estar no formato HH:MM"),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, "Horário de fim deve estar no formato HH:MM"),
  status: z.enum(["pending", "scheduled", "confirmed", "in_progress", "completed", "cancelled", "late", "no_show", "rescheduled"]).default("pending"),
  notes: z.string().optional(),
  rescheduleReason: z.string().optional(),
  newDate: z.string().optional(),
  newTime: z.string().optional(),
  cancelReason: z.string().optional(),
  cancelPolicy: z.string().default("24h"),
  reminderSent: z.boolean().default(false),
  arrivalTime: z.string().optional(),
  completedAt: z.string().optional(),
  actualStartTime: z.string().optional(),
  actualEndTime: z.string().optional(),
});

// Schema for employee working hours
export const employeeScheduleSchema = insertEmployeeSchema.extend({
  workDays: z.string().refine((val) => {
    try {
      const days = JSON.parse(val);
      return Array.isArray(days) && days.every(d => d >= 0 && d <= 6);
    } catch {
      return false;
    }
  }, "Dias de trabalho devem ser um array de números de 0-6"),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "Horário de início deve estar no formato HH:MM"),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, "Horário de fim deve estar no formato HH:MM"),
  breakStartTime: z.string().regex(/^\d{2}:\d{2}$/, "Horário de início do intervalo deve estar no formato HH:MM").optional(),
  breakEndTime: z.string().regex(/^\d{2}:\d{2}$/, "Horário de fim do intervalo deve estar no formato HH:MM").optional(),
});

// Schema for merchant working hours
export const merchantScheduleSchema = insertMerchantSchema.extend({
  workDays: z.string().refine((val) => {
    try {
      const days = JSON.parse(val);
      return Array.isArray(days) && days.every(d => d >= 0 && d <= 6);
    } catch {
      return false;
    }
  }, "Dias de funcionamento devem ser um array de números de 0-6"),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "Horário de abertura deve estar no formato HH:MM"),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, "Horário de fechamento deve estar no formato HH:MM"),
  breakStartTime: z.string().regex(/^\d{2}:\d{2}$/, "Horário de início do intervalo deve estar no formato HH:MM").optional(),
  breakEndTime: z.string().regex(/^\d{2}:\d{2}$/, "Horário de fim do intervalo deve estar no formato HH:MM").optional(),
});

// Schema for booking policies
export const bookingPoliciesSchema = z.object({
  noShowFeeEnabled: z.boolean().default(false),
  noShowFeeAmount: z.number().min(0, "Valor da multa deve ser maior ou igual a zero").default(0),
  lateFeeEnabled: z.boolean().default(false),
  lateFeeAmount: z.number().min(0, "Valor da multa de atraso deve ser maior ou igual a zero").default(0),
  lateToleranceMinutes: z.number().min(0, "Tolerância deve ser maior ou igual a zero").max(60, "Tolerância máxima é 60 minutos").default(15),
  cancellationPolicyHours: z.number().min(0, "Horas para cancelamento deve ser maior ou igual a zero").max(168, "Máximo de 7 dias (168 horas)").default(24),
  cancellationFeeEnabled: z.boolean().default(false),
  cancellationFeeAmount: z.number().min(0, "Valor da multa de cancelamento deve ser maior ou igual a zero").default(0),
});

// Schema for updating appointment status
export const appointmentStatusSchema = z.object({
  status: z.enum(["pending", "confirmed", "in_progress", "completed", "cancelled", "no_show", "late", "rescheduled"]),
  cancelReason: z.string().min(1, "Motivo do cancelamento é obrigatório").optional(),
  rescheduleReason: z.string().min(1, "Motivo do reagendamento é obrigatório").optional(),
  arrivalTime: z.string().regex(/^\d{2}:\d{2}$/, "Horário de chegada deve estar no formato HH:MM").optional(),
  newDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Nova data deve estar no formato YYYY-MM-DD").optional(),
  newTime: z.string().regex(/^\d{2}:\d{2}$/, "Novo horário deve estar no formato HH:MM").optional(),
  paymentStatus: z.enum(["pending", "paid"]).optional(),
});

// Schema for checking availability
export const availabilitySchema = z.object({
  employeeId: z.string().uuid("Employee ID deve ser um UUID válido"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data deve estar no formato YYYY-MM-DD"),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "Horário de início deve estar no formato HH:MM"),
  duration: z.number().min(15, "Duração mínima é 15 minutos"),
});

// Schema for updating payment status
export const paymentStatusSchema = z.object({
  paymentStatus: z.enum(["pending", "paid"], {
    required_error: "Status de pagamento é obrigatório",
    invalid_type_error: "Status de pagamento deve ser 'pending' ou 'paid'"
  }),
});

// Schema for promotions
export const promotionSchema = insertPromotionSchema.extend({
  name: z.string().min(1, "Nome da promoção é obrigatório"),
  discountType: z.enum(["percentage", "fixed"], {
    invalid_type_error: "Tipo de desconto deve ser porcentagem ou valor fixo"
  }),
  discountValue: z.number().min(1, "Valor do desconto deve ser maior que zero"),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data de início deve estar no formato YYYY-MM-DD"),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data de fim deve estar no formato YYYY-MM-DD"),
}).refine((data) => {
  if (data.discountType === "percentage" && data.discountValue > 99) {
    return false;
  }
  return true;
}, {
  message: "Desconto percentual não pode ser maior que 99%",
  path: ["discountValue"]
}).refine((data) => {
  return new Date(data.startDate) <= new Date(data.endDate);
}, {
  message: "Data de início deve ser anterior ou igual à data de fim",
  path: ["endDate"]
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertMerchant = z.infer<typeof insertMerchantSchema>;
export type Merchant = typeof merchants.$inferSelect;
export type PublicMerchant = Omit<Merchant, 'password'>;
export type InsertService = z.infer<typeof insertServiceSchema>;
export type Service = typeof services.$inferSelect;
export type InsertEmployee = z.infer<typeof insertEmployeeSchema>;
export type Employee = typeof employees.$inferSelect;
export type PublicEmployee = Omit<Employee, 'password'>;
export type InsertClient = z.infer<typeof insertClientSchema>;
export type Client = typeof clients.$inferSelect;
export type PublicClient = Omit<Client, 'password'>;
export type InsertAppointment = z.infer<typeof insertAppointmentSchema>;
export type Appointment = typeof appointments.$inferSelect;
export type InsertEmployeeDayOff = z.infer<typeof insertEmployeeDayOffSchema>;
export type EmployeeDayOff = typeof employeeDaysOff.$inferSelect;
export type InsertPromotion = z.infer<typeof insertPromotionSchema>;
export type Promotion = typeof promotions.$inferSelect;
export type LoginData = z.infer<typeof loginSchema>;
export type ServiceData = z.infer<typeof serviceSchema>;
export type AppointmentData = z.infer<typeof appointmentSchema>;
export type EmployeeScheduleData = z.infer<typeof employeeScheduleSchema>;
export type MerchantScheduleData = z.infer<typeof merchantScheduleSchema>;
export type BookingPoliciesData = z.infer<typeof bookingPoliciesSchema>;
export type AppointmentStatusData = z.infer<typeof appointmentStatusSchema>;
export type AvailabilityData = z.infer<typeof availabilitySchema>;
export type PaymentStatusData = z.infer<typeof paymentStatusSchema>;
export type PromotionData = z.infer<typeof promotionSchema>;
export type MerchantAccessData = z.infer<typeof merchantAccessSchema>;

// Available appointment statuses
export const APPOINTMENT_STATUS = {
  PENDING: "pending" as const,
  CONFIRMED: "confirmed" as const,
  IN_PROGRESS: "in_progress" as const,
  COMPLETED: "completed" as const,
  CANCELLED: "cancelled" as const,
  NO_SHOW: "no_show" as const,
  LATE: "late" as const,
};

// Cancel policy options
export const CANCEL_POLICY = {
  NONE: "none" as const,
  TWO_HOURS: "2h" as const,
  TWELVE_HOURS: "12h" as const,
  TWENTY_FOUR_HOURS: "24h" as const,
};

// Days of the week (0 = Sunday, 1 = Monday, etc.)
export const WEEKDAYS = {
  SUNDAY: 0,
  MONDAY: 1,
  TUESDAY: 2,
  WEDNESDAY: 3,
  THURSDAY: 4,
  FRIDAY: 5,
  SATURDAY: 6,
} as const;