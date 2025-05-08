"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Loader2, MessageSquare, Plus } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { noteApi } from "@/lib/api"
import { useToast } from "@/components/ui/use-toast"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"

interface NotesViewProps {
  isOpen: boolean
  onClose: () => void
  todoId: string
  todoTitle: string
}

export default function NotesView({ isOpen, onClose, todoId, todoTitle }: NotesViewProps) {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [noteContent, setNoteContent] = useState("")
  const [isAddingNote, setIsAddingNote] = useState(false)

  // Fetch notes for this todo
  const { data: notes = [], isLoading } = useQuery({
    queryKey: ["notes", todoId],
    queryFn: () => noteApi.getNotes(todoId),
    enabled: isOpen,
  })

  // Create note mutation
  const createNoteMutation = useMutation({
    mutationFn: noteApi.createNote,
    onSuccess: () => {
      queryClient.invalidateQueries({queryKey: ["notes", todoId]})
      setNoteContent("")
      setIsAddingNote(false)
      toast({
        title: "Note added",
        description: "Your note has been added successfully.",
      })
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to add note",
        variant: "destructive",
      })
    },
  })

  const handleAddNote = () => {
    if (!noteContent.trim()) return

    createNoteMutation.mutate({
      todoId,
      content: noteContent,
    })
  }

  const getInitials = (name: string | null | undefined) => {
    if (!name) return "U"
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .substring(0, 2)
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Notes for "{todoTitle}"
          </DialogTitle>
        </DialogHeader>

        <div className="flex justify-end mb-4">
          <Button
            variant={isAddingNote ? "secondary" : "default"}
            size="sm"
            onClick={() => setIsAddingNote(!isAddingNote)}
          >
            {isAddingNote ? (
              "Cancel"
            ) : (
              <>
                <Plus className="h-4 w-4 mr-1" />
                Add Note
              </>
            )}
          </Button>
        </div>

        {isAddingNote && (
          <div className="space-y-2 mb-4 p-3 border rounded-md bg-muted/30">
            <Textarea
              placeholder="Write your note here..."
              value={noteContent}
              onChange={(e) => setNoteContent(e.target.value)}
              rows={3}
              className="resize-none"
            />
            <div className="flex justify-end">
              <Button onClick={handleAddNote} disabled={!noteContent.trim() || createNoteMutation.isPending} size="sm">
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
          </div>
        )}

        <Separator />

        <div className="flex-1 overflow-y-auto py-2">
          {isLoading ? (
            <div className="flex justify-center items-center h-40">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : notes.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-center">
              <MessageSquare className="h-10 w-10 text-muted-foreground mb-2" />
              <p className="text-muted-foreground">No notes yet</p>
              <Button variant="outline" size="sm" className="mt-4" onClick={() => setIsAddingNote(true)}>
                Add your first note
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {notes.map((note) => (
                <div key={note.id} className="p-3 bg-muted/30 rounded-md">
                  <div className="flex items-start gap-3">
                    <div className="flex-1">
                      <div className="flex justify-between items-center mb-1">
                        <p className="text-sm font-medium">{note.user?.name || note.user?.username || "User"}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(note.createdAt), { addSuffix: true })}
                        </p>
                      </div>
                      <p className="text-sm">{note.content}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
