import express from "express"
import bcrypt from "bcryptjs"
import jwt from "jsonwebtoken"
import Joi from "joi"
import { prisma } from "../config/database.js"
import { authenticateToken } from "../middleware/auth.js"

const router = express.Router()

// Validation schemas
const registerSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(8).required(),
  firstName: Joi.string().min(2).required(),
  lastName: Joi.string().min(2).required(),
  tenantName: Joi.string().min(2).required(),
  subdomain: Joi.string()
    .min(3)
    .pattern(/^[a-z0-9-]+$/)
    .required(),
})

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
  subdomain: Joi.string().required(),
})

/**
 * @route POST /api/auth/register
 * @desc Register new user and create tenant
 * @access Public
 */
router.post("/register", async (req, res) => {
  try {
    const { error, value } = registerSchema.validate(req.body)
    if (error) {
      return res.status(400).json({
        error: "Validation failed",
        details: error.details.map((d) => ({ field: d.path[0], message: d.message })),
      })
    }

    const { email, password, firstName, lastName, tenantName, subdomain } = value

    // Check if subdomain is already taken
    const existingTenant = await prisma.tenant.findUnique({
      where: { subdomain },
    })

    if (existingTenant) {
      return res.status(409).json({
        error: "Subdomain already exists",
        code: "SUBDOMAIN_EXISTS",
      })
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12)

    // Create tenant and user in transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create tenant
      const tenant = await tx.tenant.create({
        data: {
          name: tenantName,
          subdomain: subdomain.toLowerCase(),
        },
      })

      // Create admin user
      const user = await tx.user.create({
        data: {
          email: email.toLowerCase(),
          password: hashedPassword,
          firstName,
          lastName,
          role: "ADMIN",
          tenantId: tenant.id,
        },
        include: {
          tenant: true,
        },
      })

      return { tenant, user }
    })

    // Generate JWT
    const token = jwt.sign(
      {
        userId: result.user.id,
        tenantId: result.tenant.id,
        role: result.user.role,
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || "7d" },
    )

    res.status(201).json({
      message: "Registration successful",
      user: {
        id: result.user.id,
        email: result.user.email,
        firstName: result.user.firstName,
        lastName: result.user.lastName,
        role: result.user.role,
      },
      tenant: {
        id: result.tenant.id,
        name: result.tenant.name,
        subdomain: result.tenant.subdomain,
      },
      token,
    })
  } catch (error) {
    console.error("Registration error:", error)
    res.status(500).json({
      error: "Registration failed",
      code: "REGISTRATION_ERROR",
    })
  }
})

/**
 * @route POST /api/auth/login
 * @desc Login user
 * @access Public
 */
router.post("/login", async (req, res) => {
  try {
    const { error, value } = loginSchema.validate(req.body)
    if (error) {
      return res.status(400).json({
        error: "Validation failed",
        details: error.details.map((d) => ({ field: d.path[0], message: d.message })),
      })
    }

    const { email, password, subdomain } = value

    // Find tenant
    const tenant = await prisma.tenant.findUnique({
      where: { subdomain: subdomain.toLowerCase() },
    })

    if (!tenant) {
      return res.status(404).json({
        error: "Tenant not found",
        code: "TENANT_NOT_FOUND",
      })
    }

    if (!tenant.isActive) {
      return res.status(403).json({
        error: "Tenant is inactive",
        code: "TENANT_INACTIVE",
      })
    }

    // Find user
    const user = await prisma.user.findFirst({
      where: {
        email: email.toLowerCase(),
        tenantId: tenant.id,
        isActive: true,
      },
      include: {
        tenant: true,
      },
    })

    if (!user) {
      return res.status(401).json({
        error: "Invalid credentials",
        code: "INVALID_CREDENTIALS",
      })
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password)
    if (!isValidPassword) {
      return res.status(401).json({
        error: "Invalid credentials",
        code: "INVALID_CREDENTIALS",
      })
    }

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    })

    // Generate JWT
    const token = jwt.sign(
      {
        userId: user.id,
        tenantId: tenant.id,
        role: user.role,
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || "7d" },
    )

    res.json({
      message: "Login successful",
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        lastLoginAt: user.lastLoginAt,
      },
      tenant: {
        id: tenant.id,
        name: tenant.name,
        subdomain: tenant.subdomain,
      },
      token,
    })
  } catch (error) {
    console.error("Login error:", error)
    res.status(500).json({
      error: "Login failed",
      code: "LOGIN_ERROR",
    })
  }
})

/**
 * @route GET /api/auth/me
 * @desc Get current user info
 * @access Private
 */
router.get("/me", authenticateToken, async (req, res) => {
  res.json({
    user: {
      id: req.user.id,
      email: req.user.email,
      firstName: req.user.firstName,
      lastName: req.user.lastName,
      role: req.user.role,
      lastLoginAt: req.user.lastLoginAt,
    },
    tenant: {
      id: req.user.tenant.id,
      name: req.user.tenant.name,
      subdomain: req.user.tenant.subdomain,
    },
  })
})

/**
 * @route POST /api/auth/refresh
 * @desc Refresh JWT token
 * @access Private
 */
router.post("/refresh", authenticateToken, async (req, res) => {
  try {
    const token = jwt.sign(
      {
        userId: req.user.id,
        tenantId: req.user.tenantId,
        role: req.user.role,
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || "7d" },
    )

    res.json({
      message: "Token refreshed successfully",
      token,
    })
  } catch (error) {
    console.error("Token refresh error:", error)
    res.status(500).json({
      error: "Token refresh failed",
      code: "TOKEN_REFRESH_ERROR",
    })
  }
})

export default router
