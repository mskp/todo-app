import { type NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { extractMentions } from "@/lib/utils"
import { createTodoSchema } from "@/lib/validations"

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const page = Number.parseInt(searchParams.get("page") || "1")
    const limit = Number.parseInt(searchParams.get("limit") || "10")
    const tag = searchParams.get("tag")
    const priority = searchParams.get("priority")
    const mentionedUser = searchParams.get("mentionedUser")
    const sortBy = searchParams.get("sortBy") || "createdAt"
    const sortOrder = searchParams.get("sortOrder") || "desc"
    const userId = searchParams.get("userId") || session.user.id
    const search = searchParams.get("search")

    const skip = (page - 1) * limit

    // Build the where clause based on filters
    const where: any = { userId }

    if (tag) {
      where.tags = {
        some: {
          name: tag,
        },
      }
    }

    if (priority) {
      where.priority = priority
    }

    if (mentionedUser) {
      where.mentions = {
        some: {
          user: {
            email: mentionedUser,
          },
        },
      }
    }

    // Add search functionality
    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
        { tags: { some: { name: { contains: search, mode: "insensitive" } } } },
      ]
    }

    // Get todos with pagination and filters
    const todos = await prisma.todo.findMany({
      where,
      include: {
        tags: true,
        notes: true,
        mentions: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                username: true,
              },
            },
          },
        },
      },
      orderBy: {
        [sortBy]: sortOrder,
      },
      skip,
      take: limit,
    })

    // Get total count for pagination
    const total = await prisma.todo.count({ where })

    return NextResponse.json({
      todos,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error("Error fetching todos:", error)
    return NextResponse.json({ error: "Failed to fetch todos" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json()

    // Validate input data
    const result = createTodoSchema.safeParse(body)

    if (!result.success) {
      const errors = result.error.format()
      return NextResponse.json({ error: "Invalid input data", details: errors }, { status: 400 })
    }

    const { title, description, priority, tags } = result.data

    // Extract mentions from description
    const mentions = extractMentions(description || "")

    // Create the todo
    const todo = await prisma.todo.create({
      data: {
        title,
        description: description || "",
        priority: priority || "MEDIUM",
        userId: session.user.id,
        tags: {
          connectOrCreate:
            tags?.map((tag: string) => ({
              where: { name: tag },
              create: { name: tag },
            })) || [],
        },
      },
      include: {
        tags: true,
      },
    })

    // Process mentions if any
    if (mentions.length > 0) {
      // Find users that match the mentions
      const mentionedUsers = await prisma.user.findMany({
        where: {
          OR: mentions.map((mention) => ({
            OR: [
              {
                username: {
                  equals: mention.replace("@", ""),
                  mode: "insensitive",
                },
              },
              {
                name: {
                  equals: mention.replace("@", ""),
                  mode: "insensitive",
                },
              },
            ],
          })),
        },
      })

      // Create mention records
      if (mentionedUsers.length > 0) {
        await prisma.mention.createMany({
          data: mentionedUsers.map((user) => ({
            todoId: todo.id,
            userId: user.id,
          })),
        })
      }
    }

    // Fetch the complete todo with all relations
    const completeTodo = await prisma.todo.findUnique({
      where: { id: todo.id },
      include: {
        tags: true,
        notes: true,
        mentions: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                username: true,
              },
            },
          },
        },
      },
    })

    return NextResponse.json(completeTodo)
  } catch (error) {
    console.error("Error creating todo:", error)
    return NextResponse.json({ error: "Failed to create todo" }, { status: 500 })
  }
}
