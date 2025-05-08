import { type NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { extractMentions } from "@/lib/utils"
import { updateTodoSchema } from "@/lib/validations"

type Context = { params: Promise<{ id: string }> };

export async function GET(
  _: NextRequest,
  { params }: Context) {
  try {
    const { id } = await params;
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const todo = await prisma.todo.findUnique({
      where: { id },
      include: {
        tags: true,
        notes: {
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
          orderBy: {
            createdAt: "desc",
          },
        },
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

    if (!todo) {
      return NextResponse.json({ error: "Todo not found" }, { status: 404 })
    }

    return NextResponse.json(todo)
  } catch (error) {
    console.error("Error fetching todo:", error)
    return NextResponse.json({ error: "Failed to fetch todo" }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: Context) {
  try {
    const { id } = await params;
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json()

    // Validate input data
    const result = updateTodoSchema.safeParse(body)

    if (!result.success) {
      const errors = result.error.format()
      return NextResponse.json({ error: "Invalid input data", details: errors }, { status: 400 })
    }

    const { title, description, priority, tags } = result.data

    // Find the todo first to check ownership
    const existingTodo = await prisma.todo.findUnique({
      where: { id },
      include: { tags: true },
    })

    if (!existingTodo) {
      return NextResponse.json({ error: "Todo not found" }, { status: 404 })
    }

    // Extract mentions from description if it's being updated
    const mentions = description ? extractMentions(description) : []

    // Update the todo
    const updatedTodo = await prisma.todo.update({
      where: { id },
      data: {
        ...(title && { title }),
        ...(description && { description }),
        ...(priority && { priority }),
        ...(tags && {
          tags: {
            disconnect: existingTodo.tags.map((tag) => ({ id: tag.id })),
            connectOrCreate: tags.map((tag: string) => ({
              where: { name: tag },
              create: { name: tag },
            })),
          },
        }),
      },
      include: {
        tags: true,
      },
    })

    // Process mentions if description was updated
    if (description && mentions.length > 0) {
      // Remove existing mentions
      await prisma.mention.deleteMany({
        where: { todoId: id },
      })

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

      // Create new mention records
      if (mentionedUsers.length > 0) {
        await prisma.mention.createMany({
          data: mentionedUsers.map((user) => ({
            todoId: id,
            userId: user.id,
          })),
        })
      }
    }

    // Fetch the complete updated todo with all relations
    const completeTodo = await prisma.todo.findUnique({
      where: { id },
      include: {
        tags: true,
        notes: {
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
          orderBy: {
            createdAt: "desc",
          },
        },
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
    console.error("Error updating todo:", error)
    return NextResponse.json({ error: "Failed to update todo" }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: Context) {
  try {
    const { id } = await params;
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Find the todo first to check ownership
    const todo = await prisma.todo.findUnique({
      where: { id },
    })

    if (!todo) {
      return NextResponse.json({ error: "Todo not found" }, { status: 404 })
    }

    // Delete related records first
    await prisma.mention.deleteMany({
      where: { todoId: id },
    })

    await prisma.note.deleteMany({
      where: { todoId: id },
    })

    // Delete the todo
    await prisma.todo.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting todo:", error)
    return NextResponse.json({ error: "Failed to delete todo" }, { status: 500 })
  }
}
