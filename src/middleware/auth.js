import jwt from "jsonwebtoken"
import { prisma } from "../config/database.js"

/**
 * Authentication middleware
 * Verifies JWT token and attaches user to request
 */
export const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers["authorization"]
    const token = authHeader && authHeader.split(" ")[1] // Bearer TOKEN

    if (!token) {
      return res.status(401).json({
        error: "Access token required",
        code: "TOKEN_MISSING",
      })
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET)

    // Verify user still exists and is active
    const user = await prisma.user.findFirst({
      where: {
        id: decoded.userId,
        isActive: true,
      },
      include: {
        tenant: true,
      },
    })

    if (!user) {
      return res.status(401).json({
        error: "Invalid token - user not found or inactive",
        code: "USER_NOT_FOUND",
      })
    }

    if (!user.tenant.isActive) {
      return res.status(403).json({
        error: "Tenant is inactive",
        code: "TENANT_INACTIVE",
      })
    }

    req.user = user
    req.tenantId = user.tenantId
    next()
  } catch (error) {
    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({
        error: "Invalid token",
        code: "TOKEN_INVALID",
      })
    }

    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        error: "Token expired",
        code: "TOKEN_EXPIRED",
      })
    }

    console.error("Auth middleware error:", error)
    res.status(500).json({
      error: "Authentication failed",
      code: "AUTH_ERROR",
    })
  }
}

/**
 * Role-based authorization middleware
 */
export const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: "Authentication required",
        code: "AUTH_REQUIRED",
      })
    }

    const userRoles = Array.isArray(roles) ? roles : [roles]

    if (!userRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: "Insufficient permissions",
        code: "INSUFFICIENT_PERMISSIONS",
        required: userRoles,
        current: req.user.role,
      })
    }

    next()
  }
}

/**
 * Admin only middleware
 */
export const requireAdmin = requireRole(["ADMIN"])
