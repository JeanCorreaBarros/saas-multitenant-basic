import express from "express"
import Joi from "joi"
import { prisma } from "../config/database.js"
import { requireRole } from "../middleware/auth.js"

const router = express.Router()

// Validation schemas
const createProjectSchema = Joi.object({
  name: Joi.string().min(2).max(100).required(),
  description: Joi.string().max(500).optional(),
})

const updateProjectSchema = Joi.object({
  name: Joi.string().min(2).max(100).optional(),
  description: Joi.string().max(500).optional(),
  isActive: Joi.boolean().optional(),
})

/**
 * @route GET /api/projects
 * @desc Get all projects for tenant
 * @access Private
 */
router.get("/", async (req, res) => {
  try {
    const { page = 1, limit = 10, search, isActive } = req.query
    const skip = (Number.parseInt(page) - 1) * Number.parseInt(limit)

    const where = {
      tenantId: req.tenantId,
      ...(search && {
        OR: [
          { name: { contains: search, mode: "insensitive" } },
          { description: { contains: search, mode: "insensitive" } },
        ],
      }),
      ...(isActive !== undefined && { isActive: isActive === "true" }),
    }

    const [projects, total] = await Promise.all([
      prisma.project.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
        skip,
        take: Number.parseInt(limit),
        orderBy: { createdAt: "desc" },
      }),
      prisma.project.count({ where }),
    ])

    res.json({
      projects,
      pagination: {
        page: Number.parseInt(page),
        limit: Number.parseInt(limit),
        total,
        pages: Math.ceil(total / Number.parseInt(limit)),
      },
    })
  } catch (error) {
    console.error("Get projects error:", error)
    res.status(500).json({
      error: "Failed to fetch projects",
      code: "FETCH_PROJECTS_ERROR",
    })
  }
})

/**
 * @route POST /api/projects
 * @desc Create new project
 * @access Private
 */
router.post("/", async (req, res) => {
  try {
    const { error, value } = createProjectSchema.validate(req.body)
    if (error) {
      return res.status(400).json({
        error: "Validation failed",
        details: error.details.map((d) => ({ field: d.path[0], message: d.message })),
      })
    }

    const project = await prisma.project.create({
      data: {
        ...value,
        tenantId: req.tenantId,
        userId: req.user.id,
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    })

    res.status(201).json({
      message: "Project created successfully",
      project,
    })
  } catch (error) {
    console.error("Create project error:", error)
    res.status(500).json({
      error: "Failed to create project",
      code: "CREATE_PROJECT_ERROR",
    })
  }
})

/**
 * @route GET /api/projects/:id
 * @desc Get project by ID
 * @access Private
 */
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params

    const project = await prisma.project.findFirst({
      where: {
        id,
        tenantId: req.tenantId,
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    })

    if (!project) {
      return res.status(404).json({
        error: "Project not found",
        code: "PROJECT_NOT_FOUND",
      })
    }

    res.json({ project })
  } catch (error) {
    console.error("Get project error:", error)
    res.status(500).json({
      error: "Failed to fetch project",
      code: "FETCH_PROJECT_ERROR",
    })
  }
})

/**
 * @route PUT /api/projects/:id
 * @desc Update project
 * @access Private (Owner or Admin)
 */
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params
    const { error, value } = updateProjectSchema.validate(req.body)

    if (error) {
      return res.status(400).json({
        error: "Validation failed",
        details: error.details.map((d) => ({ field: d.path[0], message: d.message })),
      })
    }

    // Check if project exists and user has permission
    const existingProject = await prisma.project.findFirst({
      where: {
        id,
        tenantId: req.tenantId,
      },
    })

    if (!existingProject) {
      return res.status(404).json({
        error: "Project not found",
        code: "PROJECT_NOT_FOUND",
      })
    }

    // Check permissions (owner or admin)
    if (existingProject.userId !== req.user.id && req.user.role !== "ADMIN") {
      return res.status(403).json({
        error: "Insufficient permissions",
        code: "INSUFFICIENT_PERMISSIONS",
      })
    }

    const project = await prisma.project.update({
      where: { id },
      data: value,
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    })

    res.json({
      message: "Project updated successfully",
      project,
    })
  } catch (error) {
    console.error("Update project error:", error)
    res.status(500).json({
      error: "Failed to update project",
      code: "UPDATE_PROJECT_ERROR",
    })
  }
})

/**
 * @route DELETE /api/projects/:id
 * @desc Delete project
 * @access Private (Owner or Admin)
 */
router.delete("/:id", requireRole(["ADMIN"]), async (req, res) => {
  try {
    const { id } = req.params

    const existingProject = await prisma.project.findFirst({
      where: {
        id,
        tenantId: req.tenantId,
      },
    })

    if (!existingProject) {
      return res.status(404).json({
        error: "Project not found",
        code: "PROJECT_NOT_FOUND",
      })
    }

    await prisma.project.delete({
      where: { id },
    })

    res.json({
      message: "Project deleted successfully",
    })
  } catch (error) {
    console.error("Delete project error:", error)
    res.status(500).json({
      error: "Failed to delete project",
      code: "DELETE_PROJECT_ERROR",
    })
  }
})

export default router
