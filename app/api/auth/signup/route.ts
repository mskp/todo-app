import { type NextRequest, NextResponse } from "next/server"
import { hash } from "bcryptjs"
import { prisma } from "@/lib/prisma"
import { userSignupSchema } from "@/lib/validations"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    // Validate input data
    const result = userSignupSchema.safeParse(body)

    if (!result.success) {
      const errors = result.error.format()
      return NextResponse.json({ error: "Invalid input data", details: errors }, { status: 400 })
    }

    const { name, username, email, password } = result.data

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    })

    if (existingUser) {
      return NextResponse.json({ error: "User with this email already exists" }, { status: 409 })
    }

    // Hash password
    const hashedPassword = await hash(password, 10)

    // Create user
    const user = await prisma.user.create({
      data: {
        name,
        username,
        email,
        password: hashedPassword,
      },
      select: {
        id: true,
        name: true,
        email: true,
      },
    })

    return NextResponse.json(
      {
        message: "User created successfully",
        user: { id: user.id, name: user.name, email: user.email },
      },
      { status: 201 },
    )
  } catch (error) {
    console.error("Error creating user:", error)
    return NextResponse.json({ error: "Failed to create user" }, { status: 500 })
  }
}
