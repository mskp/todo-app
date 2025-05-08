import Navbar from "@/components/navbar"
import TodoList from "@/components/todo-list"
import UserSwitcher from "@/components/user-switcher"
import { todoApi, userApi } from "@/lib/api"
import { authOptions } from "@/lib/auth"
import { getQueryClient } from "@/lib/react-query"
import { HydrationBoundary, dehydrate } from "@tanstack/react-query"
import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const params = await searchParams;
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect("/login")
  }

  const page = typeof params.page === "string" ? Number.parseInt(params.page) : 1
  const userId = typeof params.userId === "string" ? params.userId : session.user.id
  const tag = typeof params.tag === "string" ? params.tag : undefined
  const priority = typeof params.priority === "string" ? params.priority : undefined
  const sortBy = typeof params.sortBy === "string" ? params.sortBy : "createdAt"
  const sortOrder = typeof params.sortOrder === "string" ? params.sortOrder : "desc"
  const search = typeof params.search === "string" ? params.search : undefined

  const queryClient = getQueryClient()

  await queryClient.prefetchQuery({
    queryKey: ["todos", { page, userId, tag, priority, sortBy, sortOrder, search }],
    queryFn: () => todoApi.getTodos({ page, userId, tag, priority, sortBy, sortOrder, search }),
  })

  await queryClient.prefetchQuery({
    queryKey: ["users"],
    queryFn: userApi.getUsers,
  })

  return (
    <>
      <Navbar />
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Todo List Application</h1>
          <p className="text-muted-foreground">Manage your tasks efficiently with our powerful todo app</p>
        </div>

        <HydrationBoundary state={dehydrate(queryClient)}>
          <div className="mb-6">
            <UserSwitcher />
          </div>
          <TodoList />
        </HydrationBoundary>
      </main>
    </>
  )
}
