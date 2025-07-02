import express from "express"
import cors from "cors"
import helmet from "helmet"
import rateLimit from "express-rate-limit"
import dotenv from "dotenv"

// Routes
import authRoutes from "./routes/auth.js"
import tenantRoutes from "./routes/tenants.js"
import userRoutes from "./routes/users.js"
import projectRoutes from "./routes/projects.js"

// Middleware
import { errorHandler } from "./middleware/errorHandler.js"
import { tenantMiddleware } from "./middleware/tenantMiddleware.js"

dotenv.config()

const app = express()
const PORT = process.env.PORT || 3000

// Security middleware
app.use(helmet())
app.use(
  cors({
    origin:
      process.env.NODE_ENV === "production"
        ? ["https://yourdomain.com"]
        : ["http://localhost:3000", "http://localhost:3001"],
    credentials: true,
  }),
)

// Rate limiting
const limiter = rateLimit({
  windowMs: Number.parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: Number.parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: {
    error: "Too many requests from this IP, please try again later.",
  },
})
app.use(limiter)

// Body parsing middleware
app.use(express.json({ limit: "10mb" }))
app.use(express.urlencoded({ extended: true }))

// Health check
app.get("/health", (req, res) => {
  res.json({
    status: "OK",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
  })
})

// API Documentation
app.get("/api/docs", (req, res) => {
  res.json({
    title: "SaaS Multitenant API",
    version: "1.0.0",
    description: "API documentation for SaaS Multitenant application",
    endpoints: {
      auth: {
        "POST /api/auth/register": "Register new user",
        "POST /api/auth/login": "Login user",
        "POST /api/auth/refresh": "Refresh JWT token",
        "POST /api/auth/logout": "Logout user",
      },
      tenants: {
        "GET /api/tenants": "Get all tenants (admin only)",
        "POST /api/tenants": "Create new tenant",
        "GET /api/tenants/:id": "Get tenant by ID",
        "PUT /api/tenants/:id": "Update tenant",
        "DELETE /api/tenants/:id": "Delete tenant",
      },
      users: {
        "GET /api/users": "Get users in tenant",
        "GET /api/users/:id": "Get user by ID",
        "PUT /api/users/:id": "Update user",
        "DELETE /api/users/:id": "Delete user",
      },
      projects: {
        "GET /api/projects": "Get projects in tenant",
        "POST /api/projects": "Create new project",
        "GET /api/projects/:id": "Get project by ID",
        "PUT /api/projects/:id": "Update project",
        "DELETE /api/projects/:id": "Delete project",
      },
    },
  })
})

// Routes
app.use("/api/auth", authRoutes)
app.use("/api/tenants", tenantRoutes)
app.use("/api/users", tenantMiddleware, userRoutes)
app.use("/api/projects", tenantMiddleware, projectRoutes)

// Error handling
app.use(errorHandler)

// 404 handler
app.use("*", (req, res) => {
  res.status(404).json({
    error: "Route not found",
    path: req.originalUrl,
  })
})

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`)
  console.log(`📚 API Documentation: http://localhost:${PORT}/api/docs`)
  console.log(`🏥 Health Check: http://localhost:${PORT}/health`)
})

export default app
