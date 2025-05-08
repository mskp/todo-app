"use client"

import type React from "react"

import { useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useSession } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Pagination } from "@/components/ui/pagination"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, Plus, Download, Search } from "lucide-react"
import TodoItem from "@/components/todo-item"
import CreateTodoDialog from "@/components/create-todo-dialog"
import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query"
import { todoApi } from "@/lib/api"
import { useToast } from "@/components/ui/use-toast"
import { useDebounce } from "@/hooks/use-debounce"
import type { DetailedTodo } from "@/lib/types"
import type { Tag } from "@prisma/client"

export default function TodoList() {
  const { data: session } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [selectedTag, setSelectedTag] = useState("")
  const [selectedPriority, setSelectedPriority] = useState("")
  const [sortBy, setSortBy] = useState("createdAt")
  const [sortOrder, setSortOrder] = useState("desc")
  const [searchTerm, setSearchTerm] = useState("")
  const debouncedSearchTerm = useDebounce(searchTerm, 500)

  const userId = searchParams.get("userId") || (session?.user?.id as string)
  const page = Number(searchParams.get("page") || "1")

  // Extract unique tags from todos for filtering
  const allTags =
    queryClient.getQueryData<{ todos: DetailedTodo[] }>(["todos"])?.todos.flatMap((todo) => todo.tags) || []
  const uniqueTags = Array.from(new Map(allTags.map((tag: Tag) => [tag.id, tag])).values())

  // Fetch todos with React Query
  const { data, isLoading, error } = useQuery({
    queryKey: [
      "todos",
      { page, userId, tag: selectedTag, priority: selectedPriority, sortBy, sortOrder, search: debouncedSearchTerm },
    ],
    queryFn: () =>
      todoApi.getTodos({
        page,
        userId,
        tag: selectedTag !== "all" ? selectedTag : undefined,
        priority: selectedPriority !== "all" ? selectedPriority : undefined,
        sortBy,
        sortOrder,
        search: debouncedSearchTerm || undefined,
      }),
    placeholderData: keepPreviousData,
  })

  const todos = data?.todos || []
  const totalPages = data?.pagination?.totalPages || 1

  // Mutations
  const createTodoMutation = useMutation({
    mutationFn: todoApi.createTodo,
    onMutate: async (newTodoData) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["todos"] })

      // Snapshot the previous value
      const previousTodos = queryClient.getQueryData(["todos"])

      // Optimistically update to the new value
      queryClient.setQueryData(["todos"], (old: any) => {
        const optimisticTodo = {
          id: `temp-${Date.now()}`,
          ...newTodoData,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          tags: newTodoData.tags?.map((tag: string) => ({ id: tag, name: tag })) || [],
          notes: [],
          mentions: [],
          user: session?.user,
        }

        return {
          ...old,
          todos: [optimisticTodo, ...(old?.todos || [])],
        }
      })

      // Return a context object with the snapshotted value
      return { previousTodos }
    },
    onError: (error, newTodo, context) => {
      // If the mutation fails, use the context returned from onMutate to roll back
      queryClient.setQueryData(["todos"], context?.previousTodos)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create todo",
        variant: "destructive",
      })
    },
    onSuccess: (newTodo) => {
      queryClient.invalidateQueries({ queryKey: ["todos"] })
      setIsCreateDialogOpen(false)
      toast({
        title: "Todo created",
        description: "Your todo has been created successfully.",
      })
    },
  })

  const updateTodoMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => todoApi.updateTodo(id, data),
    onMutate: async ({ id, data }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["todos"] })

      // Snapshot the previous value
      const previousTodos = queryClient.getQueryData(["todos"])

      // Optimistically update to the new value
      queryClient.setQueryData(["todos"], (old: any) => {
        return {
          ...old,
          todos: old.todos.map((todo: DetailedTodo) => (todo.id === id ? { ...todo, ...data } : todo)),
        }
      })

      // Return a context with the previous value
      return { previousTodos }
    },
    onError: (error, variables, context) => {
      // If the mutation fails, use the context to roll back
      queryClient.setQueryData(["todos"], context?.previousTodos)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update todo",
        variant: "destructive",
      })
    },
    onSuccess: (updatedTodo) => {
      queryClient.invalidateQueries({ queryKey: ["todos"] })
      toast({
        title: "Todo updated",
        description: "Your todo has been updated successfully.",
      })
    },
  })

  const deleteTodoMutation = useMutation({
    mutationFn: todoApi.deleteTodo,
    onMutate: async (id) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["todos"] })

      // Snapshot the previous value
      const previousTodos = queryClient.getQueryData(["todos"])

      // Optimistically update to the new value
      queryClient.setQueryData(["todos"], (old: any) => {
        return {
          ...old,
          todos: old.todos.filter((todo: DetailedTodo) => todo.id !== id),
        }
      })

      // Return a context with the previous value
      return { previousTodos }
    },
    onError: (error, id, context) => {
      // If the mutation fails, use the context to roll back
      queryClient.setQueryData(["todos"], context?.previousTodos)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete todo",
        variant: "destructive",
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["todos"] })
      toast({
        title: "Todo deleted",
        description: "Your todo has been deleted successfully.",
      })
    },
  })

  // Update URL when page changes
  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set("page", newPage.toString())
    router.push(`/?${params.toString()}`)
  }

  // Handle create todo
  const handleCreateTodo = (data: any) => {
    createTodoMutation.mutate(data)
  }

  // Handle update todo
  const handleUpdateTodo = (updatedTodo: DetailedTodo) => {
    updateTodoMutation.mutate({
      id: updatedTodo.id,
      data: updatedTodo,
    })
  }

  // Handle delete todo
  const handleDeleteTodo = (id: string) => {
    deleteTodoMutation.mutate(id)
  }

  // Handle export
  const handleExport = async (format: "json" | "csv") => {
    window.open(await todoApi.exportTodos(format, userId), "_blank")
  }

  // Handle search
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    // The search is handled by the debounced search term
  }

  if (isLoading && todos.length === 0) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (error && todos.length === 0) {
    return (
      <div className="text-center p-8">
        <p className="text-red-500">{error instanceof Error ? error.message : "Failed to load todos"}</p>
        <Button onClick={() => queryClient.invalidateQueries({ queryKey: ["todos"] })} className="mt-4">
          Try Again
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <Button onClick={() => setIsCreateDialogOpen(true)} className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Add New Todo
        </Button>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => handleExport("json")} className="flex items-center gap-1">
            <Download className="h-4 w-4" />
            Export JSON
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleExport("csv")} className="flex items-center gap-1">
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
        <form onSubmit={handleSearch} className="flex-1 relative">
          <Input
            placeholder="Search todos..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pr-10"
          />
          <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        </form>

        <div className="flex flex-wrap gap-2 items-center">
          <Select value={selectedTag} onValueChange={setSelectedTag}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Filter by tag" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Tags</SelectItem>
              {uniqueTags.map((tag) => (
                <SelectItem key={tag.id} value={tag.name}>
                  {tag.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedPriority} onValueChange={setSelectedPriority}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Filter by priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Priorities</SelectItem>
              <SelectItem value="HIGH">High</SelectItem>
              <SelectItem value="MEDIUM">Medium</SelectItem>
              <SelectItem value="LOW">Low</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={`${sortBy}-${sortOrder}`}
            onValueChange={(value) => {
              const [newSortBy, newSortOrder] = value.split("-")
              setSortBy(newSortBy)
              setSortOrder(newSortOrder)
            }}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="createdAt-desc">Newest First</SelectItem>
              <SelectItem value="createdAt-asc">Oldest First</SelectItem>
              <SelectItem value="priority-asc">Priority (Low to High)</SelectItem>
              <SelectItem value="priority-desc">Priority (High to Low)</SelectItem>
              <SelectItem value="title-asc">Title (A-Z)</SelectItem>
              <SelectItem value="title-desc">Title (Z-A)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {selectedTag && selectedTag !== "all" && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Active filters:</span>
          <Badge variant="outline" className="flex items-center gap-1">
            Tag: {selectedTag}
            <button onClick={() => setSelectedTag("")} className="ml-1 text-muted-foreground hover:text-foreground">
              ×
            </button>
          </Badge>
        </div>
      )}

      {todos.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center p-6">
            <p className="text-muted-foreground mb-4">No todos found</p>
            <Button onClick={() => setIsCreateDialogOpen(true)}>Create your first todo</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {todos.map((todo) => (
            <TodoItem key={todo.id} todo={todo} onUpdate={handleUpdateTodo} onDelete={handleDeleteTodo} />
          ))}
        </div>
      )}

      {totalPages > 1 && <Pagination currentPage={page} totalPages={totalPages} onPageChange={handlePageChange} />}

      <CreateTodoDialog
        isOpen={isCreateDialogOpen}
        onClose={() => setIsCreateDialogOpen(false)}
        onCreate={handleCreateTodo}
      />
    </div>
  )
}
