import { type NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const format = searchParams.get("format") || "json"
    const userId = searchParams.get("userId") || session.user.id

    const todos = await prisma.todo.findMany({
      where: { userId },
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
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    })

    if (format === "csv") {
      const headers = ["id", "title", "description", "priority", "createdAt", "tags", "mentions", "notes"]

      const rows = todos.map((todo) => [
        todo.id,
        todo.title,
        todo.description,
        todo.priority,
        todo.createdAt.toISOString(),
        todo.tags.map((tag) => tag.name).join(", "),
        todo.mentions.map((mention) => mention.user.name).join(", "),
        todo.notes.map((note) => note.content).join("; "),
      ])

      const csvContent = [
        headers.join(","),
        ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")),
      ].join("\n")

      return new NextResponse(csvContent, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="todos-${userId}-${new Date().toISOString().split("T")[0]}.csv"`,
        },
      })
    }
    
    const jsonContent = JSON.stringify(todos, null, 2)

    return new NextResponse(jsonContent, {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="todos-${userId}-${new Date().toISOString().split("T")[0]}.json"`,
      },
    })
  } catch (error) {
    console.error("Error exporting todos:", error)
    return NextResponse.json({ error: "Failed to export todos" }, { status: 500 })
  }
}
