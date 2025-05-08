"use client"

import { useState } from "react"
import { useSession } from "next-auth/react"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Textarea } from "@/components/ui/textarea"
import { Loader2, MoreHorizontal, Edit, Trash, MessageSquare, ExternalLink } from "lucide-react"
import type { DetailedTodo } from "@/lib/types"
import type { Priority } from "@prisma/client"
import EditTodoDialog from "@/components/edit-todo-dialog"
import { formatDistanceToNow } from "date-fns"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { noteApi } from "@/lib/api"
import { useToast } from "@/components/ui/use-toast"
import NotesView from "@/components/notes-view"

interface TodoItemProps {
  todo: DetailedTodo
  onUpdate: (todo: DetailedTodo) => void
  onDelete: (id: string) => void
}

export default function TodoItem({ todo, onUpdate, onDelete }: TodoItemProps) {
  const { data: session } = useSession()
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false)
  const [isAddNoteDialogOpen, setIsAddNoteDialogOpen] = useState(false)
  const [isNotesViewOpen, setIsNotesViewOpen] = useState(false)
  const [noteContent, setNoteContent] = useState("")
  const [isDeleting, setIsDeleting] = useState(false)

  const priorityColors: Record<Priority, string> = {
    HIGH: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
    MEDIUM: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
    LOW: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  }

  // Fetch notes for this todo
  const { data: notes = [] } = useQuery({
    queryKey: ["notes", todo.id],
    queryFn: () => noteApi.getNotes(todo.id),
    enabled: isNotesViewOpen,
  })

  // Create note mutation
  const createNoteMutation = useMutation({
    mutationFn: noteApi.createNote,
    onMutate: async (newNoteData) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["notes", todo.id] })

      // Snapshot the previous value
      const previousNotes = queryClient.getQueryData(["notes", todo.id])

      // Create an optimistic note
      const optimisticNote = {
        id: `temp-${Date.now()}`,
        content: newNoteData.content,
        todoId: todo.id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        user: session?.user,
      }

      // Optimistically update notes list
      queryClient.setQueryData(["notes", todo.id], (old: any = []) => {
        return [...old, optimisticNote]
      })

      // Also update the todo with the new note
      const updatedTodo = {
        ...todo,
        notes: [...todo.notes, optimisticNote],
      }

      // Update the todo in the todos cache
      queryClient.setQueryData(["todos"], (old: any) => {
        if (!old) return old
        return {
          ...old,
          todos: old.todos.map((t: DetailedTodo) => (t.id === todo.id ? updatedTodo : t)),
        }
      })

      // Return a context with the previous values
      return { previousNotes, updatedTodo }
    },
    onError: (error, newNote, context) => {
      // If the mutation fails, use the context to roll back
      queryClient.setQueryData(["notes", todo.id], context?.previousNotes)

      // Roll back the todo update
      queryClient.setQueryData(["todos"], (old: any) => {
        if (!old) return old
        return {
          ...old,
          todos: old.todos.map((t: DetailedTodo) => (t.id === todo.id ? todo : t)),
        }
      })

      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to add note",
        variant: "destructive",
      })
    },
    onSuccess: (newNote) => {
      queryClient.invalidateQueries({ queryKey: ["notes", todo.id] })
      setNoteContent("")
      setIsAddNoteDialogOpen(false)
      toast({
        title: "Note added",
        description: "Your note has been added successfully.",
      })

      // Update the todo with the new note count
      onUpdate({
        ...todo,
        notes: [...todo.notes, newNote],
      })
    },
  })

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this todo?")) {
      return
    }

    setIsDeleting(true)

    try {
      // Optimistically remove the todo from the UI
      queryClient.setQueryData(["todos"], (old: any) => {
        if (!old) return old
        return {
          ...old,
          todos: old.todos.filter((t: DetailedTodo) => t.id !== todo.id),
        }
      })

      // Then perform the actual delete
      await fetch(`/api/todos/${todo.id}`, {
        method: "DELETE",
      })

      onDelete(todo.id)

      toast({
        title: "Todo deleted",
        description: "Todo has been deleted successfully.",
      })
    } catch (error) {
      // If there's an error, restore the todo
      queryClient.invalidateQueries({ queryKey: ["todos"] })

      console.error("Error deleting todo:", error)
      toast({
        title: "Error",
        description: "Failed to delete todo",
        variant: "destructive",
      })
    } finally {
      setIsDeleting(false)
    }
  }

  const handleAddNote = () => {
    if (!noteContent.trim()) return

    createNoteMutation.mutate({
      todoId: todo.id,
      content: noteContent,
    })
  }

  // Format the description to highlight mentions
  const formattedDescription = todo.description.replace(/@(\w+)/g, '<span class="text-primary font-medium">@$1</span>')

  return (
    <>
      <Card className="hover:shadow-md transition-shadow">
        <CardContent className="p-4">
          <div className="flex justify-between items-start">
            <div className="space-y-2">
              <h3 className="font-medium text-lg">{todo.title}</h3>
              <div
                className="text-sm text-muted-foreground"
                dangerouslySetInnerHTML={{ __html: formattedDescription }}
              />

              <div className="flex flex-wrap gap-2 mt-2">
                {todo.tags.map((tag) => (
                  <Badge key={tag.id} variant="outline">
                    {tag.name}
                  </Badge>
                ))}
                <Badge className={priorityColors[todo.priority as Priority] || ""}>{todo.priority}</Badge>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" onClick={() => setIsAddNoteDialogOpen(true)}>
                <MessageSquare className="h-4 w-4" />
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setIsDetailsDialogOpen(true)}>View Details</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setIsNotesViewOpen(true)}>
                    <MessageSquare className="h-4 w-4 mr-2" />
                    View Notes
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setIsEditDialogOpen(true)}>
                    <Edit className="h-4 w-4 mr-2" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleDelete} className="text-red-600" disabled={isDeleting}>
                    {isDeleting ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Trash className="h-4 w-4 mr-2" />
                    )}
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </CardContent>
        <CardFooter className="px-4 py-2 text-xs text-muted-foreground border-t">
          <div className="flex justify-between w-full">
            <span>Created {formatDistanceToNow(new Date(todo.createdAt), { addSuffix: true })}</span>
            <Button
              variant="ghost"
              size="sm"
              className="h-auto p-0 text-xs flex items-center gap-1"
              onClick={() => setIsNotesViewOpen(true)}
            >
              {todo.notes.length} notes
              <ExternalLink className="h-3 w-3 ml-1" />
            </Button>
          </div>
        </CardFooter>
      </Card>

      <EditTodoDialog
        isOpen={isEditDialogOpen}
        onClose={() => setIsEditDialogOpen(false)}
        todo={todo}
        onUpdate={onUpdate}
      />

      <Dialog open={isDetailsDialogOpen} onOpenChange={setIsDetailsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{todo.title}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-medium mb-1">Description</h4>
              <p className="text-sm text-muted-foreground">{todo.description}</p>
            </div>

            <div>
              <h4 className="text-sm font-medium mb-1">Priority</h4>
              <Badge className={priorityColors[todo.priority as Priority] || ""}>{todo.priority}</Badge>
            </div>

            <div>
              <h4 className="text-sm font-medium mb-1">Tags</h4>
              <div className="flex flex-wrap gap-2">
                {todo.tags.length > 0 ? (
                  todo.tags.map((tag) => (
                    <Badge key={tag.id} variant="outline">
                      {tag.name}
                    </Badge>
                  ))
                ) : (
                  <span className="text-sm text-muted-foreground">No tags</span>
                )}
              </div>
            </div>

            <div>
              <h4 className="text-sm font-medium mb-1">Mentioned Users</h4>
              <div className="flex flex-wrap gap-2">
                {todo.mentions.length > 0 ? (
                  todo.mentions.map((mention) => (
                    <Badge key={mention.id} variant="secondary">
                      @{mention.user.username || mention.user.name}
                    </Badge>
                  ))
                ) : (
                  <span className="text-sm text-muted-foreground">No mentions</span>
                )}
              </div>
            </div>

            <div className="flex justify-between items-center">
              <h4 className="text-sm font-medium">Notes ({todo.notes.length})</h4>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setIsDetailsDialogOpen(false)
                  setIsNotesViewOpen(true)
                }}
              >
                View All Notes
              </Button>
            </div>

            {todo.notes.length > 0 ? (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {todo.notes.slice(0, 3).map((note) => (
                  <div key={note.id} className="p-2 bg-muted rounded-md">
                    <p className="text-sm">{note.content}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatDistanceToNow(new Date(note.createdAt), { addSuffix: true })}
                    </p>
                  </div>
                ))}
                {todo.notes.length > 3 && (
                  <Button
                    variant="ghost"
                    className="w-full text-sm text-muted-foreground"
                    onClick={() => {
                      setIsDetailsDialogOpen(false)
                      setIsNotesViewOpen(true)
                    }}
                  >
                    View {todo.notes.length - 3} more notes...
                  </Button>
                )}
              </div>
            ) : (
              <span className="text-sm text-muted-foreground">No notes</span>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isAddNoteDialogOpen} onOpenChange={setIsAddNoteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Note</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea
              placeholder="Write your note here..."
              value={noteContent}
              onChange={(e) => setNoteContent(e.target.value)}
              rows={4}
            />
            <Button
              onClick={handleAddNote}
              disabled={!noteContent.trim() || createNoteMutation.isPending}
              className="w-full"
            >
              {createNoteMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Adding...
                </>
              ) : (
                "Add Note"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <NotesView
        isOpen={isNotesViewOpen}
        onClose={() => setIsNotesViewOpen(false)}
        todoId={todo.id}
        todoTitle={todo.title}
      />
    </>
  )
}
