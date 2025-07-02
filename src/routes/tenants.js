import express from "express"
import Joi from "joi"
import { prisma } from "../config/database.js"
import { authenticateToken, requireRole } from "../middleware/auth.js"

const router = express.Router()

// Validation schemas
const createTenantSchema = Joi.object({
  name: Joi.string().min(2).max(100).required(),
  subdomain: Joi.string()
    .min(3)
    .max(50)
    .pattern(/^[a-z0-9-]+$/)
    .required(),
  domain: Joi.string().domain().optional(),
})

const updateTenantSchema = Joi.object({
  name: Joi.string().min(2).max(100).optional(),
  domain: Joi.string().domain().optional(),
  isActive: Joi.boolean().optional(),
})

/**
 * @route GET /api/tenants
 * @desc Get all tenants (Super Admin only)
 * @access Private (Super Admin)
 */
router.get("/", authenticateToken, async (req, res) => {
  try {
    // This would typically require a super admin role
    // For now, we'll allow any authenticated user to see basic tenant info
    const { page = 1, limit = 10, search, isActive } = req.query
    const skip = (Number.parseInt(page) - 1) * Number.parseInt(limit)

    const where = {
      ...(search && {
        OR: [
          { name: { contains: search, mode: "insensitive" } },
          { subdomain: { contains: search, mode: "insensitive" } },
        ],
      }),
      ...(isActive !== undefined && { isActive: isActive === "true" }),
    }

    const [tenants, total] = await Promise.all([
      prisma.tenant.findMany({
        where,
        select: {
          id: true,
          name: true,
          subdomain: true,
          domain: true,
          isActive: true,
          createdAt: true,
          _count: {
            select: {
              users: true,
              projects: true,
            },
          },
        },
        skip,
        take: Number.parseInt(limit),
        orderBy: { createdAt: "desc" },
      }),
      prisma.tenant.count({ where }),
    ])

    res.json({
      tenants,
      pagination: {
        page: Number.parseInt(page),
        limit: Number.parseInt(limit),
        total,
        pages: Math.ceil(total / Number.parseInt(limit)),
      },
    })
  } catch (error) {
    console.error("Get tenants error:", error)
    res.status(500).json({
      error: "Failed to fetch tenants",
      code: "FETCH_TENANTS_ERROR",
    })
  }
})

/**
 * @route POST /api/tenants
 * @desc Create new tenant
 * @access Public (for registration)
 */
router.post("/", async (req, res) => {
  try {
    const { error, value } = createTenantSchema.validate(req.body)
    if (error) {
      return res.status(400).json({
        error: "Validation failed",
        details: error.details.map((d) => ({ field: d.path[0], message: d.message })),
      })
    }

    const { name, subdomain, domain } = value

    // Check if subdomain already exists
    const existingTenant = await prisma.tenant.findUnique({
      where: { subdomain: subdomain.toLowerCase() },
    })

    if (existingTenant) {
      return res.status(409).json({
        error: "Subdomain already exists",
        code: "SUBDOMAIN_EXISTS",
      })
    }

    // Check if domain already exists (if provided)
    if (domain) {
      const existingDomain = await prisma.tenant.findUnique({
        where: { domain: domain.toLowerCase() },
      })

      if (existingDomain) {
        return res.status(409).json({
          error: "Domain already exists",
          code: "DOMAIN_EXISTS",
        })
      }
    }

    const tenant = await prisma.tenant.create({
      data: {
        name,
        subdomain: subdomain.toLowerCase(),
        domain: domain?.toLowerCase(),
      },
    })

    res.status(201).json({
      message: "Tenant created successfully",
      tenant: {
        id: tenant.id,
        name: tenant.name,
        subdomain: tenant.subdomain,
        domain: tenant.domain,
        isActive: tenant.isActive,
      },
    })
  } catch (error) {
    console.error("Create tenant error:", error)
    res.status(500).json({
      error: "Failed to create tenant",
      code: "CREATE_TENANT_ERROR",
    })
  }
})

/**
 * @route GET /api/tenants/:id
 * @desc Get tenant by ID
 * @access Private
 */
router.get("/:id", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params

    // Users can only view their own tenant unless they're super admin
    if (req.user.tenantId !== id) {
      return res.status(403).json({
        error: "Insufficient permissions",
        code: "INSUFFICIENT_PERMISSIONS",
      })
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            users: true,
            projects: true,
          },
        },
      },
    })

    if (!tenant) {
      return res.status(404).json({
        error: "Tenant not found",
        code: "TENANT_NOT_FOUND",
      })
    }

    res.json({ tenant })
  } catch (error) {
    console.error("Get tenant error:", error)
    res.status(500).json({
      error: "Failed to fetch tenant",
      code: "FETCH_TENANT_ERROR",
    })
  }
})

/**
 * @route PUT /api/tenants/:id
 * @desc Update tenant
 * @access Private (Admin only)
 */
router.put("/:id", authenticateToken, requireRole(["ADMIN"]), async (req, res) => {
  try {
    const { id } = req.params
    const { error, value } = updateTenantSchema.validate(req.body)

    if (error) {
      return res.status(400).json({
        error: "Validation failed",
        details: error.details.map((d) => ({ field: d.path[0], message: d.message })),
      })
    }

    // Users can only update their own tenant
    if (req.user.tenantId !== id) {
      return res.status(403).json({
        error: "Insufficient permissions",
        code: "INSUFFICIENT_PERMISSIONS",
      })
    }

    const existingTenant = await prisma.tenant.findUnique({
      where: { id },
    })

    if (!existingTenant) {
      return res.status(404).json({
        error: "Tenant not found",
        code: "TENANT_NOT_FOUND",
      })
    }

    // Check domain uniqueness if domain is being updated
    if (value.domain && value.domain !== existingTenant.domain) {
      const domainExists = await prisma.tenant.findUnique({
        where: { domain: value.domain.toLowerCase() },
      })

      if (domainExists) {
        return res.status(409).json({
          error: "Domain already exists",
          code: "DOMAIN_EXISTS",
        })
      }
    }

    const tenant = await prisma.tenant.update({
      where: { id },
      data: {
        ...value,
        ...(value.domain && { domain: value.domain.toLowerCase() }),
      },
    })

    res.json({
      message: "Tenant updated successfully",
      tenant,
    })
  } catch (error) {
    console.error("Update tenant error:", error)
    res.status(500).json({
      error: "Failed to update tenant",
      code: "UPDATE_TENANT_ERROR",
    })
  }
})

/**
 * @route DELETE /api/tenants/:id
 * @desc Delete tenant (soft delete)
 * @access Private (Super Admin only)
 */
router.delete("/:id", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params

    // This would typically require super admin permissions
    // For now, prevent deletion of own tenant
    if (req.user.tenantId === id) {
      return res.status(400).json({
        error: "Cannot delete your own tenant",
        code: "CANNOT_DELETE_OWN_TENANT",
      })
    }

    const existingTenant = await prisma.tenant.findUnique({
      where: { id },
    })

    if (!existingTenant) {
      return res.status(404).json({
        error: "Tenant not found",
        code: "TENANT_NOT_FOUND",
      })
    }

    // Soft delete by setting isActive to false
    await prisma.tenant.update({
      where: { id },
      data: { isActive: false },
    })

    res.json({
      message: "Tenant deleted successfully",
    })
  } catch (error) {
    console.error("Delete tenant error:", error)
    res.status(500).json({
      error: "Failed to delete tenant",
      code: "DELETE_TENANT_ERROR",
    })
  }
})

export default router
