CREATE TABLE "appointments" (
	"id" text PRIMARY KEY NOT NULL,
	"merchant_id" text NOT NULL,
	"service_id" text NOT NULL,
	"client_id" text,
	"employee_id" text,
	"client_name" text NOT NULL,
	"client_phone" text NOT NULL,
	"client_email" text,
	"appointment_date" text NOT NULL,
	"appointment_time" text NOT NULL,
	"end_time" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"notes" text,
	"reschedule_reason" text,
	"cancel_reason" text,
	"cancel_policy" text DEFAULT '24h' NOT NULL,
	"reminder_sent" boolean DEFAULT false NOT NULL,
	"arrival_time" text,
	"completed_at" timestamp,
	"payment_status" text DEFAULT 'pending',
	"paid_at" timestamp,
	"actual_start_time" text,
	"actual_end_time" text,
	"new_date" text,
	"new_time" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "clients" (
	"id" text PRIMARY KEY NOT NULL,
	"merchant_id" text NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"password" text NOT NULL,
	"phone" text NOT NULL,
	"notes" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "clients_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "employee_days_off" (
	"id" text PRIMARY KEY NOT NULL,
	"merchant_id" text NOT NULL,
	"employee_id" text NOT NULL,
	"date" text NOT NULL,
	"reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "employees" (
	"id" text PRIMARY KEY NOT NULL,
	"merchant_id" text NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"password" text NOT NULL,
	"phone" text NOT NULL,
	"role" text DEFAULT 'employee' NOT NULL,
	"specialties" text,
	"work_days" text DEFAULT '[1,2,3,4,5,6]' NOT NULL,
	"start_time" text DEFAULT '09:00' NOT NULL,
	"end_time" text DEFAULT '18:00' NOT NULL,
	"break_start_time" text DEFAULT '12:00',
	"break_end_time" text DEFAULT '13:00',
	"payment_type" text DEFAULT 'monthly' NOT NULL,
	"payment_value" integer DEFAULT 0 NOT NULL,
	"extended_end_time" text,
	"overtime_hours" integer DEFAULT 0,
	"last_overtime_date" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "employees_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "merchants" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"owner_name" text NOT NULL,
	"email" text NOT NULL,
	"password" text NOT NULL,
	"phone" text NOT NULL,
	"address" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"logo_url" text,
	"is_open" boolean DEFAULT true NOT NULL,
	"work_days" text DEFAULT '[1,2,3,4,5,6]' NOT NULL,
	"start_time" text DEFAULT '09:00' NOT NULL,
	"end_time" text DEFAULT '18:00' NOT NULL,
	"break_start_time" text DEFAULT '12:00',
	"break_end_time" text DEFAULT '13:00',
	"access_start_date" timestamp,
	"access_end_date" timestamp,
	"access_duration_days" integer DEFAULT 30,
	"last_payment_date" timestamp,
	"next_payment_due" timestamp,
	"monthly_fee" integer DEFAULT 5000,
	"payment_status" text DEFAULT 'pending' NOT NULL,
	"no_show_fee_enabled" boolean DEFAULT false NOT NULL,
	"no_show_fee_amount" integer DEFAULT 0,
	"late_fee_enabled" boolean DEFAULT false NOT NULL,
	"late_fee_amount" integer DEFAULT 0,
	"late_tolerance_minutes" integer DEFAULT 15,
	"cancellation_policy_hours" integer DEFAULT 24,
	"cancellation_fee_enabled" boolean DEFAULT false NOT NULL,
	"cancellation_fee_amount" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "merchants_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "penalties" (
	"id" text PRIMARY KEY NOT NULL,
	"merchant_id" text NOT NULL,
	"client_id" text,
	"appointment_id" text,
	"client_name" text NOT NULL,
	"client_phone" text NOT NULL,
	"client_email" text,
	"type" text NOT NULL,
	"amount" integer NOT NULL,
	"reason" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"paid_at" timestamp,
	"paid_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "promotions" (
	"id" text PRIMARY KEY NOT NULL,
	"merchant_id" text NOT NULL,
	"service_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"discount_type" text DEFAULT 'percentage' NOT NULL,
	"discount_value" integer NOT NULL,
	"start_date" text NOT NULL,
	"end_date" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "services" (
	"id" text PRIMARY KEY NOT NULL,
	"merchant_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"price" integer NOT NULL,
	"duration" integer NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"password" text NOT NULL,
	"role" text DEFAULT 'admin' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_days_off" ADD CONSTRAINT "employee_days_off_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_days_off" ADD CONSTRAINT "employee_days_off_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employees" ADD CONSTRAINT "employees_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "penalties" ADD CONSTRAINT "penalties_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "penalties" ADD CONSTRAINT "penalties_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "penalties" ADD CONSTRAINT "penalties_appointment_id_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promotions" ADD CONSTRAINT "promotions_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promotions" ADD CONSTRAINT "promotions_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "services" ADD CONSTRAINT "services_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;