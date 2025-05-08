import { PrismaClient } from "@prisma/client"
import { hash } from "bcryptjs"

const prisma = new PrismaClient()

async function main() {
  // Create 5 users
  const users = [
    { name: "Sushant Verma", username: "sushant", email: "sushant.verma@example.com" },
    { name: "Akshita Kapoor", username: "akshita", email: "akshita.kapoor@example.com" },
    { name: "Mohan Sharma", username: "mohan", email: "mohan.sharma@example.com" },
    { name: "Gurupreet Kaur", username: "gurupreet", email: "gurupreet.kaur@example.com" },
    { name: "Puneet Malhotra", username: "puneet", email: "puneet.malhotra@example.com" },
  ];
  

  // Hash the password
  const hashedPassword = await hash("password123", 10)

  // Create users
  for (const user of users) {
    await prisma.user.upsert({
      where: { email: user.email },
      update: {},
      create: {
        name: user.name,
        username: user.username,
        email: user.email,
        password: hashedPassword,
      },
    })
  }

  // Create some tags
  const tags = ["Work", "Personal", "Urgent", "Later", "Ideas", "Meeting"]

  for (const tag of tags) {
    await prisma.tag.upsert({
      where: { name: tag },
      update: {},
      create: {
        name: tag,
      },
    })
  }

  console.log("Seed data created successfully")
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
