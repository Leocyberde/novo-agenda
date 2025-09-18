import type { Express } from "express";
import { createServer, type Server } from "http";
import { PostgreSQLStorage } from "./sqlite-storage.js";
const storage = new PostgreSQLStorage();
import { loginSchema, changePasswordSchema, insertMerchantSchema, merchantScheduleSchema, serviceSchema, appointmentSchema, insertEmployeeSchema, insertClientSchema, merchantPoliciesSchema, insertPromotionSchema, insertPromotionSchema as promotionSchema, merchantPoliciesSchema as bookingPoliciesSchema, type PublicMerchant, type Merchant, type Service, type Employee, type PublicEmployee, type Client, type PublicClient, type Appointment, type EmployeeDayOff, type InsertEmployeeDayOff, type Promotion, type InsertPromotion } from "../shared/schema.js";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { z } from "zod";
import multer from "multer";
import path from "path";
import fs from "fs";
import { randomUUID } from "crypto";
import { sendWelcomeEmail } from "./email-service.js";

const JWT_SECRET = process.env.JWT_SECRET || (() => {
  if (process.env.NODE_ENV === 'production') {
    console.error('FATAL: JWT_SECRET environment variable is required in production');
    process.exit(1);
  }
  return 'beauty-scheduler-secret-key';
})();

// Helper functions to remove password from objects
function toPublicMerchant(merchant: Merchant): PublicMerchant {
  const { password, ...publicMerchant } = merchant;
  return publicMerchant;
}

function toPublicEmployee(employee: Employee): PublicEmployee {
  const { password, ...publicEmployee } = employee;
  return publicEmployee;
}

function toPublicClient(client: Client): PublicClient {
  const { password, ...publicClient } = client;
  return publicClient;
}

// Extend Express Request interface
declare global {
  namespace Express {
    interface Request {
      user?: any;
    }
  }
}

// Middleware to verify JWT
function authenticateToken(req: any, res: any, next: any) {
  if (process.env.NODE_ENV === 'development') {
    console.log("=== DEBUG: authenticateToken middleware ===");
    console.log("URL:", req.url);
    console.log("Method:", req.method);
  }

  const authHeader = req.headers['authorization'];
  if (process.env.NODE_ENV === 'development') {
    console.log("Authorization header:", authHeader ? 'PRESENTE' : 'AUSENTE');
  }

  const token = authHeader && authHeader.split(' ')[1];
  if (process.env.NODE_ENV === 'development') {
    console.log("Token extracted:", token ? 'PRESENTE' : 'AUSENTE');
  }

  if (!token) {
    console.error("No token provided");
    return res.status(401).json({ message: "Token de acesso requerido" });
  }

  jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
    if (err) {
      console.error("JWT verification error:", err.message);
      return res.status(403).json({ message: "Token inválido" });
    }

    if (process.env.NODE_ENV === 'development') {
      console.log("JWT verification successful, user ID:", user.userId);
    }
    req.user = user;
    next();
  });
}

// Renaming authenticateToken to requireAuth to match the changes
const requireAuth = authenticateToken;

// Helper function to check if user has required roles
function requireRole(roles: string[]) {
  return (req: any, res: any, next: any) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ message: "Acesso negado. Permissões insuficientes." });
    }
    next();
  };
}


export async function registerRoutes(app: Express): Promise<Server> {
  // Initialize storage
  try {
    if (storage.initialize) {
      await storage.initialize();
    }
    console.log("Storage initialized successfully");
    
    // Automatically process expired merchant access on startup
    try {
      const processedCount = await storage.processExpiredAccess();
      if (processedCount > 0) {
        console.log(`Processed ${processedCount} expired merchants on startup`);
      }
    } catch (error) {
      console.error("Failed to process expired merchants on startup:", error);
    }
  } catch (error) {
    console.error("Failed to initialize storage:", error);
    throw error;
  }

  // Ensure uploads directory exists
  const uploadsDir = path.join(process.cwd(), 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  // Configure multer for file uploads
  const uploadStorage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = `${randomUUID()}-${Date.now()}`;
      const extension = path.extname(file.originalname);
      cb(null, `logo-${uniqueSuffix}${extension}`);
    }
  });

  const upload = multer({
    storage: uploadStorage,
    limits: {
      fileSize: 5 * 1024 * 1024, // 5MB limit
    },
    fileFilter: (req, file, cb) => {
      console.log("Checking file:", file.originalname, "mimetype:", file.mimetype);

      // Allow common image formats
      const allowedMimeTypes = [
        'image/jpeg',
        'image/jpg',
        'image/png',
        'image/gif',
        'image/webp',
        'image/bmp',
        'image/svg+xml'
      ];

      if (file.mimetype.startsWith('image/') || allowedMimeTypes.includes(file.mimetype)) {
        console.log("File accepted:", file.mimetype);
        cb(null, true);
      } else {
        console.log("File rejected:", file.mimetype);
        cb(new Error('Apenas arquivos de imagem são permitidos (JPG, PNG, GIF, WebP, BMP, SVG)'), false);
      }
    }
  });

  // Health check endpoint
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Serve uploaded images with security validation
  app.get('/uploads/:filename', (req, res) => {
    const filename = req.params.filename;

    // Security: Validate filename to prevent directory traversal
    if (!filename || filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return res.status(400).json({ message: 'Invalid filename' });
    }

    // Additional validation: Only allow specific file extensions
    const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg'];
    const fileExtension = path.extname(filename).toLowerCase();
    if (!allowedExtensions.includes(fileExtension)) {
      return res.status(400).json({ message: 'File type not allowed' });
    }

    const filepath = path.join(uploadsDir, filename);

    // Security: Ensure the resolved path is still within the uploads directory
    const resolvedPath = path.resolve(filepath);
    const uploadsPath = path.resolve(uploadsDir);
    if (!resolvedPath.startsWith(uploadsPath)) {
      return res.status(400).json({ message: 'Access denied' });
    }

    if (fs.existsSync(filepath)) {
      res.sendFile(filepath);
    } else {
      res.status(404).json({ message: 'Image not found' });
    }
  });

  // Upload logo endpoint
  app.post("/api/upload/logo", requireAuth, upload.single('logo'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "Nenhum arquivo foi enviado" });
      }

      console.log("File uploaded successfully:", req.file.filename);
      console.log("File mimetype:", req.file.mimetype);
      console.log("File size:", req.file.size);

      // Return the URL for the uploaded file
      const logoUrl = `/uploads/${req.file.filename}`;
      res.json({ logoUrl, message: "Logo enviado com sucesso" });
    } catch (error) {
      console.error("Error uploading logo:", error);
      res.status(500).json({ message: "Erro ao fazer upload do logo" });
    }
  });

  // Login endpoint
  app.post("/api/auth/login", async (req, res) => {
    try {
      console.log("Login attempt for:", req.body.email);

      const { email, password } = loginSchema.parse(req.body);

      // Initialize storage if needed
      await storage.initialize();

      // First, try to find user in users table (admins)
      const user = await storage.getUserByEmail(email);
      if (user) {
        console.log("Found user in users table:", user.email);
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
          console.log("Invalid password for user:", user.email);
          return res.status(401).json({ message: "Credenciais inválidas" });
        }

        const token = jwt.sign(
          { userId: user.id, email: user.email, role: user.role },
          JWT_SECRET,
          { expiresIn: "24h" }
        );

        console.log("User login successful:", user.email);
        return res.json({ 
          token, 
          user: { 
            id: user.id, 
            email: user.email, 
            role: user.role 
          } 
        });
      }

      // If not found in users table, try merchants table
      const merchant = await storage.getMerchantByEmail(email);

      if (merchant) {
        console.log("Found merchant:", merchant.email, "status:", merchant.status);
        
        // Check if merchant is active
        if (merchant.status === "inactive") {
          return res.status(401).json({ message: "Conta foi desativada pelo administrador" });
        }
        
        if (merchant.status === "pending") {
          return res.status(401).json({ message: "Conta ainda não foi aprovada pelo administrador" });
        }
        
        if (merchant.status === "payment_pending") {
          return res.status(401).json({ message: "Acesso suspenso. Entre em contato com o administrador para renovar seu plano." });
        }
        
        // Check if access has expired
        if (merchant.accessEndDate) {
          const now = new Date();
          const accessEnd = new Date(merchant.accessEndDate);
          if (accessEnd <= now && merchant.status === "active") {
            // Auto-suspend merchant with expired access
            await storage.suspendMerchantAccess(merchant.id);
            return res.status(401).json({ message: "Seu período de acesso expirou. Entre em contato com o administrador para renovar seu plano." });
          }
        }

        const validPassword = await bcrypt.compare(password, merchant.password);
        if (!validPassword) {
          console.log("Invalid password for merchant:", merchant.email);
          return res.status(401).json({ message: "Credenciais inválidas" });
        }

        const token = jwt.sign(
          { userId: merchant.id, email: merchant.email, role: "merchant" },
          JWT_SECRET,
          { expiresIn: "24h" }
        );

        console.log("Merchant login successful:", merchant.email);
        return res.json({ 
          token, 
          user: { 
            id: merchant.id, 
            email: merchant.email, 
            role: "merchant",
            name: merchant.name,
            ownerName: merchant.ownerName,
            accessEndDate: merchant.accessEndDate,
            paymentStatus: merchant.paymentStatus
          } 
        });
      }

      // If not found in merchants table, try employees table
      const employee = await storage.getEmployeeByEmail(email);

      if (employee) {
        console.log("Found employee:", employee.email, "active:", employee.isActive);
        // Check if employee is active
        if (!employee.isActive) {
          return res.status(401).json({ message: "Conta de funcionário desativada" });
        }

        const validPassword = await bcrypt.compare(password, employee.password);
        if (!validPassword) {
          console.log("Invalid password for employee:", employee.email);
          return res.status(401).json({ message: "Credenciais inválidas" });
        }

        const token = jwt.sign(
          { userId: employee.id, email: employee.email, role: "employee", merchantId: employee.merchantId },
          JWT_SECRET,
          { expiresIn: "24h" }
        );

        console.log("Employee login successful:", employee.email);
        return res.json({ 
          token, 
          user: { 
            id: employee.id, 
            email: employee.email, 
            role: "employee",
            name: employee.name,
            merchantId: employee.merchantId
          } 
        });
      }

      // If not found in employees table, try clients table
      const client = await storage.getClientByEmail(email);

      if (client) {
        console.log("Found client:", client.email);
        const validPassword = await bcrypt.compare(password, client.password);

        if (!validPassword) {
          console.log("Invalid password for client:", client.email);
          return res.status(401).json({ message: "Credenciais inválidas" });
        }

        const token = jwt.sign(
          { userId: client.id, email: client.email, role: "client", merchantId: client.merchantId },
          JWT_SECRET,
          { expiresIn: "24h" }
        );

        console.log("Client login successful:", client.email);
        return res.json({ 
          token, 
          user: { 
            id: client.id, 
            email: client.email, 
            role: "client",
            name: client.name,
            phone: client.phone,
            merchantId: client.merchantId
          } 
        });
      }

      // If not found anywhere
      console.log("User not found:", email);
      return res.status(401).json({ message: "Credenciais inválidas" });
    } catch (error) {
      console.error("Login error:", error);
      console.error("Error stack:", error.stack);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Dados inválidos", errors: error.errors });
      }
      res.status(500).json({ message: "Erro interno do servidor", error: error.message });
    }
  });

  // Verify token endpoint
  app.post("/api/auth/verify", authenticateToken, (req, res) => {
    // Ensure user object has the same structure as login response
    const user = {
      id: req.user.userId,
      email: req.user.email,
      role: req.user.role,
      merchantId: req.user.merchantId, // Include merchantId if present
    };
    res.json({ user });
  });

  // Change password endpoint
  app.post("/api/auth/change-password", authenticateToken, async (req, res) => {
    try {
      console.log("=== CHANGE PASSWORD DEBUG ===");
      console.log("User:", { userId: req.user.userId, role: req.user.role, email: req.user.email });
      console.log("Request body keys:", Object.keys(req.body));
      
      const { currentPassword, newPassword, confirmPassword } = changePasswordSchema.parse(req.body);
      const userId = req.user.userId;
      const userRole = req.user.role;

      console.log("Validation passed, checking current user...");

      // Get current user data to verify current password
      let currentUser;
      let isValidPassword = false;

      switch (userRole) {
        case "admin":
          console.log("Fetching admin user...");
          currentUser = await storage.getUser(userId);
          if (currentUser) {
            console.log("Admin user found, verifying password...");
            isValidPassword = await bcrypt.compare(currentPassword, currentUser.password);
          }
          break;
        
        case "merchant":
          console.log("Fetching merchant user...");
          currentUser = await storage.getMerchant(userId);
          if (currentUser) {
            console.log("Merchant user found, verifying password...");
            isValidPassword = await bcrypt.compare(currentPassword, currentUser.password);
          }
          break;

        case "employee":
          console.log("Fetching employee user...");
          currentUser = await storage.getEmployee(userId);
          if (currentUser) {
            console.log("Employee user found, verifying password...");
            isValidPassword = await bcrypt.compare(currentPassword, currentUser.password);
          }
          break;

        case "client":
          console.log("Fetching client user...");
          currentUser = await storage.getClient(userId);
          if (currentUser) {
            console.log("Client user found, verifying password...");
            isValidPassword = await bcrypt.compare(currentPassword, currentUser.password);
          }
          break;

        default:
          console.error("Invalid user role:", userRole);
          return res.status(400).json({ message: "Tipo de usuário inválido" });
      }

      if (!currentUser) {
        console.error("User not found for role:", userRole, "ID:", userId);
        return res.status(404).json({ message: "Usuário não encontrado" });
      }

      console.log("Password validation result:", isValidPassword);

      if (!isValidPassword) {
        console.error("Current password incorrect for user:", userId);
        return res.status(401).json({ message: "Senha atual incorreta" });
      }

      console.log("Updating password for user role:", userRole);

      // Update password based on user type
      let passwordUpdated = false;
      switch (userRole) {
        case "admin":
          passwordUpdated = await storage.updateUserPassword(userId, newPassword);
          break;
        case "merchant":
          passwordUpdated = await storage.updateMerchantPassword(userId, newPassword);
          break;
        case "employee":
          passwordUpdated = await storage.updateEmployeePassword(userId, newPassword);
          break;
        case "client":
          passwordUpdated = await storage.updateClientPassword(userId, newPassword);
          break;
      }

      console.log("Password update result:", passwordUpdated);

      if (passwordUpdated) {
        console.log("Password successfully updated for user:", userId);
        res.json({ message: "Senha alterada com sucesso" });
      } else {
        console.error("Failed to update password for user:", userId);
        res.status(500).json({ message: "Erro ao alterar senha" });
      }
      
      console.log("=== END CHANGE PASSWORD DEBUG ===");
    } catch (error) {
      console.error("Change password error:", error);
      console.error("Error stack:", error.stack);
      
      if (error instanceof z.ZodError) {
        console.error("Validation errors:", error.errors);
        return res.status(400).json({ 
          message: "Dados inválidos", 
          errors: error.errors.map(e => `${e.path.join('.')}: ${e.message}`)
        });
      }
      res.status(500).json({ message: "Erro interno do servidor: " + error.message });
    }
  });

  // Get merchants stats
  app.get("/api/merchants/stats", authenticateToken, async (req, res) => {
    try {
      const stats = await storage.getMerchantsStats();
      const accessStats = await storage.getMerchantsAccessStatus();
      res.json({ ...stats, access: accessStats });
    } catch (error) {
      res.status(500).json({ message: "Erro ao buscar estatísticas" });
    }
  });

  // Get all merchants
  app.get("/api/merchants", authenticateToken, async (req, res) => {
    try {
      const merchants = await storage.getAllMerchants();
      res.json(merchants.map(toPublicMerchant));
    } catch (error) {
      res.status(500).json({ message: "Erro ao buscar comerciantes" });
    }
  });

  // Get merchant by ID
  app.get("/api/merchants/:id", authenticateToken, async (req, res) => {
    try {
      const merchant = await storage.getMerchant(req.params.id);
      if (!merchant) {
        return res.status(404).json({ message: "Comerciante não encontrado" });
      }
      res.json(toPublicMerchant(merchant));
    } catch (error) {
      res.status(500).json({ message: "Erro ao buscar comerciante" });
    }
  });

  // Public merchant registration (no authentication required)
  app.post("/api/merchants/register", async (req, res) => {
    try {
      const { planType, ...merchantData } = req.body;
      
      // Validate planType
      const validatedPlanType = z.enum(["trial", "vip"]).default("trial").parse(planType);
      
      // Validate merchant data
      const validatedData = insertMerchantSchema.parse(merchantData);

      console.log(`=== MERCHANT REGISTRATION ===`);
      console.log(`Email: ${validatedData.email}`);
      console.log(`Plan: ${validatedPlanType}`);
      console.log(`Original password length: ${validatedData.password.length}`);

      // Check if email already exists in merchants table
      const existingMerchant = await storage.getMerchantByEmail(validatedData.email);
      if (existingMerchant) {
        console.log(`Email ${validatedData.email} already exists`);
        return res.status(400).json({ message: "Email já está em uso" });
      }

      // Check if email exists in other user tables
      const existingUser = await storage.getUserByEmail(validatedData.email);
      if (existingUser) {
        return res.status(400).json({ message: "Este email já está cadastrado no sistema" });
      }

      // Get plan configuration from system settings
      const vipPriceSetting = await storage.getSystemSetting('vip_plan_price');
      const trialDurationSetting = await storage.getSystemSetting('trial_plan_duration');
      const vipDurationSetting = await storage.getSystemSetting('vip_plan_duration');

      const vipPrice = vipPriceSetting ? parseInt(vipPriceSetting.value) : 5000; // Default R$ 50.00
      const trialDuration = trialDurationSetting ? parseInt(trialDurationSetting.value) : 10; // Default 10 days
      const vipDuration = vipDurationSetting ? parseInt(vipDurationSetting.value) : 30; // Default 30 days

      // Create merchant with appropriate initial status
      let initialStatus = "active"; // Default for trial
      
      // Determine plan configuration
      if (validatedPlanType === "vip") {
        initialStatus = "payment_pending"; // VIP requires payment confirmation
      }

      // Pass the plain password to storage - it will handle the hashing
      const merchant = await storage.createMerchant({
        ...validatedData,
        status: initialStatus
      });
      
      const now = new Date();
      let accessDurationDays = trialDuration; // Use system setting for trial
      
      if (validatedPlanType === "vip") {
        accessDurationDays = vipDuration; // Use system setting for VIP
      }

      const accessEndDate = new Date(now);
      accessEndDate.setDate(now.getDate() + accessDurationDays);
      
      const nextPaymentDue = new Date(now);
      nextPaymentDue.setDate(now.getDate() + accessDurationDays);

      const accessUpdates = {
        status: initialStatus,
        accessStartDate: now,
        accessEndDate: accessEndDate,
        accessDurationDays: accessDurationDays,
        lastPaymentDate: validatedPlanType === "trial" ? now : null, // Only set payment date for trial
        nextPaymentDue: nextPaymentDue,
        paymentStatus: validatedPlanType === "trial" ? "trial" as const : "pending" as const, // Trial status for free accounts
        monthlyFee: validatedPlanType === "vip" ? vipPrice : 0, // Use system setting for VIP price
      };

      console.log(`Updating merchant ${merchant.id} with access settings:`, accessUpdates);
      await storage.updateMerchant(merchant.id, accessUpdates);
      
      // Get the updated merchant to return
      const updatedMerchant = await storage.getMerchant(merchant.id);
      console.log(`Final merchant state:`, {
        id: updatedMerchant?.id,
        email: updatedMerchant?.email,
        status: updatedMerchant?.status,
        paymentStatus: updatedMerchant?.paymentStatus,
        accessEndDate: updatedMerchant?.accessEndDate
      });
      console.log(`=== END MERCHANT REGISTRATION ===`);
      
      // Send welcome email (fire-and-forget to avoid blocking response)
      sendWelcomeEmail({
        name: validatedData.name,
        ownerName: validatedData.ownerName,
        email: validatedData.email,
        phone: validatedData.phone,
        address: validatedData.address,
        planType: validatedPlanType,
        accessEndDate: accessEndDate,
      }).then(emailResult => {
        if (emailResult.success) {
          console.log(`Welcome email sent successfully to ${validatedData.email}`);
        } else {
          console.error(`Failed to send welcome email to ${validatedData.email}:`, emailResult.error);
        }
      }).catch(error => {
        console.error(`Error in welcome email promise for ${validatedData.email}:`, error);
      });

      res.status(201).json({
        success: true,
        merchant: toPublicMerchant(updatedMerchant!),
        message: validatedPlanType === "trial" 
          ? "Cadastro realizado com sucesso! Sua conta está ativa por 10 dias. Verifique seu email para mais informações."
          : "Cadastro realizado! Aguardando confirmação de pagamento. Verifique seu email para mais informações.",
        planType: validatedPlanType,
        emailSent: "pending" // Email is sent asynchronously
      });
    } catch (error) {
      console.error("Error in merchant registration:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Dados inválidos", errors: error.errors });
      }
      res.status(500).json({ message: "Erro ao criar comerciante" });
    }
  });

  // Create new merchant
  app.post("/api/merchants", authenticateToken, async (req, res) => {
    try {
      const merchantData = insertMerchantSchema.parse(req.body);

      // Check if email already exists
      const existingMerchant = await storage.getMerchantByEmail(merchantData.email);
      if (existingMerchant) {
        return res.status(400).json({ message: "Email já está em uso" });
      }

      // Create merchant with basic data first
      const merchant = await storage.createMerchant(merchantData);
      
      // If created by admin, automatically grant 7 days free access
      if (req.user.role === "admin") {
        const now = new Date();
        const accessEndDate = new Date(now);
        accessEndDate.setDate(now.getDate() + 7);
        
        const nextPaymentDue = new Date(now);
        nextPaymentDue.setDate(now.getDate() + 7);

        const accessUpdates = {
          status: "active",
          accessStartDate: now,
          accessEndDate: accessEndDate,
          accessDurationDays: 7,
          lastPaymentDate: null, // No payment made for admin-created trial
          nextPaymentDue: nextPaymentDue,
          paymentStatus: "trial" as const, // Trial status for admin-created accounts
        };

        await storage.updateMerchant(merchant.id, accessUpdates);
        
        // Get the updated merchant to return
        const updatedMerchant = await storage.getMerchant(merchant.id);
        res.status(201).json(toPublicMerchant(updatedMerchant!));
      } else {
        res.status(201).json(toPublicMerchant(merchant));
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Dados inválidos", errors: error.errors });
      }
      res.status(500).json({ message: "Erro ao criar comerciante" });
    }
  });

  // Update merchant
  app.put("/api/merchants/:id", authenticateToken, async (req, res) => {
    try {
      const updates = insertMerchantSchema.partial().parse(req.body);

      // If email is being updated, check if it's already in use
      if (updates.email) {
        const existingMerchant = await storage.getMerchantByEmail(updates.email);
        if (existingMerchant && existingMerchant.id !== req.params.id) {
          return res.status(400).json({ message: "Email já está em uso" });
        }
      }

      const merchant = await storage.updateMerchant(req.params.id, updates);
      if (!merchant) {
        return res.status(404).json({ message: "Comerciante não encontrado" });
      }
      res.json(toPublicMerchant(merchant));
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Dados inválidos", errors: error.errors });
      }
      res.status(500).json({ message: "Erro ao atualizar comerciante" });
    }
  });

  // Delete merchant
  app.delete("/api/merchants/:id", authenticateToken, async (req, res) => {
    try {
      const success = await storage.deleteMerchant(req.params.id);
      if (!success) {
        return res.status(404).json({ message: "Comerciante não encontrado" });
      }
      res.json({ message: "Comerciante removido com sucesso" });
    } catch (error) {
      res.status(500).json({ message: "Erro ao remover comerciante" });
    }
  });

  // Update merchant status
  app.patch("/api/merchants/:id/status", authenticateToken, async (req, res) => {
    try {
      const { status } = req.body;
      if (!["active", "inactive", "pending"].includes(status)) {
        return res.status(400).json({ message: "Status inválido" });
      }

      const merchant = await storage.updateMerchant(req.params.id, { status });
      if (!merchant) {
        return res.status(404).json({ message: "Comerciante não encontrado" });
      }
      res.json(toPublicMerchant(merchant));
    } catch (error) {
      res.status(500).json({ message: "Erro ao atualizar status" });
    }
  });

  // Update merchant schedule/working hours
  app.patch("/api/merchants/:id/schedule", authenticateToken, async (req, res) => {
    try {
      console.log("=== DEBUG: SCHEDULE UPDATE ROUTE ===");
      console.log("Method:", req.method);
      console.log("URL:", req.url);
      console.log("Headers:", req.headers);
      console.log("User object:", req.user);
      console.log("Request body:", req.body);
      console.log("Merchant ID from params:", req.params.id);

      // Check if req.user exists
      if (!req.user) {
        console.error("ERROR: No user object found in request");
        return res.status(401).json({ message: "Token inválido ou expirado" });
      }

      console.log("User role:", req.user.role);
      console.log("User ID:", req.user.userId);

      // Only merchants can update their own schedule or admins can update any
      if (req.user.role === "merchant" && req.user.userId !== req.params.id) {
        console.error("Access denied: merchant trying to update another merchant's schedule");
        console.error("User ID:", req.user.userId, "vs Merchant ID:", req.params.id);
        return res.status(403).json({ message: "Acesso negado - merchant não pode alterar outro salão" });
      }

      // Admin users can update any merchant's schedule
      if (req.user.role !== "merchant" && req.user.role !== "admin") {
        console.error("Access denied: user role not authorized:", req.user.role);
        return res.status(403).json({ message: "Acesso negado - role não autorizado" });
      }

      console.log("Authorization passed");

      // Basic validation first
      if (!req.body.workDays || !req.body.startTime || !req.body.endTime) {
        console.error("Missing required fields:");
        console.error("workDays:", req.body.workDays);
        console.error("startTime:", req.body.startTime);
        console.error("endTime:", req.body.endTime);
        return res.status(400).json({ message: "Dados obrigatórios não fornecidos" });
      }

      // Clean the data
      const scheduleData = {
        workDays: req.body.workDays,
        startTime: req.body.startTime,
        endTime: req.body.endTime,
        breakStartTime: req.body.breakStartTime || null,
        breakEndTime: req.body.breakEndTime || null,
      };

      console.log("Schedule data to update:", scheduleData);

      const merchant = await storage.updateMerchant(req.params.id, scheduleData);
      if (!merchant) {
        console.error("Merchant not found in database:", req.params.id);
        return res.status(404).json({ message: "Comerciante não encontrado" });
      }

      console.log("Merchant updated successfully:", merchant.id);
      const publicMerchant = toPublicMerchant(merchant);
      console.log("Returning public merchant data:", publicMerchant);

      res.json(publicMerchant);
    } catch (error) {
      console.error("=== ERROR in schedule update route ===");
      console.error("Error message:", error.message);
      console.error("Error stack:", error.stack);
      res.status(500).json({ message: "Erro ao atualizar horários de funcionamento", error: error.message });
    }
  });

  // Update merchant logo
  app.patch("/api/merchants/:id/logo", authenticateToken, async (req, res) => {
    try {
      // Only merchants can update their own logo or admins can update any
      if (req.user.role === "merchant" && req.user.userId !== req.params.id) {
        return res.status(403).json({ message: "Acesso negado" });
      }

      if (req.user.role !== "merchant" && req.user.role !== "admin") {
        return res.status(403).json({ message: "Acesso negado" });
      }

      // Validate input - accept both full URLs and relative paths
      const logoSchema = z.object({
        logoUrl: z.string().max(2048, "URL muito longa").refine(
          (url) => {
            // Accept relative paths starting with /uploads/ or full URLs
            return url.startsWith('/uploads/') || z.string().url().safeParse(url).success;
          },
          {
            message: "URL deve ser uma URL válida ou um caminho relativo começando com /uploads/"
          }
        ).optional()
      });

      const validatedData = logoSchema.parse(req.body);

      const merchant = await storage.updateMerchant(req.params.id, { logoUrl: validatedData.logoUrl || null });
      if (!merchant) {
        return res.status(404).json({ message: "Comerciante não encontrado" });
      }

      res.json(toPublicMerchant(merchant));
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error("Logo validation error:", error.errors);
        return res.status(400).json({ message: "URL inválida", errors: error.errors });
      }
      console.error("Logo update error:", error);
      res.status(500).json({ message: "Erro ao atualizar logo" });
    }
  });

  // Update merchant open/closed status
  app.patch("/api/merchants/:id/is-open", authenticateToken, async (req, res) => {
    try {
      // Only merchants can update their own status or admins can update any
      if (req.user.role === "merchant" && req.user.userId !== req.params.id) {
        return res.status(403).json({ message: "Acesso negado" });
      }

      if (req.user.role !== "merchant" && req.user.role !== "admin") {
        return res.status(403).json({ message: "Acesso negado" });
      }

      // Validate input
      const statusSchema = z.object({
        isOpen: z.boolean()
      });

      const validatedData = statusSchema.parse(req.body);

      const merchant = await storage.updateMerchant(req.params.id, { isOpen: validatedData.isOpen });
      if (!merchant) {
        return res.status(404).json({ message: "Comerciante não encontrado" });
      }

      res.json(toPublicMerchant(merchant));
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Dados inválidos", errors: error.errors });
      }
      res.status(500).json({ message: "Erro ao atualizar status de funcionamento" });
    }
  });

  // Get merchant booking policies
  app.get("/api/merchants/:id/booking-policies", authenticateToken, async (req, res) => {
    try {
      // Only merchants can get their own policies or admins can get any
      if (req.user.role === "merchant" && req.user.userId !== req.params.id) {
        return res.status(403).json({ message: "Acesso negado" });
      }

      if (req.user.role !== "merchant" && req.user.role !== "admin") {
        return res.status(403).json({ message: "Acesso negado" });
      }

      const merchant = await storage.getMerchant(req.params.id);
      if (!merchant) {
        return res.status(404).json({ message: "Comerciante não encontrado" });
      }

      // Return booking policies with defaults for backward compatibility
      const bookingPolicies = {
        noShowFeeEnabled: merchant.noShowFeeEnabled ?? false,
        noShowFeeAmount: merchant.noShowFeeAmount ?? 0,
        lateFeeEnabled: merchant.lateFeeEnabled ?? false,
        lateFeeAmount: merchant.lateFeeAmount ?? 0,
        lateToleranceMinutes: merchant.lateToleranceMinutes ?? 15,
        cancellationPolicyHours: merchant.cancellationPolicyHours ?? 24,
        cancellationFeeEnabled: merchant.cancellationFeeEnabled ?? false,
        cancellationFeeAmount: merchant.cancellationFeeAmount ?? 0,
      };

      res.json(bookingPolicies);
    } catch (error) {
      console.error("Booking policies get error:", error);
      res.status(500).json({ message: "Erro ao buscar políticas de agendamento" });
    }
  });

  // Update merchant booking policies
  app.patch("/api/merchants/:id/booking-policies", authenticateToken, async (req, res) => {
    try {
      // Only merchants can update their own policies or admins can update any
      if (req.user.role === "merchant" && req.user.userId !== req.params.id) {
        return res.status(403).json({ message: "Acesso negado" });
      }

      if (req.user.role !== "merchant" && req.user.role !== "admin") {
        return res.status(403).json({ message: "Acesso negado" });
      }

      // Validate the booking policies data
      const validatedData = bookingPoliciesSchema.parse(req.body);

      const merchant = await storage.updateMerchant(req.params.id, {
        noShowFeeEnabled: validatedData.noShowFeeEnabled,
        noShowFeeAmount: validatedData.noShowFeeAmount,
        lateFeeEnabled: validatedData.lateFeeEnabled,
        lateFeeAmount: validatedData.lateFeeAmount,
        lateToleranceMinutes: validatedData.lateToleranceMinutes,
        cancellationPolicyHours: validatedData.cancellationPolicyHours,
        cancellationFeeEnabled: validatedData.cancellationFeeEnabled,
        cancellationFeeAmount: validatedData.cancellationFeeAmount,
      });

      if (!merchant) {
        return res.status(404).json({ message: "Comerciante não encontrado" });
      }

      res.json({
        message: "Políticas de agendamento atualizadas com sucesso",
        bookingPolicies: {
          noShowFeeEnabled: merchant.noShowFeeEnabled,
          noShowFeeAmount: merchant.noShowFeeAmount,
          lateFeeEnabled: merchant.lateFeeEnabled,
          lateFeeAmount: merchant.lateFeeAmount,
          lateToleranceMinutes: merchant.lateToleranceMinutes,
          cancellationPolicyHours: merchant.cancellationPolicyHours,
          cancellationFeeEnabled: merchant.cancellationFeeEnabled,
          cancellationFeeAmount: merchant.cancellationFeeAmount,
        }
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "Dados inválidos", 
          errors: error.errors 
        });
      }
      console.error("Booking policies update error:", error);
      res.status(500).json({ message: "Erro ao atualizar políticas de agendamento" });
    }
  });

  // VIP Plan Management endpoints
  app.post("/api/merchant/upgrade-vip", authenticateToken, async (req, res) => {
    try {
      if (req.user.role !== "merchant") {
        return res.status(403).json({ message: "Acesso negado" });
      }

      const merchantId = req.user.userId;
      const now = new Date();
      const vipEndDate = new Date(now);
      vipEndDate.setDate(now.getDate() + 30); // 30 days VIP

      const merchant = await storage.updateMerchant(merchantId, {
        planStatus: "vip",
        planValidity: vipEndDate,
        paymentStatus: "paid"
      });

      if (!merchant) {
        return res.status(404).json({ message: "Comerciante não encontrado" });
      }

      res.json({ 
        message: "Plano VIP ativado com sucesso!",
        planValidity: vipEndDate,
        planStatus: "vip"
      });
    } catch (error) {
      console.error("Error upgrading to VIP:", error);
      res.status(500).json({ message: "Erro ao ativar plano VIP" });
    }
  });

  app.post("/api/merchant/renew-vip", authenticateToken, async (req, res) => {
    try {
      if (req.user.role !== "merchant") {
        return res.status(403).json({ message: "Acesso negado" });
      }

      const merchantId = req.user.userId;
      const merchant = await storage.getMerchant(merchantId);
      
      if (!merchant) {
        return res.status(404).json({ message: "Comerciante não encontrado" });
      }

      const now = new Date();
      let newEndDate: Date;

      if (merchant.planValidity && new Date(merchant.planValidity) > now) {
        // Extend from current end date
        newEndDate = new Date(merchant.planValidity);
        newEndDate.setDate(newEndDate.getDate() + 30);
      } else {
        // Start from now if expired
        newEndDate = new Date(now);
        newEndDate.setDate(now.getDate() + 30);
      }

      const updatedMerchant = await storage.updateMerchant(merchantId, {
        planStatus: "vip",
        planValidity: newEndDate,
        paymentStatus: "paid"
      });

      res.json({ 
        message: "Plano VIP renovado com sucesso!",
        planValidity: newEndDate,
        planStatus: "vip"
      });
    } catch (error) {
      console.error("Error renewing VIP:", error);
      res.status(500).json({ message: "Erro ao renovar plano VIP" });
    }
  });

  // Get merchant for client (only their associated merchant)
  app.get("/api/client/merchants", authenticateToken, async (req, res) => {
    try {
      // Only clients can access this endpoint
      if (req.user.role !== "client") {
        return res.status(403).json({ message: "Acesso negado" });
      }

      const merchantId = req.user.merchantId;
      if (!merchantId) {
        return res.status(400).json({ message: "Merchant ID não encontrado" });
      }

      const merchant = await storage.getMerchant(merchantId);
      if (!merchant) {
        return res.status(404).json({ message: "Salão não encontrado" });
      }

      // Only return the merchant if it's active
      if (merchant.status !== "active") {
        return res.status(403).json({ message: "Salão não está ativo" });
      }

      // Return public merchant information
      const publicMerchant = {
        id: merchant.id,
        name: merchant.name,
        address: merchant.address,
        phone: merchant.phone,
        logoUrl: merchant.logoUrl,
        isOpen: merchant.isOpen,
        workDays: merchant.workDays,
        startTime: merchant.startTime,
        endTime: merchant.endTime,
        breakStartTime: merchant.breakStartTime,
        breakEndTime: merchant.breakEndTime,
      };

      res.json([publicMerchant]); // Return as array to maintain compatibility with frontend
    } catch (error) {
      res.status(500).json({ message: "Erro ao buscar salão" });
    }
  });

  // Services endpoints
  // Get services for a merchant
  app.get("/api/services", requireAuth, requireRole(["merchant"]), async (req, res) => {
    try {
      const merchantId = req.user.userId;
      const userEmail = req.user.email;

      console.log(`\n🚀 === API SERVICES ENDPOINT DEBUG ===`);
      console.log(`📧 Request from user: ${userEmail}`);
      console.log(`🆔 Merchant ID: ${merchantId}`);
      console.log(`🔑 User object:`, JSON.stringify(req.user, null, 2));

      // First let's check if this merchant exists
      const merchant = await storage.getMerchant(merchantId);
      console.log(`🏪 Merchant lookup result: ${merchant ? `Found "${merchant.name}" (${merchant.email})` : 'NOT FOUND'}`);

      if (!merchant) {
        console.error(`❌ CRITICAL: Merchant ${merchantId} not found in database!`);
        return res.status(404).json({ message: "Comerciante não encontrado" });
      }

      // Verify the merchant ID matches the authenticated user
      if (merchant.id !== merchantId) {
        console.error(`❌ SECURITY BREACH: Merchant ID mismatch! Auth: ${merchantId}, DB: ${merchant.id}`);
        return res.status(403).json({ message: "Acesso negado" });
      }

      console.log(`✅ Merchant verification passed. Fetching services...`);

      const services = await storage.getServicesByMerchant(merchantId);

      // Enrich services with promotion information
      const servicesWithPromotions = await Promise.all(
        services.map(async (service) => {
          const promotionInfo = await storage.calculatePromotionalPrice(service.id, service.price);
          return {
            ...service,
            hasPromotion: promotionInfo.hasPromotion,
            originalPrice: promotionInfo.originalPrice,
            promotionalPrice: promotionInfo.promotionalPrice,
            promotion: promotionInfo.discount
          };
        })
      );

      console.log(`\n📊 API RESULT SUMMARY:`);
      console.log(`- Merchant: "${merchant.name}" (${merchant.email})`);
      console.log(`- Services found: ${servicesWithPromotions.length}`);
      servicesWithPromotions.forEach((service, index) => {
        console.log(`  [${index}] "${service.name}" (ID: ${service.id.substring(0, 8)}...) - Active: ${service.isActive} - Has Promotion: ${service.hasPromotion}`);
      });

      console.log(`🎯 Returning ${servicesWithPromotions.length} services to frontend`);
      console.log(`=== END API SERVICES DEBUG ===\n`);

      res.json(servicesWithPromotions);
    } catch (error) {
      console.error("❌ CRITICAL ERROR in services endpoint:", error);
      console.error("Error stack:", (error as Error).stack);
      res.status(500).json({ message: "Erro ao buscar serviços" });
    }
  });

  // Get active services for a merchant
  app.get("/api/services/active", requireAuth, async (req, res) => {
    try {
      const user = req.user;
      console.log("User in active services request:", user);

      if (user.role !== "merchant") {
        return res.status(403).json({ message: "Access denied" });
      }

      // Use the userId directly as merchantId since merchant login sets userId = merchant.id
      const merchant = await storage.getMerchant(user.userId);
      console.log("Found merchant:", merchant);

      if (!merchant) {
        return res.status(404).json({ message: "Merchant not found" });
      }

      const services = await storage.getActiveServicesByMerchant(merchant.id);
      console.log(`Active services for merchant ${merchant.id}:`, services);
      res.json(services);
    } catch (error) {
      console.error("Error fetching active services:", error);
      console.error("Stack trace:", (error as Error).stack);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Create service
  app.post("/api/services", authenticateToken, async (req, res) => {
    try {
      console.log(`=== CREATE SERVICE DEBUG ===`);
      console.log(`User creating service:`, {
        userId: req.user.userId,
        email: req.user.email,
        role: req.user.role
      });
      console.log(`Request body:`, req.body);

      if (req.user.role !== "merchant") {
        console.error(`Non-merchant user trying to create service: ${req.user.role}`);
        return res.status(403).json({ message: "Acesso negado" });
      }

      const serviceData = serviceSchema.parse({
        ...req.body,
        merchantId: req.user.userId,
      });

      console.log(`Parsed service data:`, serviceData);
      console.log(`Service will be created for merchantId: ${serviceData.merchantId}`);

      const service = await storage.createService(serviceData);

      console.log(`Service created successfully:`, {
        id: service.id,
        name: service.name,
        merchantId: service.merchantId,
        belongsToCreator: service.merchantId === req.user.userId
      });
      console.log(`=== END CREATE SERVICE DEBUG ===`);

      res.status(201).json(service);
    } catch (error) {
      console.error(`Error creating service:`, error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Dados inválidos", errors: error.errors });
      }
      res.status(500).json({ message: "Erro ao criar serviço" });
    }
  });

  // Update service
  app.put("/api/services/:id", authenticateToken, async (req, res) => {
    try {
      if (req.user.role !== "merchant") {
        return res.status(403).json({ message: "Acesso negado" });
      }

      const updates = serviceSchema.partial().parse(req.body);
      const service = await storage.updateService(req.params.id, updates);

      if (!service) {
        return res.status(404).json({ message: "Serviço não encontrado" });
      }

      // Verify service belongs to the merchant
      if (service.merchantId !== req.user.userId) {
        return res.status(403).json({ message: "Acesso negado" });
      }

      res.json(service);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Dados inválidos", errors: error.errors });
      }
      res.status(500).json({ message: "Erro ao atualizar serviço" });
    }
  });

  // Delete service
  app.delete("/api/services/:id", authenticateToken, async (req, res) => {
    try {
      if (req.user.role !== "merchant") {
        return res.status(403).json({ message: "Acesso negado" });
      }

      const service = await storage.getService(req.params.id);
      if (!service) {
        return res.status(404).json({ message: "Serviço não encontrado" });
      }

      // Verify service belongs to the merchant
      if (service.merchantId !== req.user.userId) {
        return res.status(403).json({ message: "Acesso negado" });
      }

      // Manual cascade delete: first delete all appointments related to this service
      const deletedAppointments = await storage.deleteAppointmentsByService(req.params.id);
      console.log(`Deleted ${deletedAppointments} appointments for service ${req.params.id}`);

      // Then delete the service itself
      const success = await storage.deleteService(req.params.id);
      if (!success) {
        return res.status(404).json({ message: "Serviço não encontrado" });
      }

      res.json({ 
        message: "Serviço removido com sucesso", 
        deletedAppointments: deletedAppointments 
      });
    } catch (error) {
      res.status(500).json({ message: "Erro ao remover serviço" });
    }
  });

  // Employee endpoints
  // Get employees for a merchant
  app.get("/api/employees", authenticateToken, async (req, res) => {
    try {
      console.log("\n=== 🚀 DEBUG EMPLOYEES ENDPOINT ===");
      console.log("📍 Request URL:", req.url);
      console.log("👤 User from token:", {
        userId: req.user.userId,
        email: req.user.email,
        role: req.user.role
      });

      let merchantId: string;

      if (req.user.role === "merchant") {
        merchantId = req.user.userId; // Force merchant to only see their own employees
        console.log(`🔒 Backend: Merchant ${req.user.email} accessing own employeesMerchantId: ${merchantId.substring(0, 8)}...`);
      } else if (req.user.role === "admin") {
        merchantId = req.query.merchantId as string;
        if (!merchantId) {
          console.error("❌ Admin request missing merchantId parameter");
          return res.status(400).json({ message: "Merchant ID é obrigatório para admins" });
        }
        console.log(`👨‍💼 Backend: Admin ${req.user.email} accessing merchantId: ${merchantId.substring(0, 8)}...`);
      } else {
        console.error(`🚨 Backend SECURITY VIOLATION: Unauthorized role ${req.user.role} trying to access employees`);
        return res.status(403).json({ message: "Acesso negado" });
      }

      console.log(`📞 Backend: Fetching employees for merchantId: ${merchantId.substring(0, 8)}...`);
      const employees = await storage.getEmployeesByMerchant(merchantId);

      console.log(`📊 Backend: Employees returned: ${employees.length} employees`);

      // Security check: ensure all employees belong to the requested merchant
      const validEmployees = employees.filter(employee => employee.merchantId === merchantId);

      if (validEmployees.length !== employees.length) {
        console.error(`🚨 SECURITY BREACH: Found employees that don't belong to merchant ${merchantId}`);
        return res.status(403).json({ message: "Erro de segurança detectado" });
      }

      console.log(`✅ All ${validEmployees.length} employees verified for merchant ${merchantId.substring(0, 8)}...`);
      res.json(validEmployees.map(toPublicEmployee));
      console.log(`=== END DEBUG EMPLOYEES ENDPOINT ===\n`);
    } catch (error) {
      console.error("Error getting employees:", error);
      res.status(500).json({ message: "Erro ao buscar funcionários" });
    }
  });

  // Create employee
  app.post("/api/employees", authenticateToken, async (req, res) => {
    try {
      if (req.user.role !== "merchant") {
        return res.status(403).json({ message: "Acesso negado" });
      }

      const employeeData = insertEmployeeSchema.parse({
        ...req.body,
        merchantId: req.user.userId,
      });

      // Check if email already exists
      const existingEmployee = await storage.getEmployeeByEmail(employeeData.email);
      if (existingEmployee) {
        return res.status(400).json({ message: "Email já está em uso" });
      }

      const employee = await storage.createEmployee(employeeData);
      res.status(201).json(toPublicEmployee(employee));
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Dados inválidos", errors: error.errors });
      }
      console.error("Error creating employee:", error);
      res.status(500).json({ message: "Erro ao criar funcionário" });
    }
  });

  // Update employee
  app.put("/api/employees/:id", authenticateToken, async (req, res) => {
    try {
      if (req.user.role !== "merchant") {
        return res.status(403).json({ message: "Acesso negado" });
      }

      const updates = insertEmployeeSchema.partial().parse(req.body);

      // Check if email is being updated and is already in use
      if (updates.email) {
        const existingEmployee = await storage.getEmployeeByEmail(updates.email);
        if (existingEmployee && existingEmployee.id !== req.params.id) {
          return res.status(400).json({ message: "Email já está em uso" });
        }
      }

      const employee = await storage.updateEmployee(req.params.id, updates);
      if (!employee) {
        return res.status(404).json({ message: "Funcionário não encontrado" });
      }

      // Verify employee belongs to the merchant
      if (employee.merchantId !== req.user.userId) {
        return res.status(403).json({ message: "Acesso negado" });
      }

      res.json(toPublicEmployee(employee));
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Dados inválidos", errors: error.errors });
      }
      res.status(500).json({ message: "Erro ao atualizar funcionário" });
    }
  });

  // Delete employee
  app.delete("/api/employees/:id", authenticateToken, async (req, res) => {
    try {
      if (req.user.role !== "merchant") {
        return res.status(403).json({ message: "Acesso negado" });
      }

      const employee = await storage.getEmployee(req.params.id);
      if (!employee) {
        return res.status(404).json({ message: "Funcionário não encontrado" });
      }

      // Verify employee belongs to the merchant
      if (employee.merchantId !== req.user.userId) {
        return res.status(403).json({ message: "Acesso negado" });
      }

      const success = await storage.deleteEmployee(req.params.id);
      if (!success) {
        return res.status(404).json({ message: "Funcionário não encontrado" });
      }

      res.json({ message: "Funcionário removido com sucesso" });
    } catch (error) {
      res.status(500).json({ message: "Erro ao remover funcionário" });
    }
  });

  // Client endpoints
  // Get clients for a merchant
  app.get("/api/clients", authenticateToken, async (req, res) => {
    try {
      console.log("\n=== 🚀 DEBUG CLIENTS ENDPOINT ===");
      console.log("📍 Request URL:", req.url);
      console.log("👤 User from token:", {
        userId: req.user.userId,
        email: req.user.email,
        role: req.user.role
      });

      let merchantId: string;

      if (req.user.role === "merchant") {
        merchantId = req.user.userId; // Force merchant to only see their own clients
        console.log(`🔒 Backend: Merchant ${req.user.email} accessing own clients MerchantId: ${merchantId.substring(0, 8)}...`);
      } else if (req.user.role === "admin") {
        merchantId = req.query.merchantId as string;
        if (!merchantId) {
          console.error("❌ Admin request missing merchantId parameter");
          return res.status(400).json({ message: "Merchant ID é obrigatório para admins" });
        }
        console.log(`👨‍💼 Backend: Admin ${req.user.email} accessing merchantId: ${merchantId.substring(0, 8)}...`);
      } else {
        console.error(`🚨 Backend SECURITY VIOLATION: Unauthorized role ${req.user.role} trying to access clients`);
        return res.status(403).json({ message: "Acesso negado" });
      }

      console.log(`📞 Backend: Fetching clients for merchantId: ${merchantId.substring(0, 8)}...`);
      const clients = await storage.getClientsByMerchant(merchantId);

      console.log(`📊 Backend: Clients returned: ${clients.length} clients`);

      // Security check: ensure all clients belong to the requested merchant
      const validClients = clients.filter(client => client.merchantId === merchantId);

      if (validClients.length !== clients.length) {
        console.error(`🚨 SECURITY BREACH: Found clients that don't belong to merchant ${merchantId}`);
        return res.status(403).json({ message: "Erro de segurança detectado" });
      }

      console.log(`✅ All ${validClients.length} clients verified for merchant ${merchantId.substring(0, 8)}...`);
      res.json(validClients.map(toPublicClient));
      console.log(`=== END DEBUG CLIENTS ENDPOINT ===\n`);
    } catch (error) {
      console.error("Error getting clients:", error);
      res.status(500).json({ message: "Erro ao buscar clientes" });
    }
  });

  // Create client
  app.post("/api/clients", authenticateToken, async (req, res) => {
    try {
      if (req.user.role !== "merchant") {
        return res.status(403).json({ message: "Acesso negado" });
      }

      const clientData = insertClientSchema.parse({
        ...req.body,
        merchantId: req.user.userId,
      });

      // Check if email already exists
      const existingClient = await storage.getClientByEmail(clientData.email);
      if (existingClient) {
        return res.status(400).json({ message: "Email já está em uso" });
      }

      const client = await storage.createClient(clientData);
      res.status(201).json(toPublicClient(client));
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Dados inválidos", errors: error.errors });
      }
      res.status(500).json({ message: "Erro ao criar cliente" });
    }
  });

  // Update client
  app.put("/api/clients/:id", authenticateToken, async (req, res) => {
    try {
      if (req.user.role !== "merchant") {
        return res.status(403).json({ message: "Acesso negado" });
      }

      const updates = insertClientSchema.partial().parse(req.body);

      // Check if email is being updated and is already in use
      if (updates.email) {
        const existingClient = await storage.getClientByEmail(updates.email);
        if (existingClient && existingClient.id !== req.params.id) {
          return res.status(400).json({ message: "Email já está em uso" });
        }
      }

      const client = await storage.updateClient(req.params.id, updates);
      if (!client) {
        return res.status(404).json({ message: "Cliente não encontrado" });
      }

      // Verify client belongs to the merchant
      if (client.merchantId !== req.user.userId) {
        return res.status(403).json({ message: "Acesso negado" });
      }

      res.json(toPublicClient(client));
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Dados inválidos", errors: error.errors });
      }
      res.status(500).json({ message: "Erro ao atualizar cliente" });
    }
  });

  // Delete client
  app.delete("/api/clients/:id", authenticateToken, async (req, res) => {
    try {
      if (req.user.role !== "merchant") {
        return res.status(403).json({ message: "Acesso negado" });
      }

      const client = await storage.getClient(req.params.id);
      if (!client) {
        return res.status(404).json({ message: "Cliente não encontrado" });
      }

      // Verify client belongs to the merchant
      if (client.merchantId !== req.user.userId) {
        return res.status(403).json({ message: "Acesso negado" });
      }

      const success = await storage.deleteClient(req.params.id);
      if (!success) {
        return res.status(404).json({ message: "Cliente não encontrado" });
      }

      res.json({ message: "Cliente removido com sucesso" });
    } catch (error) {
      res.status(500).json({ message: "Erro ao remover cliente" });
    }
  });

  // Appointments endpoints
  // Get pending payment appointments for merchant (MUST be before :id route)
  app.get("/api/appointments/pending-payments", authenticateToken, async (req, res) => {
    try {
      if (req.user.role !== "merchant") {
        return res.status(403).json({ message: "Acesso negado - apenas comerciantes" });
      }

      const merchantId = req.user.userId;
      const pendingPayments = await storage.getPendingPaymentAppointments(merchantId);

      res.json(pendingPayments);
    } catch (error) {
      console.error("Error getting pending payment appointments:", error);
      res.status(500).json({ message: "Erro ao buscar agendamentos pendentes de pagamento" });
    }
  });

  // Get single appointment by ID
  app.get("/api/appointments/:id", authenticateToken, async (req, res) => {
    try {
      const appointmentId = req.params.id;
      const user = (req as any).user;

      const appointment = await storage.getAppointment(appointmentId);
      if (!appointment) {
        return res.status(404).json({ message: "Agendamento não encontrado" });
      }

      // Verify access permissions
      let hasAccess = false;
      if (user.role === "merchant" && appointment.merchantId === user.userId) {
        hasAccess = true;
      } else if (user.role === "employee" && appointment.merchantId === user.merchantId) {
        hasAccess = true;
      } else if (user.role === "client" && appointment.clientId === user.userId) {
        hasAccess = true;
      } else if (user.role === "admin") {
        hasAccess = true;
      }

      if (!hasAccess) {
        return res.status(403).json({ message: "Acesso negado" });
      }

      res.json(appointment);
    } catch (error) {
      console.error("Error fetching appointment:", error);
      res.status(500).json({ message: "Erro ao buscar agendamento" });
    }
  });

  // Get appointments for a merchant
  app.get("/api/appointments", authenticateToken, async (req, res) => {
    try {
      const { date, startDate, endDate } = req.query;
      const user = (req as any).user;

      let merchantId: string;

      // Determine merchant ID based on user role
      if (user.role === "merchant") {
        merchantId = user.userId;
      } else if (user.role === "employee") {
        merchantId = user.merchantId;
        if (!merchantId) {
          return res.status(400).json({ message: "Funcionário não associado a um comerciante" });
        }
      } else if (user.role === "admin") {
        merchantId = req.query.merchantId as string;
        if (!merchantId) {
          return res.status(400).json({ message: "Merchant ID é obrigatório para admins" });
        }
      } else {
        return res.status(403).json({ message: "Acesso negado" });
      }

      let appointments;

      // Handle different query types
      if (date) {
        appointments = await storage.getAppointmentsByDate(merchantId, date as string);
      } else if (startDate && endDate) {
        appointments = await storage.getAppointmentsByDateRange(merchantId, startDate as string, endDate as string);
      } else {
        // Return all appointments for the merchant
        if (user.role === "employee") {
          appointments = await storage.getAppointmentsByEmployee(user.userId);
        } else {
          appointments = await storage.getAppointmentsByMerchant(merchantId);
        }
      }

      // Security check: ensure all appointments belong to the correct merchant
      const validAppointments = appointments.filter(appointment => appointment.merchantId === merchantId);

      res.json(validAppointments);
    } catch (error) {
      console.error("Error fetching appointments:", error);
      res.status(500).json({ message: "Erro ao buscar agendamentos" });
    }
  });

  // Create appointment
  app.post("/api/appointments", requireAuth, async (req, res) => {
    try {
      const user = req.user;
      console.log("User in appointment creation:", user);
      console.log("Request body:", req.body);

      if (user.role !== "merchant") {
        return res.status(403).json({ message: "Access denied" });
      }

      // Use the userId directly as merchantId since merchant login sets userId = merchant.id
      const merchant = await storage.getMerchant(user.userId);
      console.log("Found merchant for appointment:", merchant);

      if (!merchant) {
        return res.status(404).json({ message: "Merchant not found" });
      }

      // Validate required fields
      const { serviceId, clientName, clientPhone, appointmentDate, appointmentTime } = req.body;

      if (!serviceId || !clientName || !clientPhone || !appointmentDate || !appointmentTime) {
        console.log("Missing required fields:", { serviceId, clientName, clientPhone, appointmentDate, appointmentTime });
        return res.status(400).json({ message: "Missing required fields" });
      }

      // Check if client has pending penalties
      let clientPenalties = [];
      let hasPendingPenalties = false;
      
      // If there's a clientId, check for existing penalties
      if (req.body.clientId) {
        clientPenalties = await storage.getPenaltiesByClient(req.body.clientId);
        hasPendingPenalties = clientPenalties.some(penalty => penalty.status === "pending");
      } else {
        // If no clientId, check by phone number (for walk-in clients)
        const allPenalties = await storage.getPenaltiesByMerchant(merchant.id);
        clientPenalties = allPenalties.filter(penalty => 
          penalty.clientPhone === clientPhone && penalty.status === "pending"
        );
        hasPendingPenalties = clientPenalties.length > 0;
      }

      // Get service to calculate end time
      const service = await storage.getService(serviceId);
      if (!service) {
        return res.status(404).json({ message: "Serviço não encontrado" });
      }

      // Calculate promotional price if applicable
      const promotionInfo = await storage.calculatePromotionalPrice(serviceId, service.price);
      const finalPrice = promotionInfo.hasPromotion ? promotionInfo.promotionalPrice : service.price;

      // Calculate end time based on service duration
      const [hours, minutes] = appointmentTime.split(':').map(Number);
      const endMinutes = minutes + service.duration;
      const endHour = hours + Math.floor(endMinutes / 60);
      const finalMinutes = endMinutes % 60;
      const endTime = `${endHour.toString().padStart(2, '0')}:${finalMinutes.toString().padStart(2, '0')}`;

      const appointmentData = {
        merchantId: merchant.id,
        serviceId,
        clientId: req.body.clientId || null,
        employeeId: req.body.employeeId || null,
        clientName,
        clientPhone,
        clientEmail: req.body.clientEmail || null,
        appointmentDate,
        appointmentTime,
        endTime,
        notes: req.body.notes || null,
        status: "pending"
      };

      console.log('Creating appointment:', appointmentData);
      const appointment = await storage.createAppointment(appointmentData);
      console.log('Appointment created successfully:', appointment);
      
      // Return appointment with penalty warning if applicable
      const response = {
        ...appointment,
        hasPendingPenalties,
        pendingPenaltiesCount: clientPenalties.length,
        pendingPenaltiesAmount: clientPenalties.reduce((total, penalty) => total + penalty.amount, 0)
      };
      
      if (hasPendingPenalties) {
        console.log(`⚠️ WARNING: Client ${clientName} (${clientPhone}) has ${clientPenalties.length} pending penalties`);
      }
      
      res.status(201).json(response);
    } catch (error) {
      console.error("Error creating appointment:", error);
      console.error("Stack trace:", (error as Error).stack);
      res.status(500).json({ message: (error as Error).message || "Internal server error" });
    }
  });

  // Update appointment
  app.put("/api/appointments/:id", authenticateToken, async (req, res) => {
    try {
      // Check if the user is a merchant or an employee
      if (req.user.role !== "merchant" && req.user.role !== "employee") {
        return res.status(403).json({ message: "Acesso negado" });
      }

      const updates = appointmentSchema.partial().parse(req.body);
      const appointment = await storage.updateAppointment(req.params.id, updates);

      if (!appointment) {
        return res.status(404).json({ message: "Agendamento não encontrado" });
      }

      // Verify appointment belongs to the merchant (or employee's merchant)
      const userMerchantId = req.user.role === "merchant" ? req.user.userId : req.user.merchantId;
      if (appointment.merchantId !== userMerchantId) {
        return res.status(403).json({ message: "Acesso negado" });
      }

      // Handle status updates with proper validation
      if (updates.status && updates.rescheduleReason) {
        // Reschedule reason is handled by the storage layer
      }

      res.json(appointment);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Dados inválidos", errors: error.errors });
      }
      console.error("Error updating appointment:", error);
      res.status(500).json({ message: "Erro ao atualizar agendamento" });
    }
  });

  // Delete appointment
  app.delete("/api/appointments/:id", authenticateToken, async (req, res) => {
    try {
      if (req.user.role !== "merchant" && req.user.role !== "employee") {
        return res.status(403).json({ message: "Acesso negado" });
      }

      const appointment = await storage.getAppointment(req.params.id);
      if (!appointment) {
        return res.status(404).json({ message: "Agendamento não encontrado" });
      }

      // Verify appointment belongs to the merchant (or employee's merchant)
      const userMerchantId = req.user.role === "merchant" ? req.user.userId : req.user.merchantId;
      if (appointment.merchantId !== userMerchantId) {
        return res.status(403).json({ message: "Acesso negado" });
      }

      const success = await storage.deleteAppointment(req.params.id);
      if (!success) {
        return res.status(404).json({ message: "Agendamento não encontrado" });
      }

      res.json({ message: "Agendamento removido com sucesso" });
    } catch (error) {
      res.status(500).json({ message: "Erro ao remover agendamento" });
    }
  });

  // New Beauty Scheduler API endpoints

  // Check employee availability
  app.post("/api/appointments/check-availability", authenticateToken, async (req, res) => {
    try {
      const { employeeId, date, startTime, duration } = req.body;

      if (!employeeId || !date || !startTime || !duration) {
        return res.status(400).json({ message: "Campos obrigatórios: employeeId, date, startTime, duration" });
      }

      const isAvailable = await storage.checkEmployeeAvailability({
        employeeId,
        date,
        startTime,
        duration
      });

      res.json({ available: isAvailable });
    } catch (error) {
      console.error("Error checking availability:", error);
      res.status(500).json({ message: "Erro ao verificar disponibilidade" });
    }
  });

  // Get available time slots for employee
  app.get("/api/appointments/available-slots/:employeeId", authenticateToken, async (req, res) => {
    try {
      const { employeeId } = req.params;
      const { date, duration } = req.query;

      if (!date || !duration) {
        return res.status(400).json({ message: "Parâmetros obrigatórios: date, duration" });
      }

      const slots = await storage.getEmployeeAvailableSlots(
        employeeId,
        date as string,
        parseInt(duration as string)
      );

      res.json({ slots });
    } catch (error) {
      console.error("Error getting available slots:", error);
      res.status(500).json({ message: "Erro ao buscar horários disponíveis" });
    }
  });

  // Cancel appointment with business rules
  app.post("/api/appointments/:id/cancel", authenticateToken, async (req, res) => {
    try {
      const { reason } = req.body;

      if (!reason) {
        return res.status(400).json({ message: "Motivo do cancelamento é obrigatório" });
      }

      // Check if cancellation is allowed
      const canCancel = await storage.canCancelAppointment(req.params.id);
      if (!canCancel.canCancel) {
        return res.status(400).json({ message: canCancel.reason });
      }

      const appointment = await storage.cancelAppointment(req.params.id, reason);
      if (!appointment) {
        return res.status(404).json({ message: "Agendamento não encontrado" });
      }

      res.json({ message: "Agendamento cancelado com sucesso", appointment });
    } catch (error) {
      console.error("Error canceling appointment:", error);
      res.status(500).json({ message: "Erro ao cancelar agendamento" });
    }
  });

  // Reschedule appointment
  app.post("/api/appointments/:id/reschedule", authenticateToken, async (req, res) => {
    try {
      // Check if the user is a merchant or an employee
      if (req.user.role !== "merchant" && req.user.role !== "employee") {
        return res.status(403).json({ message: "Acesso negado" });
      }

      const { newDate, newTime, reason } = req.body;

      if (!newDate || !newTime || !reason) {
        return res.status(400).json({ message: "Campos obrigatórios: newDate, newTime, reason" });
      }

      // Get appointment to verify ownership
      const existingAppointment = await storage.getAppointment(req.params.id);
      if (!existingAppointment) {
        return res.status(404).json({ message: "Agendamento não encontrado" });
      }

      // Verify appointment belongs to the merchant (or employee's merchant)
      const userMerchantId = req.user.role === "merchant" ? req.user.userId : req.user.merchantId;
      if (existingAppointment.merchantId !== userMerchantId) {
        return res.status(403).json({ message: "Acesso negado" });
      }

      // Check if rescheduling is allowed (funcionários podem reagendar a qualquer momento)
      const canReschedule = await storage.canRescheduleAppointment(req.params.id, req.user.role);
      if (!canReschedule.canReschedule) {
        return res.status(400).json({ message: canReschedule.reason });
      }

      const appointment = await storage.rescheduleAppointment(req.params.id, newDate, newTime, reason);
      if (!appointment) {
        return res.status(404).json({ message: "Agendamento não encontrado" });
      }

      res.json({ message: "Agendamento reagendado com sucesso", appointment });
    } catch (error) {
      console.error("Error rescheduling appointment:", error);
      res.status(500).json({ message: "Erro ao reagendar agendamento" });
    }
  });

  // Mark appointment as late
  app.post("/api/appointments/:id/late", authenticateToken, async (req, res) => {
    try {
      if (req.user.role !== "merchant" && req.user.role !== "employee") {
        return res.status(403).json({ message: "Acesso negado" });
      }

      const appointment = await storage.markAppointmentAsLate(req.params.id);
      if (!appointment) {
        return res.status(404).json({ message: "Agendamento não encontrado" });
      }

      res.json({ message: "Agendamento marcado como atrasado", appointment });
    } catch (error) {
      console.error("Error marking appointment as late:", error);
      res.status(500).json({ message: "Erro ao marcar agendamento como atrasado" });
    }
  });

  // Mark appointment as no-show
  app.post("/api/appointments/:id/no-show", authenticateToken, async (req, res) => {
    try {
      if (req.user.role !== "merchant" && req.user.role !== "employee") {
        return res.status(403).json({ message: "Acesso negado" });
      }

      const appointment = await storage.markAppointmentAsNoShow(req.params.id);
      if (!appointment) {
        return res.status(404).json({ message: "Agendamento não encontrado" });
      }

      res.json({ message: "Agendamento marcado como falta", appointment });
    } catch (error) {
      console.error("Error marking appointment as no-show:", error);
      res.status(500).json({ message: "Erro ao marcar agendamento como falta" });
    }
  });

  // Update appointment status
  app.post("/api/appointments/:id/status", authenticateToken, async (req, res) => {
    try {
      console.log("\n=== DEBUG: APPOINTMENT STATUS UPDATE ROUTE ===");
      console.log(`Appointment ID: ${req.params.id}`);
      console.log(`User: ${req.user?.email} (${req.user?.role})`);
      console.log(`Request body:`, JSON.stringify(req.body, null, 2));
      console.log(`Request headers:`, Object.fromEntries(Object.entries(req.headers).filter(([key]) => 
        ['content-type', 'authorization', 'user-agent'].includes(key.toLowerCase()))));

      if (req.user.role !== "merchant" && req.user.role !== "employee") {
        console.error(`Access denied: user role ${req.user.role} not authorized`);
        return res.status(403).json({ message: "Acesso negado" });
      }

      console.log("✅ Authorization passed");

      // Get current appointment before update
      const currentAppointment = await storage.getAppointment(req.params.id);
      if (!currentAppointment) {
        console.error(`❌ Appointment ${req.params.id} not found in database`);
        return res.status(404).json({ message: "Agendamento não encontrado" });
      }

      console.log("Current appointment state:", {
        id: currentAppointment.id,
        status: currentAppointment.status,
        paymentStatus: (currentAppointment as any).paymentStatus,
        clientName: currentAppointment.clientName,
        appointmentDate: currentAppointment.appointmentDate,
        appointmentTime: currentAppointment.appointmentTime
      });

      const statusUpdate = req.body;
      console.log("About to call storage.updateAppointmentStatus...");
      
      const appointment = await storage.updateAppointmentStatus(req.params.id, statusUpdate);

      if (!appointment) {
        console.error(`❌ updateAppointmentStatus returned null/undefined`);
        return res.status(404).json({ message: "Agendamento não encontrado" });
      }

      console.log("Updated appointment state:", {
        id: appointment.id,
        status: appointment.status,
        paymentStatus: (appointment as any).paymentStatus,
        clientName: appointment.clientName,
        updatedAt: appointment.updatedAt
      });

      console.log(`✅ Appointment ${req.params.id} status updated successfully`);
      console.log("=== END DEBUG ===\n");
      
      res.json({ message: "Status do agendamento atualizado", appointment });
    } catch (error) {
      console.error("\n❌ ERROR in appointment status update:");
      console.error("Error message:", error.message);
      console.error("Error stack:", error.stack);
      console.error("=== END ERROR DEBUG ===\n");
      res.status(500).json({ message: "Erro ao atualizar status do agendamento", error: error.message });
    }
  });

  // Get employee schedule
  app.get("/api/employees/:id/schedule", authenticateToken, async (req, res) => {
    try {
      const schedule = await storage.getEmployeeSchedule(req.params.id);
      res.json(schedule);
    } catch (error) {
      console.error("Error getting employee schedule:", error);
      res.status(500).json({ message: "Erro ao buscar horários do funcionário" });
    }
  });

  // Promotions endpoints
  // Get promotions for a merchant
  app.get("/api/promotions", authenticateToken, async (req, res) => {
    try {
      if (req.user.role !== "merchant") {
        return res.status(403).json({ message: "Acesso negado" });
      }

      const merchantId = req.user.userId;
      const promotions = await storage.getPromotionsByMerchant(merchantId);
      res.json(promotions);
    } catch (error) {
      console.error("Error getting promotions:", error);
      res.status(500).json({ message: "Erro ao buscar promoções" });
    }
  });

  // Get active promotions for a merchant
  app.get("/api/promotions/active", authenticateToken, async (req, res) => {
    try {
      if (req.user.role !== "merchant") {
        return res.status(403).json({ message: "Acesso negado" });
      }

      const merchantId = req.user.userId;
      const promotions = await storage.getActivePromotionsByMerchant(merchantId);
      res.json(promotions);
    } catch (error) {
      console.error("Error getting active promotions:", error);
      res.status(500).json({ message: "Erro ao buscar promoções ativas" });
    }
  });

  // Create promotion
  app.post("/api/promotions", authenticateToken, async (req, res) => {
    try {
      if (req.user.role !== "merchant") {
        return res.status(403).json({ message: "Acesso negado" });
      }

      const promotionData = promotionSchema.parse({
        ...req.body,
        merchantId: req.user.userId,
      });

      const promotion = await storage.createPromotion(promotionData);
      res.status(201).json(promotion);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Dados inválidos", errors: error.errors });
      }
      console.error("Error creating promotion:", error);
      res.status(500).json({ message: "Erro ao criar promoção" });
    }
  });

  // Update promotion
  app.put("/api/promotions/:id", authenticateToken, async (req, res) => {
    try {
      if (req.user.role !== "merchant") {
        return res.status(403).json({ message: "Acesso negado" });
      }

      const updates = promotionSchema.partial().parse(req.body);
      const promotion = await storage.updatePromotion(req.params.id, updates);

      if (!promotion) {
        return res.status(404).json({ message: "Promoção não encontrada" });
      }

      // Verify promotion belongs to the merchant
      if (promotion.merchantId !== req.user.userId) {
        return res.status(403).json({ message: "Acesso negado" });
      }

      res.json(promotion);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Dados inválidos", errors: error.errors });
      }
      console.error("Error updating promotion:", error);
      res.status(500).json({ message: "Erro ao atualizar promoção" });
    }
  });

  // Delete promotion
  app.delete("/api/promotions/:id", authenticateToken, async (req, res) => {
    try {
      if (req.user.role !== "merchant") {
        return res.status(403).json({ message: "Acesso negado" });
      }

      const promotion = await storage.getPromotion(req.params.id);
      if (!promotion) {
        return res.status(404).json({ message: "Promoção não encontrada" });
      }

      // Verify promotion belongs to the merchant
      if (promotion.merchantId !== req.user.userId) {
        return res.status(403).json({ message: "Acesso negado" });
      }

      const success = await storage.deletePromotion(req.params.id);
      if (!success) {
        return res.status(404).json({ message: "Promoção não encontrada" });
      }

      res.json({ message: "Promoção removida com sucesso" });
    } catch (error) {
      console.error("Error deleting promotion:", error);
      res.status(500).json({ message: "Erro ao remover promoção" });
    }
  });

  // Update employee schedule  
  app.put("/api/employees/:id/schedule", authenticateToken, async (req, res) => {
    try {
      if (req.user.role !== "merchant") {
        return res.status(403).json({ message: "Acesso negado" });
      }

      const schedule = req.body;
      const employee = await storage.updateEmployeeSchedule(req.params.id, schedule);

      if (!employee) {
        return res.status(404).json({ message: "Funcionário não encontrado" });
      }

      res.json({ message: "Horários do funcionário atualizados", employee });
    } catch (error) {
      console.error("Error updating employee schedule:", error);
      res.status(500).json({ message: "Erro ao atualizar horários do funcionário" });
    }
  });

  // Get merchant dashboard stats
  app.get("/api/merchant/stats", authenticateToken, async (req, res) => {
    try {
      if (req.user.role !== "merchant") {
        return res.status(403).json({ message: "Acesso negado" });
      }

      console.log("Getting merchant stats for:", req.user.userId);
      const stats = await storage.getMerchantDashboardStats(req.user.userId);
      console.log("Merchant stats retrieved:", stats);
      res.json(stats);
    } catch (error) {
      console.error("Error in merchant stats endpoint:", error);
      res.status(500).json({ message: "Erro ao buscar estatísticas", error: error.message });
    }
  });

  // Get merchant penalties
  app.get("/api/merchant/penalties", authenticateToken, async (req, res) => {
    try {
      let merchantId: string;

      if (req.user.role === "merchant") {
        merchantId = req.user.userId;
      } else if (req.user.role === "employee") {
        merchantId = req.user.merchantId;
        if (!merchantId) {
          return res.status(400).json({ message: "Funcionário não associado a um comerciante" });
        }
      } else {
        return res.status(403).json({ message: "Acesso negado" });
      }

      const penalties = await storage.getPenaltiesByMerchant(merchantId);

      res.json(penalties);
    } catch (error) {
      console.error("Error fetching merchant penalties:", error);
      res.status(500).json({ message: "Erro ao buscar multas" });
    }
  });

  // Update penalty status
  app.put("/api/penalties/:id", authenticateToken, async (req, res) => {
    try {
      if (req.user.role !== "merchant" && req.user.role !== "employee") {
        return res.status(403).json({ message: "Acesso negado" });
      }

      const penaltyId = req.params.id;
      const { status } = req.body;
      const paidBy = req.user.userId;

      if (!["paid", "waived"].includes(status)) {
        return res.status(400).json({ message: "Status inválido" });
      }

      const updatedPenalty = await storage.updatePenaltyStatus(penaltyId, status, paidBy);

      if (!updatedPenalty) {
        return res.status(404).json({ message: "Multa não encontrada" });
      }

      res.json(updatedPenalty);
    } catch (error) {
      console.error("Error updating penalty status:", error);
      res.status(500).json({ message: "Erro ao atualizar status da multa" });
    }
  });

  // Get merchant settings for employee
  app.get("/api/employee/merchant-settings", requireAuth, requireRole(["employee"]), async (req, res) => {
    try {
      const employeeId = req.user.userId;

      // Get employee data to find merchant
      const employee = await storage.getUser(employeeId);

      if (!employee || employee.role !== 'employee') {
        return res.status(404).json({ error: 'Employee not found' });
      }

      // Get merchant data
      const merchant = await storage.getMerchant(employee.merchantId!);

      if (!merchant) {
        return res.status(404).json({ error: 'Merchant not found' });
      }

      // Return only the relevant settings
      res.json({
        cancellationFeeEnabled: merchant.cancellationFeeEnabled || false,
        cancellationFeeAmount: merchant.cancellationFeeAmount || 0,
        cancellationPolicyHours: merchant.cancellationPolicyHours || 24
      });
    } catch (error) {
      console.error('Error fetching merchant settings for employee:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Get employee appointments
  app.get("/api/employee/appointments", requireAuth, requireRole(["employee"]), async (req, res) => {
    try {
      const employeeId = req.user.userId;
      const date = req.query.date as string || new Date().toISOString().split('T')[0];

      const appointments = await storage.getAppointmentsByEmployeeAndDate(employeeId, date);
      res.json(appointments);
    } catch (error) {
      console.error("Error fetching employee appointments:", error);
      res.status(500).json({ message: "Erro interno do servidor" });
    }
  });

  // Employee dashboard - get upcoming appointments
  app.get("/api/employee/appointments/upcoming", requireAuth, requireRole(["employee"]), async (req, res) => {
    try {
      const employeeId = req.user.userId;

      const appointments = await storage.getEmployeeUpcomingAppointments(employeeId);
      res.json(appointments);
    } catch (error) {
      console.error("Error fetching employee upcoming appointments:", error);
      res.status(500).json({ message: "Erro interno do servidor" });
    }
  });

  // Employee dashboard - get historical appointments
  app.get("/api/employee/appointments/history", requireAuth, requireRole(["employee"]), async (req, res) => {
    try {
      const employeeId = req.user.userId;
      const filter = req.query.filter as string || "month";

      const appointments = await storage.getEmployeeHistoricalAppointments(employeeId, filter);
      res.json(appointments);
    } catch (error) {
      console.error("Error fetching employee historical appointments:", error);
      res.status(500).json({ message: "Erro interno do servidor" });
    }
  });

  // Client dashboard - get historical appointments
  app.get("/api/client/appointments/history", requireAuth, requireRole(["client"]), async (req, res) => {
    try {
      const clientId = req.user.userId;
      const filter = req.query.filter as string || "month";

      const appointments = await storage.getClientHistoricalAppointments(clientId, filter);
      res.json(appointments);
    } catch (error) {
      console.error("Error fetching client historical appointments:", error);
      res.status(500).json({ message: "Erro interno do servidor" });
    }
  });

  // Client dashboard stats
  app.get("/api/client/stats", authenticateToken, async (req, res) => {
    try {
      if (req.user.role !== "client") {
        return res.status(403).json({ message: "Acesso negado" });
      }

      // Assuming storage has a method to get client-specific stats
      // For now, let's return basic client info
      const client = await storage.getClient(req.user.userId);
      if (!client) {
        return res.status(404).json({ message: "Cliente não encontrado" });
      }

      const stats = {
        id: client.id,
        name: client.name,
        email: client.email,
        phone: client.phone,
        merchantId: client.merchantId,
        // Add any other relevant client stats here
      };
      res.json(stats);
    } catch (error) {
      console.error("Error fetching client stats:", error);
      res.status(500).json({ message: "Erro ao buscar estatísticas do cliente" });
    }
  });

  // Upgrade merchant to VIP plan
  app.post("/api/merchant/upgrade-to-vip", authenticateToken, async (req, res) => {
    try {
      if (req.user.role !== "merchant") {
        return res.status(403).json({ message: "Acesso negado" });
      }

      const merchantId = req.user.userId;
      const merchant = await storage.getMerchant(merchantId);

      if (!merchant) {
        return res.status(404).json({ message: "Comerciante não encontrado" });
      }

      // Calculate new plan validity (30 days from now)
      const now = new Date();
      const planValidity = new Date(now.getTime() + (30 * 24 * 60 * 60 * 1000)); // 30 days

      const updates = {
        planStatus: "vip",
        planValidity: planValidity,
      };

      const updatedMerchant = await storage.updateMerchant(merchantId, updates);

      if (!updatedMerchant) {
        return res.status(500).json({ message: "Erro ao ativar plano VIP" });
      }

      res.json({
        message: "Plano VIP ativado com sucesso! Válido por 30 dias.",
        merchant: {
          id: updatedMerchant.id,
          planStatus: updatedMerchant.planStatus,
          planValidity: updatedMerchant.planValidity,
        }
      });
    } catch (error) {
      console.error("Error upgrading to VIP:", error);
      res.status(500).json({ message: "Erro interno do servidor" });
    }
  });

  // Renew VIP plan
  app.post("/api/merchant/renew-vip", authenticateToken, async (req, res) => {
    try {
      if (req.user.role !== "merchant") {
        return res.status(403).json({ message: "Acesso negado" });
      }

      const merchantId = req.user.userId;
      const merchant = await storage.getMerchant(merchantId);

      if (!merchant) {
        return res.status(404).json({ message: "Comerciante não encontrado" });
      }

      // Calculate new validity (add 30 days to current validity or now if expired)
      const now = new Date();
      const currentValidity = merchant.planValidity ? new Date(merchant.planValidity) : now;
      const baseDate = currentValidity > now ? currentValidity : now;
      const newValidity = new Date(baseDate.getTime() + (30 * 24 * 60 * 60 * 1000)); // Add 30 days

      const updates = {
        planStatus: "vip",
        planValidity: newValidity,
      };

      const updatedMerchant = await storage.updateMerchant(merchantId, updates);

      if (!updatedMerchant) {
        return res.status(500).json({ message: "Erro ao renovar plano VIP" });
      }

      const daysAdded = Math.ceil((newValidity.getTime() - baseDate.getTime()) / (1000 * 60 * 60 * 24));

      res.json({
        message: `Plano VIP renovado com sucesso! ${daysAdded} dias adicionados.`,
        merchant: {
          id: updatedMerchant.id,
          planStatus: updatedMerchant.planStatus,
          planValidity: updatedMerchant.planValidity,
        }
      });
    } catch (error) {
      console.error("Error renewing VIP:", error);
      res.status(500).json({ message: "Erro interno do servidor" });
    }
  });

  // Get client appointments
  app.get("/api/client/appointments", authenticateToken, async (req, res) => {
    try {
      if (req.user.role !== "client") {
        return res.status(403).json({ message: "Acesso negado" });
      }

      const clientId = req.user.userId;
      const merchantId = req.user.merchantId; // Assuming merchantId is available in client token

      if (!clientId || !merchantId) {
        return res.status(400).json({ message: "Informações do cliente ou do comerciante não encontradas" });
      }

      const { date, startDate, endDate } = req.query;

      // Get merchant info to include cancellation policies
      const merchant = await storage.getMerchant(merchantId);
      if (!merchant) {
        return res.status(404).json({ message: "Merchant não encontrado" });
      }

      let appointments;
      if (date) {
        appointments = await storage.getClientAppointmentsByDate(clientId, merchantId, date as string);
      } else if (startDate && endDate) {
        appointments = await storage.getClientAppointmentsByDateRange(clientId, merchantId, startDate as string, endDate as string);
      } else {
        appointments = await storage.getClientAppointments(clientId, merchantId);
      }

      // Log for debugging
      console.log(`Client ${clientId} appointments:`, appointments.length, appointments.map(a => ({ id: a.id, status: a.status, date: a.appointmentDate })));

      // Include merchant cancellation policies in the response
      const merchantPolicies = {
        cancellationFeeEnabled: merchant.cancellationFeeEnabled || false,
        cancellationFeeAmount: merchant.cancellationFeeAmount || 0,
        cancellationPolicyHours: merchant.cancellationPolicyHours || 24
      };

      console.log("=== SENDING MERCHANT POLICIES TO CLIENT ===");
      console.log("Merchant:", merchant.name);
      console.log("Policies:", merchantPolicies);
      console.log("Raw merchant data:", {
        cancellationFeeEnabled: merchant.cancellationFeeEnabled,
        cancellationFeeAmount: merchant.cancellationFeeAmount, 
        cancellationPolicyHours: merchant.cancellationPolicyHours
      });
      console.log("=== END MERCHANT POLICIES ===");

      const response = {
        appointments,
        merchantPolicies
      };

      res.json(response);
    } catch (error) {
      console.error("Error fetching client appointments:", error);
      res.status(500).json({ message: "Erro ao buscar agendamentos do cliente" });
    }
  });

  // Get services available for client
  app.get("/api/client/services", authenticateToken, async (req, res) => {
    try {
      if (req.user.role !== "client") {
        return res.status(403).json({ message: "Acesso negado" });
      }

      const merchantId = req.user.merchantId;
      if (!merchantId) {
        return res.status(400).json({ message: "Merchant ID não encontrado" });
      }

      const services = await storage.getActiveServicesByMerchant(merchantId);
      
      // Enrich services with promotion information
      const servicesWithPromotions = await Promise.all(
        services.map(async (service) => {
          const promotionInfo = await storage.calculatePromotionalPrice(service.id, service.price);
          return {
            ...service,
            hasPromotion: promotionInfo.hasPromotion,
            originalPrice: promotionInfo.originalPrice,
            promotionalPrice: promotionInfo.promotionalPrice,
            promotion: promotionInfo.discount
          };
        })
      );

      res.json(servicesWithPromotions);
    } catch (error) {
      console.error("Error fetching client services:", error);
      res.status(500).json({ message: "Erro ao buscar serviços" });
    }
  });

  // Get employees available for client
  app.get("/api/client/employees", authenticateToken, async (req, res) => {
    try {
      if (req.user.role !== "client") {
        return res.status(403).json({ message: "Acesso negado" });
      }

      const merchantId = req.user.merchantId;
      if (!merchantId) {
        return res.status(400).json({ message: "Merchant ID não encontrado" });
      }

      const { date } = req.query;

      const employees = await storage.getActiveEmployeesByMerchant(merchantId);

      // If date is provided, filter out employees who are on day off
      if (date) {
        const availableEmployees = [];
        for (const employee of employees) {
          const isOnDayOff = await storage.isEmployeeOnDayOff(employee.id, date as string);
          if (!isOnDayOff) {
            availableEmployees.push(employee);
          }
        }
        res.json(availableEmployees.map(toPublicEmployee));
      } else {
        res.json(employees.map(toPublicEmployee));
      }
    } catch (error) {
      console.error("Error fetching employees:", error);
      res.status(500).json({ message: "Erro ao buscar funcionários" });
    }
  });

  // Check employee availability
  app.get("/api/client/availability", authenticateToken, async (req, res) => {
    try {
      if (req.user.role !== "client") {
        return res.status(403).json({ message: "Acesso negado" });
      }

      const { employeeId, date, time, duration } = req.query;
      const merchantId = req.user.merchantId;

      if (!merchantId || !date || !time || !duration) {
        return res.status(400).json({ message: "Parâmetros obrigatórios: date, time, duration" });
      }

      // Get all appointments for the specified date
      const appointments = await storage.getAppointmentsByDate(merchantId, date as string);

      // Only consider appointments that are still active
      const now = new Date();
      const today = now.toISOString().split('T')[0];
      const isToday = date === today;

      const activeAppointments = appointments.filter(apt => {
        // First filter by status - only include active appointments
        const isActiveStatus = apt.status === "pending" || apt.status === "confirmed" || apt.status === "scheduled" || apt.status === "late";

        // For today's appointments, also check if the appointment time has passed
        if (isToday && isActiveStatus) {
          const [aptHour, aptMinute] = apt.appointmentTime.split(':').map(Number);
          const aptTimeMinutes = aptHour * 60 + aptMinute;
          const currentTimeMinutes = now.getHours() * 60 + now.getMinutes();

          // If appointment was more than 5 minutes ago and still pending, consider it available
          if (aptTimeMinutes + 5 < currentTimeMinutes && apt.status === "pending") {
            return false;
          }
        }

        return isActiveStatus;
      });

      // Filter appointments based on employee selection
      let relevantAppointments;
      if (employeeId && employeeId !== "any") {
        // Check specific employee availability
        relevantAppointments = activeAppointments.filter(apt => apt.employeeId === employeeId);
      } else {
        // Check if ANY employee is available (only active appointments count as conflicts)
        relevantAppointments = activeAppointments;
      }

      // Check if the requested time slot conflicts with existing appointments
      const requestedTime = time as string;
      const requestedDuration = parseInt(duration as string);

      // Convert time to minutes for easier comparison
      const timeToMinutes = (timeStr: string) => {
        const [hours, minutes] = timeStr.split(':').map(Number);
        return hours * 60 + minutes;
      };

      const requestedStart = timeToMinutes(requestedTime);
      const requestedEnd = requestedStart + requestedDuration;

      // Get service durations for existing appointments
      const appointmentsWithDuration = await Promise.all(
        relevantAppointments.map(async (apt) => {
          const service = await storage.getService(apt.serviceId);
          return {
            ...apt,
            serviceDuration: service?.duration || 60, // Default to 60 minutes if service not found
          };
        })
      );

      const isAvailable = !appointmentsWithDuration.some(apt => {
        const aptStart = timeToMinutes(apt.appointmentTime);
        const aptEnd = aptStart + apt.serviceDuration;

        // Check for overlap: appointments conflict if they overlap in any way
        return (requestedStart < aptEnd && requestedEnd > aptStart);
      });

      res.json({ available: isAvailable });
    } catch (error) {
      console.error("Error checking availability:", error);
      res.status(500).json({ message: "Erro ao verificar disponibilidade" });
    }
  });

  // Get occupied time slots for a specific date
  app.get("/api/client/occupied-times", authenticateToken, async (req, res) => {
    try {
      if (req.user.role !== "client") {
        return res.status(403).json({ message: "Acesso negado" });
      }

      const { date, employeeId } = req.query;
      const merchantId = req.user.merchantId;

      if (!merchantId || !date) {
        return res.status(400).json({ message: "Parâmetros obrigatórios: date" });
      }

      // Get all appointments for the specified date
      const appointments = await storage.getAppointmentsByDate(merchantId, date as string);
      console.log(`Found ${appointments.length} appointments for date ${date}:`, appointments);

      // Only consider appointments that are still active (pending, confirmed, scheduled, late)
      // Completed, cancelled, and no_show appointments should free up the time slot after being marked as such
      const now = new Date();
      const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
      const today = now.toISOString().split('T')[0];
      const isToday = date === today;

      let filteredAppointments = appointments.filter(apt => {
        // First filter by status - only include active appointments
        const isActiveStatus = apt.status === "pending" || apt.status === "confirmed" || apt.status === "scheduled" || apt.status === "late";

        // For today's appointments, also check if the appointment time has passed
        // If it's past the appointment time and still not marked as completed/cancelled/no_show,
        // we should still consider it as occupying the slot (in case it's running late)
        if (isToday && isActiveStatus) {
          // If appointment time has passed by more than 5 minutes and it's still "pending", 
          // we can consider it available for new bookings
          const [aptHour, aptMinute] = apt.appointmentTime.split(':').map(Number);
          const aptTimeMinutes = aptHour * 60 + aptMinute;
          const currentTimeMinutes = now.getHours() * 60 + now.getMinutes();

          // If appointment was more than 5 minutes ago and still pending, free the slot
          if (aptTimeMinutes + 5 < currentTimeMinutes && apt.status === "pending") {
            return false;
          }
        }

        return isActiveStatus;
      });

      console.log(`Filtered to active appointments only: ${appointments.length} -> ${filteredAppointments.length}`);

      if (employeeId && employeeId !== "any" && employeeId !== "") {
        // If specific employee is selected, only consider their active appointments
        filteredAppointments = filteredAppointments.filter(apt => apt.employeeId === employeeId);
        console.log(`Filtered to ${filteredAppointments.length} active appointments for employee ${employeeId}`);
      } else {
        // For "any employee" or no employee selection, consider all active appointments
        // This prevents double-booking any time slot
        console.log(`Using all ${filteredAppointments.length} active appointments (no specific employee selected)`);
      }

      // Get service durations and calculate occupied time slots
      const occupiedSlots = [];

      for (const apt of filteredAppointments) {
        const service = await storage.getService(apt.serviceId);
        const duration = service?.duration || 60;

        // Convert appointment time to minutes
        const [hours, minutes] = apt.appointmentTime.split(':').map(Number);
        const startMinutes = hours * 60 + minutes;

        // Mark the exact start time as occupied (this is what we check against)
        const timeSlot = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
        occupiedSlots.push(timeSlot);

        console.log(`Active appointment at ${apt.appointmentTime} (status: ${apt.status}, duration: ${duration}min) marks ${timeSlot} as occupied`);
      }

      // Remove duplicates
      const uniqueOccupiedSlots = Array.from(new Set(occupiedSlots));
      console.log(`Total occupied time slots:`, uniqueOccupiedSlots);

      res.json({ occupiedTimes: uniqueOccupiedSlots });
    } catch (error) {
      console.error("Error getting occupied times:", error);
      res.status(500).json({ message: "Erro ao buscar horários ocupados" });
    }
  });

  // Create appointment for client
  app.post("/api/client/appointments", authenticateToken, async (req, res) => {
    try {
      if (req.user.role !== "client") {
        return res.status(403).json({ message: "Acesso negado" });
      }

      const clientId = req.user.userId;
      const merchantId = req.user.merchantId;
      const client = await storage.getClient(clientId);

      if (!client) {
        return res.status(404).json({ message: "Cliente não encontrado" });
      }

      // Get merchant info to check if salon is open
      const merchant = await storage.getMerchant(merchantId);
      if (!merchant) {
        return res.status(404).json({ message: "Salão não encontrado" });
      }

      const { serviceId, employeeId, appointmentDate, appointmentTime, notes } = req.body;

      if (!serviceId || !appointmentDate || !appointmentTime) {
        return res.status(400).json({ message: "Campos obrigatórios: serviceId, appointmentDate, appointmentTime" });
      }

      // Check if salon is closed and if trying to book for today
      const today = new Date().toISOString().split('T')[0];
      const isBookingForToday = appointmentDate === today;

      if (!merchant.isOpen && isBookingForToday) {
        return res.status(400).json({ 
          message: "O salão está fechado hoje. Você só pode agendar para os próximos dias quando o salão estiver funcionando normalmente." 
        });
      }

      // Get service to check duration
      const service = await storage.getService(serviceId);
      if (!service) {
        return res.status(404).json({ message: "Serviço não encontrado" });
      }

      // Check for conflicts
      const existingAppointments = await storage.getAppointmentsByDate(merchantId, appointmentDate);

      // If a specific employee is selected, check only their appointments
      // If no employee is selected (any employee), check all appointments
      const relevantAppointments = employeeId 
        ? existingAppointments.filter(apt => apt.employeeId === employeeId)
        : existingAppointments;

      // Convert time to minutes for easier comparison
      const timeToMinutes = (timeStr: string) => {
        const [hours, minutes] = timeStr.split(':').map(Number);
        return hours * 60 + minutes;
      };

      const requestedStart = timeToMinutes(appointmentTime);
      const requestedEnd = requestedStart + service.duration;

      // Check for conflicts with existing appointments
      for (const existingApt of relevantAppointments) {
        // Skip appointments that don't occupy time slots
        if (existingApt.status === "cancelled" || existingApt.status === "completed" || existingApt.status === "no_show") {
          continue;
        }

        const existingService = await storage.getService(existingApt.serviceId);
        const existingDuration = existingService?.duration || 60;

        const existingStart = timeToMinutes(existingApt.appointmentTime);
        const existingEnd = existingStart + existingDuration;

        // Check for overlap
        if (requestedStart < existingEnd && requestedEnd > existingStart) {
          return res.status(409).json({ 
            message: employeeId 
              ? "Este horário já está ocupado para o funcionário selecionado" 
              : "Este horário já está ocupado. Por favor, selecione outro horário."
          });
        }
      }

      // Calculate end time based on service duration
      const [hours, minutes] = appointmentTime.split(':').map(Number);
      const endMinutes = minutes + service.duration;
      const endHour = hours + Math.floor(endMinutes / 60);
      const finalMinutes = endMinutes % 60;
      const endTime = `${endHour.toString().padStart(2, '0')}:${finalMinutes.toString().padStart(2, '0')}`;

      const appointmentData = {
        merchantId,
        serviceId,
        clientId,
        employeeId: employeeId || null,
        clientName: client.name,
        clientPhone: client.phone,
        clientEmail: client.email,
        appointmentDate,
        appointmentTime,
        endTime,
        notes: notes || null,
        status: "pending"
      };

      const appointment = await storage.createAppointment(appointmentData);
      res.status(201).json(appointment);
    } catch (error) {
      console.error("Error creating client appointment:", error);

      // Check if the error is about employee day off
      if ((error as Error).message === "Este funcionário está de folga neste dia.") {
        return res.status(400).json({ message: (error as Error).message });
      }

      res.status(500).json({ message: "Erro ao criar agendamento" });
    }
  });

  // Cancel appointment for client
  app.post("/api/client/appointments/:id/cancel", authenticateToken, async (req, res) => {
    try {
      if (req.user.role !== "client") {
        return res.status(403).json({ message: "Acesso negado" });
      }

      const { reason } = req.body;
      if (!reason) {
        return res.status(400).json({ message: "Motivo do cancelamento é obrigatório" });
      }

      const appointmentId = req.params.id;

      // Get appointment to verify ownership
      const existingAppointment = await storage.getAppointment(appointmentId);
      if (!existingAppointment) {
        return res.status(404).json({ message: "Agendamento não encontrado" });
      }

      // Verify appointment belongs to the client
      if (existingAppointment.clientId !== req.user.userId) {
        return res.status(403).json({ message: "Você só pode cancelar seus próprios agendamentos" });
      }

      // Get merchant policies for fee calculation
      const merchant = await storage.getMerchant(existingAppointment.merchantId);
      if (!merchant) {
        return res.status(404).json({ message: "Merchant não encontrado" });
      }

      // Check if appointment can be cancelled (only confirmed appointments)
      if (existingAppointment.status !== "confirmed") {
        return res.status(400).json({ message: "Apenas agendamentos confirmados podem ser cancelados" });
      }

      // Calculate if there will be a cancellation fee
      let hasFee = false;
      let feeAmount = 0;

      if (merchant.cancellationFeeEnabled) {
        const now = new Date();
        const appointmentDateTime = new Date(`${existingAppointment.appointmentDate}T${existingAppointment.appointmentTime}`);
        const timeDiff = appointmentDateTime.getTime() - now.getTime();
        const hoursDiff = timeDiff / (1000 * 60 * 60);
        const policyHours = merchant.cancellationPolicyHours || 24;

        console.log("Backend cancellation fee calculation:", {
          appointmentId: appointmentId,
          appointmentDate: existingAppointment.appointmentDate,
          appointmentTime: existingAppointment.appointmentTime,
          now: now.toISOString(),
          appointmentDateTime: appointmentDateTime.toISOString(),
          timeDiff,
          hoursDiff,
          policyHours,
          feeEnabled: merchant.cancellationFeeEnabled,
          feeAmount: merchant.cancellationFeeAmount
        });

        // There will be a fee if canceling with less time than policy requires
        // Se a diferença for menor que 23h59min (1439 minutos), paga multa
        if (hoursDiff * 60 < 1439) {
          hasFee = true;
          feeAmount = merchant.cancellationFeeAmount || 0;
          console.log("Multa será aplicada:", { hasFee, feeAmount });
        } else if (hoursDiff > 24) {
          // Se a diferença for maior que 24h, não paga multa
          hasFee = false;
          feeAmount = 0;
          console.log("Sem multa - cancelamento com antecedência suficiente");
        } else {
          // Caso contrário, usa a política padrão (se houver)
          if (hoursDiff < policyHours) {
            hasFee = true;
            feeAmount = merchant.cancellationFeeAmount || 0;
            console.log("Multa será aplicada com base na política:", { hasFee, feeAmount });
          } else {
            console.log("Sem multa - cancelamento dentro do tempo da política");
          }
        }
      } else {
        console.log("Cancellation fee disabled for this merchant");
      }

      const appointment = await storage.cancelAppointment(appointmentId, reason);
      if (!appointment) {
        return res.status(404).json({ message: "Agendamento não encontrado" });
      }

      // Create penalty record if there's a fee and the system is enabled
      if (hasFee && feeAmount > 0 && merchant.cancellationFeeEnabled) {
        await storage.createPenalty({
          merchantId: existingAppointment.merchantId,
          clientId: existingAppointment.clientId || null,
          appointmentId: appointmentId,
          clientName: existingAppointment.clientName,
          clientPhone: existingAppointment.clientPhone,
          clientEmail: existingAppointment.clientEmail || null,
          type: "cancellation",
          amount: feeAmount,
          reason: `Multa por cancelamento com menos de ${merchant.cancellationPolicyHours || 24} horas de antecedência`,
          status: "pending"
        });
      }

      const response = {
        message: "Agendamento cancelado com sucesso",
        appointment,
        cancellationFee: {
          hasFee,
          amount: feeAmount,
          amountInReais: feeAmount / 100
        }
      };

      res.json(response);
    } catch (error) {
      console.error("Error canceling client appointment:", error);
      res.status(500).json({ message: "Erro ao cancelar agendamento" });
    }
  });

  // Reschedule appointment for client  
  app.post("/api/client/appointments/:id/reschedule", authenticateToken, async (req, res) => {
    try {
      if (req.user.role !== "client") {
        return res.status(403).json({ message: "Acesso negado" });
      }

      const { newDate, newTime, reason } = req.body;
      if (!newDate || !newTime || !reason) {
        return res.status(400).json({ message: "Campos obrigatórios: newDate, newTime, reason" });
      }

      const appointmentId = req.params.id;

      // Get appointment to verify ownership
      const existingAppointment = await storage.getAppointment(appointmentId);
      if (!existingAppointment) {
        return res.status(404).json({ message: "Agendamento não encontrado" });
      }

      // Verify appointment belongs to the client
      if (existingAppointment.clientId !== req.user.userId) {
        return res.status(403).json({ message: "Você só pode reagendar seus próprios agendamentos" });
      }

      // Check if rescheduling is allowed (aplicar política de 24h para clientes)
      const canReschedule = await storage.canRescheduleAppointment(appointmentId, "client");
      if (!canReschedule.canReschedule) {
        return res.status(400).json({ message: canReschedule.reason });
      }

      const appointment = await storage.rescheduleAppointment(appointmentId, newDate, newTime, reason);
      if (!appointment) {
        return res.status(404).json({ message: "Agendamento não encontrado" });
      }

      res.json({ message: "Agendamento reagendado com sucesso", appointment });
    } catch (error) {
      console.error("Error rescheduling client appointment:", error);
      res.status(500).json({ message: "Erro ao reagendar agendamento" });
    }
  });

  // Employee dashboard stats
  app.get("/api/employee/stats", authenticateToken, async (req, res) => {
    try {
      if (req.user.role !== "employee") {
        return res.status(403).json({ message: "Acesso negado" });
      }

      // Assuming storage has a method to get employee-specific stats
      // For now, let's return basic employee info
      const employee = await storage.getEmployee(req.user.userId);
      if (!employee) {
        return res.status(404).json({ message: "Funcionário não encontrado" });
      }

      const stats = {
        id: employee.id,
        name: employee.name,
        email: employee.email,
        phone: employee.phone,
        merchantId: employee.merchantId,
        // Add any other relevant employee stats here
      };
      res.json(stats);
    } catch (error) {
      console.error("Error fetching employee stats:", error);
      res.status(500).json({ message: "Erro ao buscar estatísticas do funcionário" });
    }
  });

  // Get employee earnings for a period
  app.get("/api/employee/earnings", requireAuth, requireRole(["employee"]), async (req, res) => {
    try {
      const employeeId = req.user.userId;
      const { startDate, endDate } = req.query;

      if (!startDate || !endDate) {
        return res.status(400).json({ message: "startDate e endDate são obrigatórios" });
      }

      const earnings = await storage.calculateEmployeeEarnings(
        employeeId, 
        startDate as string, 
        endDate as string
      );

      res.json({ earnings });
    } catch (error) {
      console.error("Error calculating employee earnings:", error);
      res.status(500).json({ message: "Erro interno do servidor" });
    }
  });

  // Extend working hours for employee
  app.post("/api/employee/extend-hours", requireAuth, requireRole(["employee"]), async (req, res) => {
    try {
      const employeeId = req.user.userId;
      const { newEndTime } = req.body;

      if (!newEndTime) {
        return res.status(400).json({ message: "Novo horário de fim é obrigatório" });
      }

      // Validate time format
      if (!/^\d{2}:\d{2}$/.test(newEndTime)) {
        return res.status(400).json({ message: "Horário deve estar no formato HH:MM" });
      }

      const employee = await storage.extendWorkingHours(employeeId, newEndTime);
      if (!employee) {
        return res.status(404).json({ message: "Funcionário não encontrado" });
      }

      res.json({ 
        message: "Horário de trabalho estendido com sucesso", 
        employee: {
          id: employee.id,
          name: employee.name,
          originalEndTime: employee.endTime,
          extendedEndTime: employee.extendedEndTime
        }
      });
    } catch (error) {
      console.error("Error extending work hours:", error);
      res.status(500).json({ message: "Erro interno do servidor" });
    }
  });

  // Finish workday and calculate overtime
  app.post("/api/employee/finish-workday", requireAuth, requireRole(["employee"]), async (req, res) => {
    try {
      const employeeId = req.user.userId;
      const { actualEndTime } = req.body;

      if (!actualEndTime) {
        return res.status(400).json({ message: "Horário real de saída é obrigatório" });
      }

      // Validate time format
      if (!/^\d{2}:\d{2}$/.test(actualEndTime)) {
        return res.status(400).json({ message: "Horário deve estar no formato HH:MM" });
      }

      const result = await storage.finishWorkdayWithOvertime(employeeId, actualEndTime);

      const overtimeHours = Math.floor(result.overtimeMinutes / 60);
      const overtimeMinutes = result.overtimeMinutes % 60;

      res.json({ 
        message: "Expediente encerrado com sucesso", 
        employee: {
          id: result.employee.id,
          name: result.employee.name,
          originalEndTime: result.employee.endTime,
          actualEndTime: actualEndTime
        },
        overtime: {
          totalMinutes: result.overtimeMinutes,
          hours: overtimeHours,
          minutes: overtimeMinutes,
          formattedTime: `${overtimeHours}h ${overtimeMinutes}min`
        }
      });
    } catch (error) {
      console.error("Error finishing workday:", error);
      res.status(500).json({ message: error.message || "Erro interno do servidor" });
    }
  });

  // Get employee overtime statistics
  app.get("/api/employee/overtime-stats", requireAuth, requireRole(["employee"]), async (req, res) => {
    try {
      const employeeId = req.user.userId;
      const period = req.query.period as 'week' | 'month' | 'year' || 'month';

      const stats = await storage.getEmployeeOvertimeStats(employeeId, period);

      res.json({
        totalOvertimeMinutes: stats.totalOvertimeMinutes,
        totalOvertimeHours: stats.totalOvertimeHours,
        lastOvertimeDate: stats.lastOvertimeDate,
        formattedTime: `${Math.floor(stats.totalOvertimeMinutes / 60)}h ${stats.totalOvertimeMinutes % 60}min`
      });
    } catch (error) {
      console.error("Error getting overtime stats:", error);
      res.status(500).json({ message: "Erro interno do servidor" });
    }
  });

  // Employee days off endpoints

  // Get employee days off
  app.get("/api/employee-days-off", authenticateToken, async (req, res) => {
    try {
      if (req.user.role !== "merchant") {
        return res.status(403).json({ message: "Acesso negado" });
      }

      const merchantId = req.user.userId;
      const { employeeId, date } = req.query;

      const daysOff = await storage.getEmployeeDaysOff(
        merchantId,
        employeeId as string,
        date as string
      );

      res.json(daysOff);
    } catch (error) {
      console.error("Error getting employee days off:", error);
      res.status(500).json({ message: "Erro ao buscar folgas" });
    }
  });

  // Create employee day off
  app.post("/api/employee-days-off", authenticateToken, async (req, res) => {
    try {
      console.log("=== CREATE EMPLOYEE DAY OFF ===");
      console.log("User:", req.user);
      console.log("Request body:", req.body);

      if (req.user.role !== "merchant") {
        return res.status(403).json({ message: "Acesso negado" });
      }

      const merchantId = req.user.userId;
      const { employeeId, date, reason } = req.body;

      if (!employeeId || !date) {
        return res.status(400).json({ message: "ID do funcionário e data são obrigatórios" });
      }

      // Validate date format
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return res.status(400).json({ message: "Data deve estar no formato YYYY-MM-DD" });
      }

      // Check if date is in the past
      const selectedDate = new Date(date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (selectedDate < today) {
        return res.status(400).json({ message: "Não é possível criar folga para datas no passado" });
      }

      // Verify employee belongs to this merchant
      const employee = await storage.getEmployee(employeeId);
      if (!employee || employee.merchantId !== merchantId) {
        return res.status(403).json({ message: "Funcionário não encontrado ou não pertence a este salão" });
      }

      // Check if day off already exists for this employee and date
      const existingDaysOff = await storage.getEmployeeDaysOff(merchantId, employeeId, date);
      if (existingDaysOff.length > 0) {
        return res.status(409).json({ message: "Este funcionário já possui folga registrada para esta data" });
      }

      console.log("Creating day off for employee:", employee.name, "on date:", date);

      const dayOff = await storage.createEmployeeDayOff({
        merchantId,
        employeeId,
        date,
        reason: reason || null,
      });

      console.log("Day off created successfully:", dayOff);
      res.status(201).json(dayOff);
    } catch (error) {
      console.error("Error creating employee day off:", error);
      console.error("Error stack:", error.stack);
      res.status(500).json({ 
        message: "Erro ao criar folga",
        error: error.message 
      });
    }
  });

  // Update employee day off
  app.put("/api/employee-days-off/:id", authenticateToken, async (req, res) => {
    try {
      console.log("=== UPDATE EMPLOYEE DAY OFF ===");
      console.log("User:", req.user);
      console.log("Request body:", req.body);
      console.log("Day off ID:", req.params.id);

      if (req.user.role !== "merchant") {
        return res.status(403).json({ message: "Acesso negado" });
      }

      const merchantId = req.user.userId;
      const dayOffId = req.params.id;
      const { employeeId, date, reason } = req.body;

      if (!employeeId || !date) {
        return res.status(400).json({ message: "ID do funcionário e data são obrigatórios" });
      }

      // Validate date format
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return res.status(400).json({ message: "Data deve estar no formato YYYY-MM-DD" });
      }

      // Check if date is in the past
      const selectedDate = new Date(date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (selectedDate < today) {
        return res.status(400).json({ message: "Não é possível editar folga para datas no passado" });
      }

      // Get the day off to verify ownership
      const daysOff = await storage.getEmployeeDaysOff(merchantId);
      const existingDayOff = daysOff.find(d => d.id === dayOffId);

      if (!existingDayOff) {
        return res.status(404).json({ message: "Folga não encontrada" });
      }

      // Verify employee belongs to this merchant
      const employee = await storage.getEmployee(employeeId);
      if (!employee || employee.merchantId !== merchantId) {
        return res.status(403).json({ message: "Funcionário não encontrado ou não pertence a este salão" });
      }

      // Check if day off already exists for this employee and date (excluding current one)
      const conflictingDayOff = daysOff.find(
        d => d.employeeId === employeeId && 
             d.date === date && 
             d.id !== dayOffId
      );

      if (conflictingDayOff) {
        return res.status(409).json({ message: "Este funcionário já possui folga registrada para esta data" });
      }

      console.log("Updating day off for employee:", employee.name, "on date:", date);

      const updatedDayOff = await storage.updateEmployeeDayOff(dayOffId, {
        employeeId,
        date,
        reason: reason || null,
      });

      if (!updatedDayOff) {
        return res.status(404).json({ message: "Folga não encontrada" });
      }

      console.log("Day off updated successfully:", updatedDayOff);
      res.json(updatedDayOff);
    } catch (error) {
      console.error("Error updating employee day off:", error);
      console.error("Error stack:", error.stack);
      res.status(500).json({ 
        message: "Erro ao atualizar folga",
        error: error.message 
      });
    }
  });

  // Delete employee day off
  app.delete("/api/employee-days-off/:id", authenticateToken, async (req, res) => {
    try {
      if (req.user.role !== "merchant") {
        return res.status(403).json({ message: "Acesso negado" });
      }

      const merchantId = req.user.userId;
      const dayOffId = req.params.id;

      // Get the day off to verify ownership
      const daysOff = await storage.getEmployeeDaysOff(merchantId);
      const dayOff = daysOff.find(d => d.id === dayOffId);

      if (!dayOff) {
        return res.status(404).json({ message: "Folga não encontrada" });
      }

      const success = await storage.deleteEmployeeDayOff(dayOffId);
      if (!success) {
        return res.status(404).json({ message: "Folga não encontrada" });
      }

      res.json({ message: "Folga removida com sucesso" });
    } catch (error) {
      console.error("Error deleting employee day off:", error);
      res.status(500).json({ message: "Erro ao remover folga" });
    }
  });

  // Debug endpoint to clean duplicate merchant data
  app.post("/api/debug/clean-duplicates", async (req, res) => {
    try {
      console.log("\n=== CLEANING DUPLICATE MERCHANT DATA ===");

      const { email } = req.body;
      if (!email) {
        return res.status(400).json({ error: "Email é obrigatório" });
      }

      // Get all merchants with this email
      const merchants = await storage.getAllMerchants();
      const duplicates = merchants.filter(m => m.email === email);

      console.log(`Found ${duplicates.length} merchants with email ${email}`);

      if (duplicates.length <= 1) {
        return res.json({ message: "Nenhum duplicado encontrado", duplicates: duplicates.length });
      }

      // Keep the most recent one and delete others
      const sortedDuplicates = duplicates.sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      const keepMerchant = sortedDuplicates[0];
      const toDelete = sortedDuplicates.slice(1);

      console.log(`Keeping merchant: ${keepMerchant.id} (${keepMerchant.createdAt})`);
      console.log(`Deleting ${toDelete.length} duplicates`);

      let deletedCount = 0;
      for (const duplicate of toDelete) {
        const success = await storage.deleteMerchant(duplicate.id);
        if (success) {
          deletedCount++;
          console.log(`Deleted duplicate: ${duplicate.id}`);
        }
      }

      console.log(`=== CLEANUP COMPLETE: Deleted ${deletedCount} duplicates ===\n`);

      res.json({ 
        message: `Limpeza concluída: ${deletedCount} duplicados removidos`,
        keptMerchant: keepMerchant.id,
        deletedCount 
      });
    } catch (error: any) {
      console.error("Cleanup error:", error);
      res.status(500).json({ error: error?.message || "Erro desconhecido" });
    }
  });

  // Debug endpoint to reset merchant password  
  app.post("/api/debug/reset-merchant-password", async (req, res) => {
    try {
      console.log("\n=== RESETTING MERCHANT PASSWORD ===");

      const { email, newPassword } = req.body;
      if (!email || !newPassword) {
        return res.status(400).json({ error: "Email e nova senha são obrigatórios" });
      }

      // Find merchant by email
      const merchant = await storage.getMerchantByEmail(email);
      if (!merchant) {
        return res.status(404).json({ error: "Merchant não encontrado" });
      }

      console.log(`Resetting password for merchant: ${email}`);
      console.log(`Merchant ID: ${merchant.id}`);
      console.log(`Current status: ${merchant.status}`);

      // Update password directly using the storage method
      const success = await storage.updateMerchantPassword(merchant.id, newPassword);
      
      if (success) {
        console.log(`Password successfully reset for merchant: ${email}`);
        res.json({ 
          message: `Senha redefinida com sucesso para ${email}`,
          merchantId: merchant.id,
          status: merchant.status
        });
      } else {
        res.status(500).json({ error: "Falha ao redefinir senha" });
      }

      console.log("=== END PASSWORD RESET ===\n");
    } catch (error: any) {
      console.error("Password reset error:", error);
      res.status(500).json({ error: error?.message || "Erro desconhecido" });
    }
  });

  // Debug endpoint to set default password for all merchants
  app.post("/api/debug/reset-all-merchant-passwords", async (req, res) => {
    try {
      console.log("\n=== RESETTING ALL MERCHANT PASSWORDS ===");

      const { newPassword } = req.body;
      const defaultPassword = newPassword || "123456";
      
      // Get all merchants
      const merchants = await storage.getAllMerchants();
      console.log(`Found ${merchants.length} merchants to reset`);

      let successCount = 0;
      let failedCount = 0;

      for (const merchant of merchants) {
        try {
          const success = await storage.updateMerchantPassword(merchant.id, defaultPassword);
          if (success) {
            successCount++;
            console.log(`✅ Reset password for: ${merchant.email}`);
          } else {
            failedCount++;
            console.log(`❌ Failed to reset password for: ${merchant.email}`);
          }
        } catch (error) {
          failedCount++;
          console.log(`❌ Error resetting password for ${merchant.email}:`, error);
        }
      }

      console.log(`=== RESET COMPLETE: ${successCount} success, ${failedCount} failed ===\n`);

      res.json({ 
        message: `Senhas redefinidas: ${successCount} sucessos, ${failedCount} falhas`,
        defaultPassword: defaultPassword,
        successCount,
        failedCount
      });
    } catch (error: any) {
      console.error("Bulk password reset error:", error);
      res.status(500).json({ error: error?.message || "Erro desconhecido" });
    }
  });

  // Debug endpoint to fix service merchant assignment
  app.post("/api/debug/fix-service-merchant", async (req, res) => {
    try {
      console.log("\n=== FIXING SERVICE MERCHANT ASSIGNMENT ===");

      // Get all merchants to identify dono1 and dono2
      const merchants = await storage.getAllMerchants();
      console.log("\n🏪 ALL MERCHANTS:");

      let dono1Id: string | null = null;
      let dono2Id: string | null = null;

      merchants.forEach((m, index) => {
        console.log(`  [${index}] ${m.name} (${m.email}) - ID: ${m.id}`);
        if (m.email.includes('dono1') || m.name.toLowerCase().includes('dono1') || m.name.toLowerCase().includes('salao1')) {
          dono1Id = m.id;
          console.log(`  --> Found DONO1: ${m.id}`);
        }
        if (m.email.includes('dono2') || m.name.toLowerCase().includes('dono2') || m.name.toLowerCase().includes('salao2')) {
          dono2Id = m.id;
          console.log(`  --> Found DONO2: ${m.id}`);
        }
      });

      if (!dono1Id || !dono2Id) {
        console.log(`❌ Could not find both merchants. dono1Id: ${dono1Id}, dono2Id: ${dono2Id}`);
        return res.status(400).json({ error: "Não foi possível identificar dono1 e dono2" });
      }

      console.log(`\n🔧 FIXING: Moving service from dono2 (${dono2Id.substring(0, 8)}...) to dono1 (${dono1Id.substring(0, 8)}...)`);

      // Get all services from dono2 that should belong to dono1
      const dono2Services = await storage.getServicesByMerchant(dono2Id);
      console.log(`\n📋 Services currently assigned to dono2: ${dono2Services.length}`);

      let fixedCount = 0;
      for (const service of dono2Services) {
        console.log(`  - "${service.name}" (ID: ${service.id.substring(0, 8)}...)`);

        // Update the service to belong to dono1
        const success = await storage.updateServiceMerchant(service.id, dono1Id);
        if (success) {
          fixedCount++;
          console.log(`    ✅ Fixed: "${service.name}" now belongs to dono1`);
        } else {
          console.log(`    ❌ Failed to fix: "${service.name}"`);
        }
      }

      console.log(`\n🎯 RESULT: Fixed ${fixedCount} services`);
      console.log("=== END FIX ===\n");

      res.json({ 
        message: `Successfully fixed ${fixedCount} services`,
        fixedCount,
        dono1Id: dono1Id.substring(0, 8) + "...",
        dono2Id: dono2Id.substring(0, 8) + "..."
      });
    } catch (error: any) {
      console.error("Fix error:", error);
      res.status(500).json({ error: error?.message || "Unknown error" });
    }
  });

  // Get penalties for merchant
  app.get("/api/merchant/penalties", authenticateToken, async (req, res) => {
    try {
      if (req.user.role !== "merchant") {
        return res.status(403).json({ message: "Acesso negado" });
      }

      const penalties = await storage.getPenaltiesByMerchant(req.user.userId);
      res.json(penalties);
    } catch (error) {
      console.error("Error getting merchant penalties:", error);
      res.status(500).json({ message: "Erro ao buscar multas" });
    }
  });

  // Get penalties for employee (same as merchant since employee belongs to merchant)
  app.get("/api/employee/penalties", authenticateToken, async (req, res) => {
    try {
      if (req.user.role !== "employee") {
        return res.status(403).json({ message: "Acesso negado" });
      }

      // Employee sees penalties from their merchant
      const merchantId = req.user.merchantId;
      const penalties = await storage.getPenaltiesByMerchant(merchantId);
      res.json(penalties);
    } catch (error) {
      console.error("Error getting employee penalties:", error);
      res.status(500).json({ message: "Erro ao buscar multas" });
    }
  });

  // Get penalties for client
  app.get("/api/client/penalties", authenticateToken, async (req, res) => {
    try {
      if (req.user.role !== "client") {
        return res.status(403).json({ message: "Acesso negado" });
      }

      const clientId = req.user.userId;
      const merchantId = req.user.merchantId;

      // Get all penalties from the merchant and filter by client
      const allPenalties = await storage.getPenaltiesByMerchant(merchantId);
      const clientPenalties = allPenalties.filter(penalty => 
        penalty.clientId === clientId || penalty.clientPhone === req.user.phone
      );

      // Only return pending penalties (paid and waived should not be shown to client)
      const pendingPenalties = clientPenalties.filter(penalty => penalty.status === "pending");

      res.json(pendingPenalties);
    } catch (error) {
      console.error("Error getting client penalties:", error);
      res.status(500).json({ message: "Erro ao buscar multas" });
    }
  });

  // VIP Plan Management endpoints  
  app.post("/api/merchant/upgrade-to-vip", authenticateToken, async (req, res) => {
    try {
      if (req.user.role !== "merchant") {
        return res.status(403).json({ message: "Acesso negado" });
      }

      const merchantId = req.user.userId;
      const merchant = await storage.getMerchant(merchantId);
      
      if (!merchant) {
        return res.status(404).json({ message: "Comerciante não encontrado" });
      }

      const now = new Date();
      const planValidity = new Date(now.getTime() + (30 * 24 * 60 * 60 * 1000)); // 30 days

      const updates = {
        planStatus: "vip",
        planValidity: planValidity,
        monthlyFee: 5000, // R$ 50.00 in cents
        paymentStatus: "paid" as const,
      };

      const updatedMerchant = await storage.updateMerchant(merchantId, updates);

      if (!updatedMerchant) {
        return res.status(500).json({ message: "Erro ao ativar plano VIP" });
      }

      res.json({
        message: "Plano VIP ativado com sucesso! Válido por 30 dias.",
        merchant: {
          id: updatedMerchant.id,
          planStatus: updatedMerchant.planStatus,
          planValidity: updatedMerchant.planValidity,
        }
      });
    } catch (error) {
      console.error("Error upgrading to VIP:", error);
      res.status(500).json({ message: "Erro ao ativar plano VIP" });
    }
  });

  app.post("/api/merchant/renew-vip", authenticateToken, async (req, res) => {
    try {
      if (req.user.role !== "merchant") {
        return res.status(403).json({ message: "Acesso negado" });
      }

      const merchantId = req.user.userId;
      const merchant = await storage.getMerchant(merchantId);
      
      if (!merchant) {
        return res.status(404).json({ message: "Comerciante não encontrado" });
      }

      const now = new Date();
      let newValidity = new Date();
      
      // If merchant still has valid plan, extend from current validity
      if (merchant.planValidity && new Date(merchant.planValidity) > now) {
        newValidity = new Date(merchant.planValidity);
      } else {
        newValidity = new Date(now);
      }
      
      newValidity.setDate(newValidity.getDate() + 30);

      const updates = {
        planStatus: "vip",
        planValidity: newValidity,
        paymentStatus: "paid" as const,
      };

      const updatedMerchant = await storage.updateMerchant(merchantId, updates);

      if (!updatedMerchant) {
        return res.status(500).json({ message: "Erro ao renovar plano VIP" });
      }

      const daysAdded = Math.ceil((newValidity.getTime() - (merchant.planValidity ? new Date(merchant.planValidity).getTime() : now.getTime())) / (1000 * 60 * 60 * 24));

      res.json({
        message: `Plano VIP renovado com sucesso! ${daysAdded} dias adicionados.`,
        merchant: {
          id: updatedMerchant.id,
          planStatus: updatedMerchant.planStatus,
          planValidity: updatedMerchant.planValidity,
        }
      });
    } catch (error) {
      console.error("Error renewing VIP:", error);
      res.status(500).json({ message: "Erro ao renovar plano VIP" });
    }
  });

  // Update penalty status (mark as paid/waived)
  app.put("/api/penalties/:id", authenticateToken, async (req, res) => {
    try {
      if (req.user.role !== "merchant" && req.user.role !== "employee") {
        return res.status(403).json({ message: "Acesso negado" });
      }

      const { status } = req.body;
      if (!["paid", "waived"].includes(status)) {
        return res.status(400).json({ message: "Status inválido" });
      }

      const penalty = await storage.updatePenaltyStatus(req.params.id, status, req.user.userId);
      if (!penalty) {
        return res.status(404).json({ message: "Multa não encontrada" });
      }

      res.json({ message: "Status da multa atualizado", penalty });
    } catch (error) {
      console.error("Error updating penalty status:", error);
      res.status(500).json({ message: "Erro ao atualizar status da multa" });
    }
  });

  // System Settings endpoints (Admin only)
  
  // Get all system settings
  app.get("/api/admin/system-settings", authenticateToken, requireRole(["admin"]), async (req, res) => {
    try {
      const settings = await storage.getAllSystemSettings();
      res.json(settings);
    } catch (error) {
      console.error("Error getting system settings:", error);
      res.status(500).json({ message: "Erro ao buscar configurações do sistema" });
    }
  });

  // Get specific system setting
  app.get("/api/admin/system-settings/:key", authenticateToken, requireRole(["admin"]), async (req, res) => {
    try {
      const setting = await storage.getSystemSetting(req.params.key);
      if (!setting) {
        return res.status(404).json({ message: "Configuração não encontrada" });
      }
      res.json(setting);
    } catch (error) {
      console.error("Error getting system setting:", error);
      res.status(500).json({ message: "Erro ao buscar configuração" });
    }
  });

  // Update system setting
  app.put("/api/admin/system-settings/:key", authenticateToken, requireRole(["admin"]), async (req, res) => {
    try {
      const { value } = req.body;
      
      if (value === undefined || value === null) {
        return res.status(400).json({ message: "Valor é obrigatório" });
      }

      const setting = await storage.updateSystemSetting(req.params.key, String(value));
      if (!setting) {
        return res.status(404).json({ message: "Configuração não encontrada" });
      }

      res.json({ message: "Configuração atualizada com sucesso", setting });
    } catch (error) {
      console.error("Error updating system setting:", error);
      res.status(500).json({ message: "Erro ao atualizar configuração" });
    }
  });

  // Create new system setting
  app.post("/api/admin/system-settings", authenticateToken, requireRole(["admin"]), async (req, res) => {
    try {
      const { key, value, description, type } = req.body;
      
      if (!key || value === undefined || value === null) {
        return res.status(400).json({ message: "Chave e valor são obrigatórios" });
      }

      const setting = await storage.createSystemSetting({
        key,
        value: String(value),
        description,
        type: type || 'string'
      });

      res.status(201).json({ message: "Configuração criada com sucesso", setting });
    } catch (error) {
      console.error("Error creating system setting:", error);
      res.status(500).json({ message: "Erro ao criar configuração" });
    }
  });

  // Merchant Access Management Routes (Admin Only)
  
  // Grant access to merchant
  app.post("/api/admin/merchants/:id/grant-access", authenticateToken, requireRole(["admin"]), async (req, res) => {
    try {
      const { durationDays, monthlyFee } = req.body;
      
      if (!durationDays || durationDays < 1) {
        return res.status(400).json({ message: "Duração deve ser pelo menos 1 dia" });
      }

      const merchant = await storage.grantMerchantAccess(req.params.id, durationDays, monthlyFee);
      if (!merchant) {
        return res.status(404).json({ message: "Comerciante não encontrado" });
      }

      res.json({ message: "Acesso concedido com sucesso", merchant: toPublicMerchant(merchant) });
    } catch (error) {
      console.error("Error granting merchant access:", error);
      res.status(500).json({ message: "Erro ao conceder acesso" });
    }
  });

  // Suspend merchant access
  app.post("/api/admin/merchants/:id/suspend-access", authenticateToken, requireRole(["admin"]), async (req, res) => {
    try {
      const merchant = await storage.suspendMerchantAccess(req.params.id);
      if (!merchant) {
        return res.status(404).json({ message: "Comerciante não encontrado" });
      }

      res.json({ message: "Acesso suspenso com sucesso", merchant: toPublicMerchant(merchant) });
    } catch (error) {
      console.error("Error suspending merchant access:", error);
      res.status(500).json({ message: "Erro ao suspender acesso" });
    }
  });

  // Renew merchant access
  app.post("/api/admin/merchants/:id/renew-access", authenticateToken, requireRole(["admin"]), async (req, res) => {
    try {
      const merchant = await storage.renewMerchantAccess(req.params.id);
      if (!merchant) {
        return res.status(404).json({ message: "Comerciante não encontrado" });
      }

      res.json({ message: "Acesso renovado com sucesso", merchant: toPublicMerchant(merchant) });
    } catch (error) {
      console.error("Error renewing merchant access:", error);
      res.status(500).json({ message: "Erro ao renovar acesso" });
    }
  });

  // Update merchant access settings
  app.put("/api/admin/merchants/:id/access-settings", authenticateToken, requireRole(["admin"]), async (req, res) => {
    try {
      const { accessDurationDays, monthlyFee, paymentStatus } = req.body;
      
      const updates: any = {};
      if (accessDurationDays !== undefined) updates.accessDurationDays = accessDurationDays;
      if (monthlyFee !== undefined) updates.monthlyFee = monthlyFee;
      if (paymentStatus !== undefined) updates.paymentStatus = paymentStatus;

      const merchant = await storage.updateMerchantAccessSettings(req.params.id, updates);
      if (!merchant) {
        return res.status(404).json({ message: "Comerciante não encontrado" });
      }

      res.json({ message: "Configurações de acesso atualizadas", merchant: toPublicMerchant(merchant) });
    } catch (error) {
      console.error("Error updating merchant access settings:", error);
      res.status(500).json({ message: "Erro ao atualizar configurações de acesso" });
    }
  });

  // Get merchants with expired access
  app.get("/api/admin/merchants/expired-access", authenticateToken, requireRole(["admin"]), async (req, res) => {
    try {
      const expiredMerchants = await storage.getMerchantsWithExpiredAccess();
      res.json(expiredMerchants.map(toPublicMerchant));
    } catch (error) {
      console.error("Error getting expired merchants:", error);
      res.status(500).json({ message: "Erro ao buscar comerciantes com acesso expirado" });
    }
  });

  // Auto-suspend merchants with expired access (can be called periodically)
  app.post("/api/admin/merchants/process-expired-access", authenticateToken, requireRole(["admin"]), async (req, res) => {
    try {
      const processedCount = await storage.processExpiredAccess();

      res.json({ 
        message: `${processedCount} comerciantes com acesso expirado foram marcados como expirados`,
        processedCount 
      });
    } catch (error) {
      console.error("Error processing expired merchants:", error);
      res.status(500).json({ message: "Erro ao processar comerciantes com acesso expirado" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}