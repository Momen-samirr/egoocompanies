require("dotenv").config();
import prisma from "../utils/prisma";
import bcrypt from "bcryptjs";

async function main() {
  const hashedPassword = await bcrypt.hash("admin123", 10);
  
  const admin = await prisma.admin.upsert({
    where: { email: "admin@ridewave.com" },
    update: {},
    create: {
      email: "admin@ridewave.com",
      password: hashedPassword,
      name: "Admin User",
      role: "SUPER_ADMIN",
    },
  });

  console.log("Admin user created:", {
    id: admin.id,
    email: admin.email,
    name: admin.name,
    role: admin.role,
  });
  console.log("\nDefault credentials:");
  console.log("Email: admin@ridewave.com");
  console.log("Password: admin123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

