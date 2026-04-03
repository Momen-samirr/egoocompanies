require("dotenv").config();
import prisma from "../utils/prisma";
import bcrypt from "bcryptjs";

async function main() {
  const email = process.env.ADMIN_EMAIL || "admin@ridewave.com";
  const password = process.env.ADMIN_PASSWORD || "admin123";
  const name = process.env.ADMIN_NAME || "Admin User";
  const role = (process.env.ADMIN_ROLE as
    | "SUPER_ADMIN"
    | "ADMIN"
    | "SUPPORT"
    | "COMPANY") || "SUPER_ADMIN";

  const hashedPassword = await bcrypt.hash(password, 10);
  
  const admin = await prisma.admin.upsert({
    where: { email },
    update: {
      password: hashedPassword,
      name,
      role,
    },
    create: {
      email,
      password: hashedPassword,
      name,
      role,
    },
  });

  console.log("Admin user created:", {
    id: admin.id,
    email: admin.email,
    name: admin.name,
    role: admin.role,
  });
  console.log("\nDefault credentials:");
  console.log(`Email: ${email}`);
  console.log(`Password: ${password}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

