import { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"

const prisma = new PrismaClient()

async function main() {
  console.log("🌱 Starting database seeding...")

  try {
    // Create demo tenant
    const tenant = await prisma.tenant.create({
      data: {
        name: "Demo Company",
        subdomain: "demo",
        domain: "demo.example.com",
      },
    })

    console.log("✅ Created demo tenant:", tenant.subdomain)

    // Create admin user
    const hashedPassword = await bcrypt.hash("admin123456", 12)

    const adminUser = await prisma.user.create({
      data: {
        email: "admin@demo.com",
        password: hashedPassword,
        firstName: "Admin",
        lastName: "User",
        role: "ADMIN",
        tenantId: tenant.id,
      },
    })

    console.log("✅ Created admin user:", adminUser.email)

    // Create regular user
    const userPassword = await bcrypt.hash("user123456", 12)

    const regularUser = await prisma.user.create({
      data: {
        email: "user@demo.com",
        password: userPassword,
        firstName: "Regular",
        lastName: "User",
        role: "USER",
        tenantId: tenant.id,
      },
    })

    console.log("✅ Created regular user:", regularUser.email)

    // Create demo projects
    const projects = await Promise.all([
      prisma.project.create({
        data: {
          name: "Website Redesign",
          description: "Complete redesign of company website",
          tenantId: tenant.id,
          userId: adminUser.id,
        },
      }),
      prisma.project.create({
        data: {
          name: "Mobile App Development",
          description: "Native mobile app for iOS and Android",
          tenantId: tenant.id,
          userId: regularUser.id,
        },
      }),
      prisma.project.create({
        data: {
          name: "API Integration",
          description: "Third-party API integration project",
          tenantId: tenant.id,
          userId: adminUser.id,
        },
      }),
    ])

    console.log("✅ Created demo projects:", projects.length)

    console.log("\n🎉 Database seeding completed successfully!")
    console.log("\n📋 Demo Credentials:")
    console.log("Tenant: demo")
    console.log("Admin: admin@demo.com / admin123456")
    console.log("User: user@demo.com / user123456")
  } catch (error) {
    console.error("❌ Seeding failed:", error)
    throw error
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
