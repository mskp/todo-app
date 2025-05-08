import { type NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { createNoteSchema } from "@/lib/validations"

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const todoId = searchParams.get("todoId")

    if (!todoId) {
      return NextResponse.json({ error: "Todo ID is required" }, { status: 400 })
    }

    // Get notes for the todo
    const notes = await prisma.note.findMany({
      where: { todoId },
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
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json(notes)
  } catch (error) {
    console.error("Error fetching notes:", error)
    return NextResponse.json({ error: "Failed to fetch notes" }, { status: 500 })
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
    const result = createNoteSchema.safeParse(body)

    if (!result.success) {
      const errors = result.error.format()
      return NextResponse.json({ error: "Invalid input data", details: errors }, { status: 400 })
    }

    const { todoId, content } = result.data

    // Check if the todo exists and belongs to the user
    const todo = await prisma.todo.findUnique({
      where: { id: todoId },
    })

    if (!todo) {
      return NextResponse.json({ error: "Todo not found" }, { status: 404 })
    }

    // Create the note
    const note = await prisma.note.create({
      data: {
        content,
        todoId,
        userId: session.user.id,
      },
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
    })

    return NextResponse.json(note)
  } catch (error) {
    console.error("Error creating note:", error)
    return NextResponse.json({ error: "Failed to create note" }, { status: 500 })
  }
}
