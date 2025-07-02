/**
 * Global error handling middleware
 * Handles all unhandled errors and provides consistent error responses
 */
export const errorHandler = (error, req, res, next) => {
  console.error("Error:", {
    message: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    timestamp: new Date().toISOString(),
  })

  // Prisma errors
  if (error.code && error.code.startsWith("P")) {
    return handlePrismaError(error, res)
  }

  // Validation errors
  if (error.isJoi) {
    return res.status(400).json({
      error: "Validation failed",
      code: "VALIDATION_ERROR",
      details: error.details.map((detail) => ({
        field: detail.path.join("."),
        message: detail.message,
      })),
    })
  }

  // JWT errors
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

  // Default error
  const statusCode = error.statusCode || 500
  const message = process.env.NODE_ENV === "production" ? "Internal server error" : error.message

  res.status(statusCode).json({
    error: message,
    code: error.code || "INTERNAL_ERROR",
    ...(process.env.NODE_ENV === "development" && { stack: error.stack }),
  })
}

/**
 * Handle Prisma-specific errors
 */
const handlePrismaError = (error, res) => {
  switch (error.code) {
    case "P2002":
      return res.status(409).json({
        error: "Unique constraint violation",
        code: "DUPLICATE_ENTRY",
        field: error.meta?.target,
      })

    case "P2025":
      return res.status(404).json({
        error: "Record not found",
        code: "RECORD_NOT_FOUND",
      })

    case "P2003":
      return res.status(400).json({
        error: "Foreign key constraint violation",
        code: "FOREIGN_KEY_ERROR",
      })

    default:
      return res.status(500).json({
        error: "Database error",
        code: "DATABASE_ERROR",
      })
  }
}
