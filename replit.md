# Beauty Scheduler

## Overview

Beauty Scheduler is a full-stack web application for managing beauty service merchants and appointments. The system provides an admin dashboard to oversee merchant registration, status management, and generate reports. Built with a modern React frontend and Express.js backend, it uses SQLite for data persistence and includes comprehensive authentication and form validation.

## User Preferences

Preferred communication style: Simple, everyday language.

## Recent Changes

### September 15, 2025 - Data Isolation Fix
- **Issue**: Services created by one merchant (dono1) were incorrectly appearing in another merchant's (dono2) dashboard
- **Root Cause**: Service record had wrong merchant_id in SQLite database due to data mapping discrepancy
- **Solution**: Implemented direct database correction using better-sqlite3 to transfer service ownership to correct merchant
- **Result**: Complete data isolation now enforced - each merchant sees only their own services, employees, clients, and appointments
- **Technical Details**: 
  - Discovered column naming convention difference: camelCase (merchantId) in application vs snake_case (merchant_id) in SQLite database
  - Added updateServiceMerchant method to SQLiteStorage for future corrections if needed
  - Verified all existing query filters properly enforce tenant scoping

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript for type safety
- **Routing**: Wouter for lightweight client-side routing
- **State Management**: TanStack React Query for server state management and caching
- **UI Components**: shadcn/ui component library built on Radix UI primitives
- **Styling**: Tailwind CSS with CSS custom properties for theming
- **Forms**: React Hook Form with Zod schema validation
- **Build Tool**: Vite for fast development and optimized production builds

### Backend Architecture
- **Runtime**: Node.js with Express.js framework
- **Language**: TypeScript with ES modules
- **Database ORM**: Drizzle ORM for type-safe database operations
- **Authentication**: JSON Web Tokens (JWT) for session management
- **Password Security**: bcrypt for password hashing
- **Validation**: Zod schemas shared between frontend and backend
- **Storage Pattern**: Repository pattern with interface abstraction supporting both SQLite and in-memory storage

### Database Design
- **Primary Database**: SQLite with better-sqlite3 driver
- **Schema Management**: Drizzle migrations and schema definitions
- **Tables**:
  - `users`: Admin accounts with email, hashed passwords, and roles
  - `merchants`: Business profiles with contact info, status tracking, and timestamps
- **Data Integrity**: Unique constraints on email fields, foreign key relationships

### Authentication & Authorization
- **Strategy**: JWT-based authentication with Bearer token format
- **Session Management**: Tokens stored in localStorage on client-side
- **Route Protection**: Higher-order components for protected routes
- **Password Policy**: Minimum length validation with bcrypt hashing (salt rounds: 10)
- **Admin Access**: Default admin account (leolulu842@gmail.com) created on database initialization

### API Architecture
- **Design Pattern**: RESTful API with consistent error handling
- **Endpoints**: Standardized CRUD operations for merchants and authentication
- **Request/Response**: JSON format with proper HTTP status codes
- **Middleware**: Request logging, CORS handling, and authentication verification
- **Error Handling**: Centralized error middleware with structured error responses

### Development Workflow
- **Hot Reloading**: Vite dev server with HMR for frontend changes
- **Code Quality**: TypeScript strict mode enabled across entire codebase
- **Build Process**: Separate builds for frontend (Vite) and backend (esbuild)
- **Path Aliases**: Configured for clean imports (@/, @shared/, @assets/)

## External Dependencies

### Core Framework Dependencies
- **@neondatabase/serverless**: PostgreSQL-compatible database driver (configured but currently using SQLite)
- **better-sqlite3**: High-performance SQLite database driver
- **drizzle-orm**: Type-safe ORM with schema management
- **@tanstack/react-query**: Server state management and caching
- **wouter**: Lightweight React router

### UI and Styling
- **@radix-ui/***: Comprehensive set of unstyled, accessible UI primitives
- **tailwindcss**: Utility-first CSS framework
- **class-variance-authority**: Utility for creating variant-based component APIs
- **lucide-react**: Modern icon library with React components

### Form Handling and Validation
- **react-hook-form**: Performant forms library with minimal re-renders
- **@hookform/resolvers**: Validation resolvers for react-hook-form
- **zod**: TypeScript-first schema validation library

### Security and Authentication
- **jsonwebtoken**: JWT implementation for Node.js
- **bcrypt**: Password hashing library with salt generation

### Development Tools
- **@types/***: TypeScript type definitions for various libraries
- **@replit/***: Replit-specific development plugins for enhanced IDE experience
- **tsx**: TypeScript execution engine for development server

### Build and Bundling
- **vite**: Next-generation frontend build tool
- **esbuild**: Fast JavaScript bundler for backend compilation
- **@vitejs/plugin-react**: Official Vite plugin for React support