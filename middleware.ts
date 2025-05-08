import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { getToken } from "next-auth/jwt"

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Check if the path is protected
  const isProtectedPath = pathname !== "/login" && pathname !== "/signup" && !pathname.startsWith("/api/auth")

  // Get the token from the request
  const token = await getToken({ req: request })

  // If the path is protected and there's no token, redirect to login
  if (isProtectedPath && !token) {
    const url = new URL("/login", request.url)
    url.searchParams.set("callbackUrl", pathname)
    return NextResponse.redirect(url)
  }

  // If the user is logged in and trying to access login or signup, redirect to home
  if ((pathname === "/login" || pathname === "/signup") && token) {
    return NextResponse.redirect(new URL("/", request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
