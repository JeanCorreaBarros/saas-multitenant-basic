import { prisma } from "../config/database.js"
import { authenticateToken } from "./auth.js"

/**
 * Tenant middleware
 * Ensures all requests are scoped to the authenticated user's tenant
 */
export const tenantMiddleware = async (req, res, next) => {
  // First authenticate the user
  await authenticateToken(req, res, () => {
    // Add tenant context to all database queries
    req.tenantId = req.user.tenantId

    // Add helper function to scope queries to tenant
    req.scopeToTenant = (query) => {
      return {
        ...query,
        where: {
          ...query.where,
          tenantId: req.tenantId,
        },
      }
    }

    next()
  })
}

/**
 * Tenant validation middleware
 * Validates tenant exists and is active
 */
export const validateTenant = async (req, res, next) => {
  try {
    const { tenantId } = req.params

    if (!tenantId) {
      return res.status(400).json({
        error: "Tenant ID is required",
        code: "TENANT_ID_REQUIRED",
      })
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
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

    req.tenant = tenant
    next()
  } catch (error) {
    console.error("Tenant validation error:", error)
    res.status(500).json({
      error: "Tenant validation failed",
      code: "TENANT_VALIDATION_ERROR",
    })
  }
}
