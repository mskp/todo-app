"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { useSession } from "next-auth/react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent } from "@/components/ui/card"
import { Loader2, Users } from "lucide-react"
import { useQuery, useSuspenseQuery } from "@tanstack/react-query"
import { userApi } from "@/lib/api"

export default function UserSwitcher() {
  const { data: session } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()

  const { data: users, isLoading } = useSuspenseQuery({
    queryKey: ["users"],
    queryFn: userApi.getUsers,
  })

  const selectedUserId = searchParams.get("userId") || (session?.user?.id as string)

  // Handle user change
  const handleUserChange = (userId: string) => {
    // Update URL with selected user
    const params = new URLSearchParams(searchParams.toString())
    params.set("userId", userId)
    router.push(`/?${params.toString()}`)
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Loading users...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-muted-foreground" />
          <span className="text-sm font-medium">View todos for:</span>
          <Select value={selectedUserId} onValueChange={handleUserChange}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Select a user" />
            </SelectTrigger>
            <SelectContent>
              {users.map((user) => (
                <SelectItem key={user.id} value={user.id}>
                  {user.username || user.name || user.email}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  )
}
