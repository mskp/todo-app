import { z } from "zod"

export const userLoginSchema = z.object({
  email: z.string().email({ message: "Please enter a valid email address" }),
  password: z.string().min(8, { message: "Password must be at least 8 characters" }),
})

export const userSignupSchema = z
  .object({
    name: z.string().min(2, { message: "Name must be at least 2 characters" }),
    username: z.string().min(5, { message: "Username must be at least 5 characters" }),
    email: z.string().email({ message: "Please enter a valid email address" }),
    password: z
      .string()
      .min(8, { message: "Password must be at least 8 characters" })
      .regex(/[A-Z]/, { message: "Password must contain at least one uppercase letter" })
      .regex(/[0-9]/, { message: "Password must contain at least one number" }),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  })

export const createTodoSchema = z.object({
  title: z.string().min(1, { message: "Title is required" }).max(100, { message: "Title is too long" }),
  description: z.string().max(500, { message: "Description is too long" }).optional(),
  priority: z.enum(["HIGH", "MEDIUM", "LOW"]),
  tags: z.array(z.string()).optional(),
})

export const updateTodoSchema = z.object({
  title: z.string().min(1, { message: "Title is required" }).max(100, { message: "Title is too long" }).optional(),
  description: z.string().max(500, { message: "Description is too long" }).optional(),
  priority: z.enum(["HIGH", "MEDIUM", "LOW"]).optional(),
  tags: z.array(z.string()).optional(),
})

export const createNoteSchema = z.object({
  todoId: z.string().min(1, { message: "Todo ID is required" }),
  content: z.string().min(1, { message: "Content is required" }).max(500, { message: "Content is too long" }),
})

export type UserLoginInput = z.infer<typeof userLoginSchema>
export type UserSignupInput = z.infer<typeof userSignupSchema>
export type CreateTodoInput = z.infer<typeof createTodoSchema>
export type UpdateTodoInput = z.infer<typeof updateTodoSchema>
export type CreateNoteInput = z.infer<typeof createNoteSchema>
