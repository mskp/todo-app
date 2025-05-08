"use client"

import type React from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import type { DetailedTodo } from "@/lib/types"
import { updateTodoSchema, type UpdateTodoInput } from "@/lib/validations"
import { zodResolver } from "@hookform/resolvers/zod"
import type { Priority, User } from "@prisma/client"
import { Loader2 } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { useForm } from "react-hook-form"
import { useQuery } from "@tanstack/react-query"
import { userApi } from "@/lib/api"

interface EditTodoDialogProps {
  isOpen: boolean
  onClose: () => void
  todo: DetailedTodo
  onUpdate: (todo: DetailedTodo) => void
}

export default function EditTodoDialog({ isOpen, onClose, todo, onUpdate }: EditTodoDialogProps) {
  const [tagInput, setTagInput] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [showMentionSuggestions, setShowMentionSuggestions] = useState(false)
  const [mentionQuery, setMentionQuery] = useState("")
  const [cursorPosition, setCursorPosition] = useState(0)
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(0)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const suggestionRefs = useRef<(HTMLDivElement | null)[]>([])
  const [filteredUsers, setFilteredUsers] = useState<User[]>([])

  // Fetch users with React Query
  const { data: users = [] } = useQuery({
    queryKey: ["users"],
    queryFn: userApi.getUsers,
    enabled: isOpen,
  })

  const form = useForm<UpdateTodoInput>({
    resolver: zodResolver(updateTodoSchema),
    defaultValues: {
      title: todo.title,
      description: todo.description,
      priority: todo.priority as Priority,
      tags: todo.tags.map((tag) => tag.name),
    },
  })

  // Initialize form when todo changes
  useEffect(() => {
    form.reset({
      title: todo.title,
      description: todo.description,
      priority: todo.priority as Priority,
      tags: todo.tags.map((tag) => tag.name),
    })
    setError("")
  }, [todo, form])

  // Handle dialog open
  const handleDialogOpen = (open: boolean) => {
    if (!open) {
      onClose()
    }
  }

  // Add tag
  const handleAddTag = () => {
    if (tagInput.trim()) {
      const currentTags = form.getValues("tags") || []
      if (!currentTags.includes(tagInput.trim())) {
        form.setValue("tags", [...currentTags, tagInput.trim()])
        setTagInput("")
      }
    }
  }

  // Remove tag
  const handleRemoveTag = (tagToRemove: string) => {
    const currentTags = form.getValues("tags") || []
    form.setValue(
      "tags",
      currentTags.filter((tag) => tag !== tagToRemove),
    )
  }

  // Handle key press for tag input
  const handleTagKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault()
      handleAddTag()
    }
  }

  // Filter users based on mention query
  useEffect(() => {
    if (users) {
      const filtered = users
        .filter((user) => {
          // Filter by username if available, otherwise by name
          const username = user.username?.toLowerCase() || ""
          const name = user.name?.toLowerCase() || ""

          return username.includes(mentionQuery.toLowerCase()) || name.includes(mentionQuery.toLowerCase())
        })
        .slice(0, 5) // Limit to 5 suggestions
      setFilteredUsers(filtered)
      setSelectedSuggestionIndex(0)
    }
  }, [users, mentionQuery])

  // Handle description input for mentions
  const handleDescriptionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value
    form.setValue("description", value)

    // Get cursor position
    const cursorPos = e.target.selectionStart || 0
    setCursorPosition(cursorPos)

    // Check if we should show mention suggestions
    const textBeforeCursor = value.substring(0, cursorPos)
    const atSignIndex = textBeforeCursor.lastIndexOf("@")

    if (atSignIndex !== -1 && !textBeforeCursor.substring(atSignIndex + 1).includes(" ")) {
      const query = textBeforeCursor.substring(atSignIndex + 1)
      setMentionQuery(query)
      setShowMentionSuggestions(true)
    } else {
      setShowMentionSuggestions(false)
    }
  }

  // Handle selecting a mention suggestion
  const handleSelectMention = (username: string) => {
    const description = form.getValues("description") || ""
    const textBeforeCursor = description.substring(0, cursorPosition)
    const textAfterCursor = description.substring(cursorPosition)

    const atSignIndex = textBeforeCursor.lastIndexOf("@")
    const newText = textBeforeCursor.substring(0, atSignIndex) + "@" + username + " " + textAfterCursor

    form.setValue("description", newText)
    setShowMentionSuggestions(false)

    // Focus back on textarea and set cursor position after the inserted mention
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus()
        const newCursorPos = atSignIndex + username.length + 2
        textareaRef.current.setSelectionRange(newCursorPos, newCursorPos)
      }
    }, 0)
  }

  // Handle keyboard navigation for mention suggestions
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!showMentionSuggestions || filteredUsers.length === 0) return

    // Handle keyboard navigation
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault()
        setSelectedSuggestionIndex((prev) => (prev + 1) % filteredUsers.length)
        break
      case "ArrowUp":
        e.preventDefault()
        setSelectedSuggestionIndex((prev) => (prev - 1 + filteredUsers.length) % filteredUsers.length)
        break
      case "Enter":
        e.preventDefault()
        if (filteredUsers[selectedSuggestionIndex]) {
          handleSelectMention(
            filteredUsers[selectedSuggestionIndex].username || filteredUsers[selectedSuggestionIndex].name || "",
          )
        }
        break
      case "Escape":
        e.preventDefault()
        setShowMentionSuggestions(false)
        break
    }
  }

  // Scroll selected suggestion into view
  useEffect(() => {
    if (showMentionSuggestions && suggestionRefs.current[selectedSuggestionIndex]) {
      suggestionRefs.current[selectedSuggestionIndex]?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      })
    }
  }, [selectedSuggestionIndex, showMentionSuggestions])

  // Submit form
  const onSubmit = async (data: UpdateTodoInput) => {
    setIsSubmitting(true)
    setError("")

    try {
      const response = await fetch(`/api/todos/${todo.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to update todo")
      }

      const updatedTodo = await response.json()
      onUpdate(updatedTodo)
      onClose()
    } catch (error) {
      console.error("Error updating todo:", error)
      setError(error instanceof Error ? error.message : "Failed to update todo. Please try again.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleDialogOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Todo</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {error && <div className="text-sm text-red-500 font-medium">{error}</div>}

            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter todo title" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem className="relative">
                  <FormLabel>Description (use @username to mention users)</FormLabel>
                  <FormControl>
                    <Textarea
                      ref={textareaRef}
                      placeholder="Enter description and @mention users"
                      className="min-h-[100px]"
                      value={field.value || ""}
                      onChange={handleDescriptionChange}
                      onKeyDown={handleKeyDown}
                    />
                  </FormControl>
                  {showMentionSuggestions && filteredUsers.length > 0 && (
                    <div className="absolute z-10 mt-1 w-full max-h-60 overflow-auto rounded-md bg-white dark:bg-gray-800 py-1 shadow-lg border border-gray-200 dark:border-gray-700">
                      {filteredUsers.map((user, index) => (
                        <div
                          key={user.id}
                          //@ts-ignore
                          ref={(el) => (suggestionRefs.current[index] = el)}
                          className={`px-4 py-2 cursor-pointer flex items-center ${
                            index === selectedSuggestionIndex
                              ? "bg-primary/10 dark:bg-primary/20"
                              : "hover:bg-gray-100 dark:hover:bg-gray-700"
                          }`}
                          onClick={() => handleSelectMention(user.username || user.name || "")}
                        >
                          <div className="flex-1">
                            <span className="font-medium">{user.username || user.name}</span>
                            {user.username && user.name && user.username !== user.name && (
                              <span className="text-muted-foreground ml-2 text-sm">({user.name})</span>
                            )}
                          </div>
                          {index === selectedSuggestionIndex && (
                            <span className="text-xs text-muted-foreground">Press Enter to select</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="priority"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Priority</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select priority" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="HIGH">High</SelectItem>
                      <SelectItem value="MEDIUM">Medium</SelectItem>
                      <SelectItem value="LOW">Low</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="tags"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tags</FormLabel>
                  <div className="flex gap-2">
                    <Input
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyPress={handleTagKeyPress}
                      placeholder="Add a tag"
                    />
                    <Button type="button" variant="outline" onClick={handleAddTag}>
                      Add
                    </Button>
                  </div>
                  {field.value && field.value.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {field.value.map((tag) => (
                        <Badge key={tag} variant="secondary" className="flex items-center gap-1">
                          {tag}
                          <button
                            type="button"
                            onClick={() => handleRemoveTag(tag)}
                            className="text-muted-foreground hover:text-foreground"
                          >
                            ×
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Updating...
                  </>
                ) : (
                  "Update Todo"
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
