import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// Next.js 16 renamed Middleware to Proxy (same runtime mechanism, new file
// name/convention) — see frontend/node_modules/next/dist/docs/01-app/01-getting-started/16-proxy.md.
// clerkMiddleware() returns a NextMiddleware-typed function, and
// `NextProxy = NextMiddleware` is a direct type alias, so it is used as the
// default export here unchanged.

const isPublicRoute = createRouteMatcher(["/sign-in(.*)", "/sign-up(.*)"]);

export default clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
    "/__clerk/:path*",
  ],
};
