import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes.js";
import { setupVite, serveStatic, log } from "./vite.js";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  // Security: Define sensitive endpoints that should not log response data
  const sensitiveEndpoints = [
    '/api/auth/login',
    '/api/auth/verify',
    '/api/auth/refresh'
  ];

  // Security: Define sensitive fields that should be redacted from logs
  const sensitiveFields = ['token', 'password', 'hash', 'secret', 'key', 'authorization'];

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      
      // Security: Only log response data for non-sensitive endpoints
      if (capturedJsonResponse && !sensitiveEndpoints.some(endpoint => path.startsWith(endpoint))) {
        // Security: Redact sensitive fields from the response before logging
        const safeResponse = JSON.parse(JSON.stringify(capturedJsonResponse));
        
        function redactSensitiveData(obj: any): any {
          if (typeof obj !== 'object' || obj === null) return obj;
          
          if (Array.isArray(obj)) {
            return obj.map(redactSensitiveData);
          }
          
          const result = { ...obj };
          for (const key in result) {
            if (sensitiveFields.some(field => key.toLowerCase().includes(field))) {
              result[key] = '[REDACTED]';
            } else if (typeof result[key] === 'object') {
              result[key] = redactSensitiveData(result[key]);
            }
          }
          return result;
        }
        
        const redactedResponse = redactSensitiveData(safeResponse);
        logLine += ` :: ${JSON.stringify(redactedResponse)}`;
      } else if (sensitiveEndpoints.some(endpoint => path.startsWith(endpoint))) {
        logLine += ` :: [RESPONSE_REDACTED_FOR_SECURITY]`;
      }

      if (logLine.length > 200) {
        logLine = logLine.slice(0, 199) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    console.error("Express error handler:", err);
    res.status(status).json({ message });
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen(port, "0.0.0.0", () => {
    log(`Server running on http://0.0.0.0:${port}`);
    console.log(`Preview should be available at: https://${process.env.REPL_SLUG || 'your-repl'}.${process.env.REPL_OWNER || 'username'}.repl.co`);
  });
})();