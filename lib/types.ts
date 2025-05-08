import { Prisma } from "@prisma/client"

export type DetailedTodo = Prisma.TodoGetPayload<{
  include: {
    tags: true,
    notes: true,
    mentions: {
      include: {
        user: true
      }
    },
  }
}>