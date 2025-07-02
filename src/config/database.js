import { PrismaClient } from "@prisma/client"

/**
 * Database configuration and Prisma client setup
 * Implements connection pooling and error handling
 */
class Database {
  constructor() {
    this.prisma = new PrismaClient({
      log: process.env.NODE_ENV === "development" ? ["query", "info", "warn", "error"] : ["error"],
      errorFormat: "pretty",
    })
  }

  /**
   * Connect to database
   */
  async connect() {
    try {
      await this.prisma.$connect()
      console.log("✅ Database connected successfully")
    } catch (error) {
      console.error("❌ Database connection failed:", error)
      process.exit(1)
    }
  }

  /**
   * Disconnect from database
   */
  async disconnect() {
    try {
      await this.prisma.$disconnect()
      console.log("✅ Database disconnected successfully")
    } catch (error) {
      console.error("❌ Database disconnection failed:", error)
    }
  }

  /**
   * Get Prisma client instance
   */
  getClient() {
    return this.prisma
  }

  /**
   * Health check for database
   */
  async healthCheck() {
    try {
      await this.prisma.$queryRaw`SELECT 1`
      return { status: "healthy", timestamp: new Date().toISOString() }
    } catch (error) {
      return { status: "unhealthy", error: error.message, timestamp: new Date().toISOString() }
    }
  }
}

const database = new Database()
export default database
export const prisma = database.getClient()
