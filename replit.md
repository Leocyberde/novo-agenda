# Salon Booking Management System

## Overview
This is a comprehensive salon/appointment booking management system built with React (frontend), Express.js (backend), and PostgreSQL database. The application allows salon owners to manage appointments, services, employees, clients, and business operations.

## Recent Changes
- **2025-09-18**: Successfully set up project in Replit environment
  - Configured PostgreSQL database with Drizzle ORM
  - Set up all required environment variables
  - Configured Vite dev server with proper host settings for Replit
  - Created workflow for development server on port 5000
  - Verified API endpoints and frontend are working correctly
  - **Added merchant self-registration functionality:**
    - Login screen now includes "Cadastre seu Salão" option
    - Multi-step signup flow with salon info → plan selection → payment
    - Two plan options: 10-day free trial and 30-day VIP (R$ 50/month)
    - VIP plan includes payment interface (frontend only)
    - Backend API endpoint `/api/merchants/register` for public registration
    - Automatic account activation for trial users
    - Secure password hashing and plan validation
    - **Automated welcome email system:**
      - Sends personalized welcome emails upon merchant registration
      - Professional HTML template with salon details and plan information
      - Separate email content for trial vs VIP plans
      - Integration with Gmail SMTP for reliable delivery
      - Email delivery confirmation in API response

## Project Architecture

### Frontend (`client/`)
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS with Radix UI components
- **State Management**: TanStack React Query
- **Routing**: Wouter
- **Forms**: React Hook Form with Zod validation

### Backend (`server/`)
- **Framework**: Express.js with TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: JWT with Passport.js
- **File Uploads**: Multer
- **Session Management**: Express Session with PostgreSQL store

### Database Schema (`shared/`)
Key entities:
- Users (admin system)
- Merchants (salon owners)
- Services (salon services)
- Employees (staff members)
- Clients (customers)
- Appointments (bookings)
- Penalties (fees for no-shows, cancellations)
- Promotions (discounts)
- Employee Days Off

## Environment Configuration
Required environment variables:
- `DATABASE_URL`: PostgreSQL connection string (configured)
- `EMAIL_USER`: Email service username (configured)
- `EMAIL_PASSWORD`: Email service password (configured) 
- `JWT_SECRET`: JWT signing secret (configured)
- `NODE_ENV`: Environment mode (development/production)

## Development
- **Dev Server**: Runs on port 5000 with hot reload
- **Host Configuration**: Uses 0.0.0.0 with allowedHosts: true for Replit compatibility
- **Cache Control**: Configured to prevent caching issues in Replit iframe

## Login Credentials
- **Admin Email**: leolulu842@gmail.com
- **Admin Password**: 123456

## Key Features
- Multi-role system (admin, merchant, employee, client)
- Appointment scheduling and management
- Service and pricing management
- Employee scheduling and payroll tracking
- Client management and history
- Penalty system for no-shows and cancellations
- Promotional campaigns
- Real-time availability checking

## User Preferences
- Environment properly configured for Replit
- All dependencies installed and working
- Database migrations run automatically on startup
- Development server configured with proper proxy settings