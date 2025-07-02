import bcrypt from "bcryptjs"
import jwt from "jsonwebtoken"
import { prisma } from "../config/database.js"

/**
 * Authentication Service
 * Handles user authentication, registration, and token management
 */
class AuthService {
  /**
   * Register new user and create tenant
   * @param {Object} userData - User registration data
   * @returns {Object} Created user and tenant with token
   */
  async register(userData) {
    const { email, password, firstName, lastName, tenantName, subdomain } = userData

    // Check if subdomain exists
    const existingTenant = await prisma.tenant.findUnique({
      where: { subdomain: subdomain.toLowerCase() },
    })

    if (existingTenant) {
      throw new Error("SUBDOMAIN_EXISTS")
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12)

    // Create tenant and user in transaction
    const result = await prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          name: tenantName,
          subdomain: subdomain.toLowerCase(),
        },
      })

      const user = await tx.user.create({
        data: {
          email: email.toLowerCase(),
          password: hashedPassword,
          firstName,
          lastName,
          role: "ADMIN",
          tenantId: tenant.id,
        },
        include: { tenant: true },
      })

      return { tenant, user }
    })

    // Generate token
    const token = this.generateToken(result.user)

    return {
      user: this.sanitizeUser(result.user),
      tenant: result.tenant,
      token,
    }
  }

  /**
   * Authenticate user login
   * @param {Object} loginData - Login credentials
   * @returns {Object} User data with token
   */
  async login(loginData) {
    const { email, password, subdomain } = loginData

    // Find tenant
    const tenant = await prisma.tenant.findUnique({
      where: { subdomain: subdomain.toLowerCase() },
    })

    if (!tenant || !tenant.isActive) {
      throw new Error("TENANT_NOT_FOUND")
    }

    // Find user
    const user = await prisma.user.findFirst({
      where: {
        email: email.toLowerCase(),
        tenantId: tenant.id,
        isActive: true,
      },
      include: { tenant: true },
    })

    if (!user) {
      throw new Error("INVALID_CREDENTIALS")
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password)
    if (!isValidPassword) {
      throw new Error("INVALID_CREDENTIALS")
    }

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    })

    // Generate token
    const token = this.generateToken(user)

    return {
      user: this.sanitizeUser(user),
      tenant,
      token,
    }
  }

  /**
   * Generate JWT token
   * @param {Object} user - User object
   * @returns {string} JWT token
   */
  generateToken(user) {
    return jwt.sign(
      {
        userId: user.id,
        tenantId: user.tenantId,
        role: user.role,
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || "7d" },
    )
  }

  /**
   * Verify JWT token
   * @param {string} token - JWT token
   * @returns {Object} Decoded token data
   */
  verifyToken(token) {
    return jwt.verify(token, process.env.JWT_SECRET)
  }

  /**
   * Remove sensitive data from user object
   * @param {Object} user - User object
   * @returns {Object} Sanitized user object
   */
  sanitizeUser(user) {
    const { password, ...sanitizedUser } = user
    return sanitizedUser
  }

  /**
   * Refresh JWT token
   * @param {Object} user - User object
   * @returns {string} New JWT token
   */
  refreshToken(user) {
    return this.generateToken(user)
  }
}

export default new AuthService()
