// Data Access Layer (DAL) for API calls
import type { CreateNoteInput, CreateTodoInput, UpdateTodoInput } from "./validations"
import type { DetailedTodo } from "./types"
import { User } from "@prisma/client"

// Base API request function with error handling
async function apiRequest<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, options)

  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new Error(error.error || `API error: ${response.status}`)
  }

  return response.json()
}

// Todo API functions
export const todoApi = {
  // Get todos with pagination and filters
  getTodos: async (params: {
    page?: number
    limit?: number
    tag?: string
    priority?: string
    mentionedUser?: string
    sortBy?: string
    sortOrder?: string
    userId?: string
    search?: string
  }) => {
    const queryParams = new URLSearchParams()

    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        queryParams.set(key, String(value))
      }
    })

    return apiRequest<{ todos: DetailedTodo[]; pagination: any }>(`/api/todos?${queryParams.toString()}`)
  },

  // Get a single todo by ID
  getTodo: async (id: string) => {
    return apiRequest<DetailedTodo>(`/api/todos/${id}`)
  },

  // Create a new todo
  createTodo: async (data: CreateTodoInput) => {
    return apiRequest<DetailedTodo>("/api/todos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
  },

  // Update a todo
  updateTodo: async (id: string, data: UpdateTodoInput) => {
    return apiRequest<DetailedTodo>(`/api/todos/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
  },

  // Delete a todo
  deleteTodo: async (id: string) => {
    return apiRequest<{ success: boolean }>(`/api/todos/${id}`, {
      method: "DELETE",
    })
  },

  // Export todos
  exportTodos: async (format: "json" | "csv", userId?: string) => {
    const queryParams = new URLSearchParams({
      format,
      ...(userId && { userId }),
    })

    return `/api/export?${queryParams.toString()}`
  },
}

// User API functions
export const userApi = {
  // Get all users
  getUsers: async () => {
    return apiRequest<User[]>("/api/users")
  },
}

// Note API functions
export const noteApi = {
  // Create a new note
  createNote: async (data: CreateNoteInput) => {
    return apiRequest<any>("/api/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
  },

  // Get notes for a todo
  getNotes: async (todoId: string) => {
    return apiRequest<any[]>(`/api/notes?todoId=${todoId}`)
  },
}
