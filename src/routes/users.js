import express from "express"
import bcrypt from "bcryptjs"
import Joi from "joi"
import { prisma } from "../config/database.js"
import { requireRole } from "../middleware/auth.js"

const router = express.Router()

// Validation schemas
const createUserSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(8).required(),
  firstName: Joi.string().min(2).required(),
  lastName: Joi.string().min(2).required(),
  role: Joi.string().valid("ADMIN", "USER", "VIEWER").default("USER"),
})

const updateUserSchema = Joi.object({
  email: Joi.string().email().optional(),
  firstName: Joi.string().min(2).optional(),
  lastName: Joi.string().min(2).optional(),
  role: Joi.string().valid("ADMIN", "USER", "VIEWER").optional(),
  isActive: Joi.boolean().optional(),
})

/**
 * @route GET /api/users
 * @desc Get all users in tenant
 * @access Private (Admin only)
 */
router.get("/", requireRole(["ADMIN"]), async (req, res) => {
  try {
    const { page = 1, limit = 10, search, role, isActive } = req.query
    const skip = (Number.parseInt(page) - 1) * Number.parseInt(limit)

    const where = {
      tenantId: req.tenantId,
      ...(search && {
        OR: [
          { firstName: { contains: search, mode: "insensitive" } },
          { lastName: { contains: search, mode: "insensitive" } },
          { email: { contains: search, mode: "insensitive" } },
        ],
      }),
      ...(role && { role }),
      ...(isActive !== undefined && { isActive: isActive === "true" }),
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          isActive: true,
          lastLoginAt: true,
          createdAt: true,
          updatedAt: true,
        },
        skip,
        take: Number.parseInt(limit),
        orderBy: { createdAt: "desc" },
      }),
      prisma.user.count({ where }),
    ])

    res.json({
      users,
      pagination: {
        page: Number.parseInt(page),
        limit: Number.parseInt(limit),
        total,
        pages: Math.ceil(total / Number.parseInt(limit)),
      },
    })
  } catch (error) {
    console.error("Get users error:", error)
    res.status(500).json({
      error: "Failed to fetch users",
      code: "FETCH_USERS_ERROR",
    })
  }
})

/**
 * @route POST /api/users
 * @desc Create new user in tenant
 * @access Private (Admin only)
 */
router.post("/", requireRole(["ADMIN"]), async (req, res) => {
  try {
    const { error, value } = createUserSchema.validate(req.body)
    if (error) {
      return res.status(400).json({
        error: "Validation failed",
        details: error.details.map((d) => ({ field: d.path[0], message: d.message })),
      })
    }

    const { email, password, firstName, lastName, role } = value

    // Check if user already exists in tenant
    const existingUser = await prisma.user.findFirst({
      where: {
        email: email.toLowerCase(),
        tenantId: req.tenantId,
      },
    })

    if (existingUser) {
      return res.status(409).json({
        error: "User already exists in this tenant",
        code: "USER_EXISTS",
      })
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12)

    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        password: hashedPassword,
        firstName,
        lastName,
        role,
        tenantId: req.tenantId,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    })

    res.status(201).json({
      message: "User created successfully",
      user,
    })
  } catch (error) {
    console.error("Create user error:", error)
    res.status(500).json({
      error: "Failed to create user",
      code: "CREATE_USER_ERROR",
    })
  }
})

/**
 * @route GET /api/users/:id
 * @desc Get user by ID
 * @access Private
 */
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params

    // Users can only view their own profile unless they're admin
    if (req.user.id !== id && req.user.role !== "ADMIN") {
      return res.status(403).json({
        error: "Insufficient permissions",
        code: "INSUFFICIENT_PERMISSIONS",
      })
    }

    const user = await prisma.user.findFirst({
      where: {
        id,
        tenantId: req.tenantId,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    if (!user) {
      return res.status(404).json({
        error: "User not found",
        code: "USER_NOT_FOUND",
      })
    }

    res.json({ user })
  } catch (error) {
    console.error("Get user error:", error)
    res.status(500).json({
      error: "Failed to fetch user",
      code: "FETCH_USER_ERROR",
    })
  }
})

/**
 * @route PUT /api/users/:id
 * @desc Update user
 * @access Private (Self or Admin)
 */
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params
    const { error, value } = updateUserSchema.validate(req.body)

    if (error) {
      return res.status(400).json({
        error: "Validation failed",
        details: error.details.map((d) => ({ field: d.path[0], message: d.message })),
      })
    }

    // Users can only update their own profile unless they're admin
    if (req.user.id !== id && req.user.role !== "ADMIN") {
      return res.status(403).json({
        error: "Insufficient permissions",
        code: "INSUFFICIENT_PERMISSIONS",
      })
    }

    // Non-admin users cannot change role or isActive
    if (req.user.role !== "ADMIN") {
      delete value.role
      delete value.isActive
    }

    const existingUser = await prisma.user.findFirst({
      where: {
        id,
        tenantId: req.tenantId,
      },
    })

    if (!existingUser) {
      return res.status(404).json({
        error: "User not found",
        code: "USER_NOT_FOUND",
      })
    }

    // Check email uniqueness if email is being updated
    if (value.email && value.email !== existingUser.email) {
      const emailExists = await prisma.user.findFirst({
        where: {
          email: value.email.toLowerCase(),
          tenantId: req.tenantId,
          id: { not: id },
        },
      })

      if (emailExists) {
        return res.status(409).json({
          error: "Email already exists in this tenant",
          code: "EMAIL_EXISTS",
        })
      }
    }

    const user = await prisma.user.update({
      where: { id },
      data: {
        ...value,
        ...(value.email && { email: value.email.toLowerCase() }),
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        lastLoginAt: true,
        updatedAt: true,
      },
    })

    res.json({
      message: "User updated successfully",
      user,
    })
  } catch (error) {
    console.error("Update user error:", error)
    res.status(500).json({
      error: "Failed to update user",
      code: "UPDATE_USER_ERROR",
    })
  }
})

/**
 * @route DELETE /api/users/:id
 * @desc Delete user (soft delete)
 * @access Private (Admin only)
 */
router.delete("/:id", requireRole(["ADMIN"]), async (req, res) => {
  try {
    const { id } = req.params

    // Prevent admin from deleting themselves
    if (req.user.id === id) {
      return res.status(400).json({
        error: "Cannot delete your own account",
        code: "CANNOT_DELETE_SELF",
      })
    }

    const existingUser = await prisma.user.findFirst({
      where: {
        id,
        tenantId: req.tenantId,
      },
    })

    if (!existingUser) {
      return res.status(404).json({
        error: "User not found",
        code: "USER_NOT_FOUND",
      })
    }

    // Soft delete by setting isActive to false
    await prisma.user.update({
      where: { id },
      data: { isActive: false },
    })

    res.json({
      message: "User deleted successfully",
    })
  } catch (error) {
    console.error("Delete user error:", error)
    res.status(500).json({
      error: "Failed to delete user",
      code: "DELETE_USER_ERROR",
    })
  }
})

export default router
