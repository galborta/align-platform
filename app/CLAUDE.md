# App Directory - Intent Node

**Parent:** [`/CLAUDE.md`](../CLAUDE.md)

## Purpose & Scope

Next.js 14 App Router pages and layouts. Handles routing, page rendering (RSC + Client Components), and top-level layout structure.

**Responsibilities:**
- Route definitions and dynamic segments
- Root layout with providers (Wallet, Messaging, Theme)
- Page-level data fetching (Server Components)
- Route handlers (API endpoints in `/api`)

**Out of Scope:** Reusable components (in `/components`), business logic (in `/lib`)

## Structure

```
app/
├── layout.tsx          # Root layout: providers, fonts, metadata
├── page.tsx            # Landing page
├── globals.css         # Global styles, Tailwind directives
│
├── api/                # Route handlers (server-side only)
│   ├── auth/          # Signature verification endpoints
│   ├── jobs/          # Job CRUD operations
│   ├── messages/      # DM operations
│   └── notifications/ # Notification management
│
├── projects/          # Project directory & dashboard
│   ├── page.tsx       # Project list
│   └── [id]/          # Dynamic project pages
│       └── page.tsx   # Project dashboard
│
├── messages/          # DM inbox (real-time)
│   └── page.tsx
│
├── profile/           # User profile & settings
│   └── page.tsx
│
├── jobs/              # Job marketplace
│   ├── page.tsx       # Job list
│   └── [id]/          # Job detail pages
│
└── review/            # Content review queue
    └── page.tsx
```

## Entry Points

### Root Layout (`layout.tsx`)
Wraps entire app with providers:
```typescript
<WalletProvider>
  <MessagingProvider>
    <ThemeProvider>
      {children}
    </ThemeProvider>
  </MessagingProvider>
</WalletProvider>
```

**Critical:** Providers must be ordered correctly:
1. WalletProvider (gives access to wallet state)
2. MessagingProvider (depends on wallet for holder verification)
3. ThemeProvider (UI layer, no dependencies)

### Landing Page (`page.tsx`)
Server Component that:
- Fetches featured projects
- Displays marketing content
- Links to project directory

**Pattern:** No client interactivity, pure data presentation.

## Routing Patterns

### Dynamic Routes
```typescript
// app/projects/[id]/page.tsx
export default async function ProjectPage({ 
  params 
}: { 
  params: { id: string } 
}) {
  // Server-side data fetch
  const project = await getProject(params.id)
  return <ProjectDashboard project={project} />
}
```

**Important:** `params` are always strings, even for numeric IDs. Parse with `parseInt()` or validate format.

### Parallel Routes (Advanced)
Not currently used, but Next.js supports:
```
app/
└── projects/
    └── [id]/
        ├── @dashboard/
        └── @sidebar/
```

## Server Components vs Client Components

**Default is Server Component** (can fetch data, no hooks).

Mark Client Components with `'use client'`:
```typescript
'use client'

import { useState } from 'react'

export default function InteractiveComponent() {
  const [state, setState] = useState(...)
  // ...
}
```

**When to use Client Components:**
- Need React hooks (useState, useEffect, etc)
- Event handlers (onClick, onChange, etc)
- Browser APIs (window, localStorage, etc)
- Third-party libraries requiring browser context

**Pattern:** Server Components fetch data, Client Components handle interactivity.

```typescript
// Good: Server Component wraps Client Component
async function Page() {
  const data = await fetchData() // server-side
  return <ClientComponent data={data} />
}

// Bad: Client Component fetching data
'use client'
function Page() {
  const [data, setData] = useState(null)
  useEffect(() => { fetchData().then(setData) }, []) // runs client-side
  return <div>{data}</div>
}
```

## API Routes (`/api`)

API routes are **server-side only** (Route Handlers).

**Pattern:**
```typescript
// app/api/endpoint/route.ts
export async function POST(request: Request) {
  const body = await request.json()
  
  // Verify wallet signature
  const { wallet, signature, message } = body
  const isValid = await verifySignature(wallet, signature, message)
  if (!isValid) {
    return Response.json({ error: 'Invalid signature' }, { status: 401 })
  }
  
  // Business logic
  const result = await doSomething(body)
  
  return Response.json({ data: result })
}
```

**Critical Security Pattern:**
All mutation endpoints MUST verify wallet signature. Never trust client-provided wallet address alone.

## Page-Level Data Fetching

Server Components can fetch directly:
```typescript
// app/projects/page.tsx
import { createClient } from '@/lib/supabase/server'

export default async function ProjectsPage() {
  const supabase = createClient()
  const { data: projects } = await supabase
    .from('projects')
    .select('*')
    .eq('status', 'active')
  
  return <ProjectGrid projects={projects} />
}
```

**Anti-pattern:** Don't fetch in Client Components unless user interaction requires it.

## Layouts & Nested Layouts

Layouts wrap child pages and nested layouts:

```typescript
// app/projects/layout.tsx
export default function ProjectsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="projects-container">
      <ProjectsNav />
      {children}
    </div>
  )
}
```

**Behavior:** Layouts don't re-render on navigation within their segment.

## Error Handling

Next.js provides error boundaries:

```typescript
// app/projects/error.tsx
'use client'

export default function Error({
  error,
  reset,
}: {
  error: Error
  reset: () => void
}) {
  return (
    <div>
      <h2>Something went wrong</h2>
      <button onClick={reset}>Try again</button>
    </div>
  )
}
```

**Pattern:** Error boundary catches errors in page and nested components.

## Loading States

```typescript
// app/projects/loading.tsx
export default function Loading() {
  return <ProjectsSkeleton />
}
```

**Behavior:** Shows while Server Component is fetching data.

## Metadata

```typescript
// app/projects/[id]/page.tsx
import type { Metadata } from 'next'

export async function generateMetadata({ params }): Promise<Metadata> {
  const project = await getProject(params.id)
  return {
    title: `${project.name} - Align`,
    description: project.description,
  }
}
```

**Important:** `generateMetadata` runs server-side, can fetch data.

## Common Pitfalls

**❌ Using Client Component for data fetching**
Server Components can fetch directly, Client Components require useEffect.

**❌ Forgetting to verify signatures in API routes**
Every mutation must verify wallet ownership.

**❌ Mixing server and client imports**
Server-only code (like database clients) can't be imported in Client Components.

**❌ Not handling loading states**
Users need feedback while data fetches.

## Navigation

**Working on specific pages?**
- **Projects:** [`app/projects/CLAUDE.md`](./projects/CLAUDE.md)
- **Messages:** [`app/messages/CLAUDE.md`](./messages/CLAUDE.md)
- **Jobs:** [`app/jobs/CLAUDE.md`](./jobs/CLAUDE.md)

**Working on API routes?**
- **Auth:** [`app/api/auth/CLAUDE.md`](./api/auth/CLAUDE.md)
- **Jobs:** [`app/api/jobs/CLAUDE.md`](./api/jobs/CLAUDE.md)

**Need shared components?** → [`/components/CLAUDE.md`](../components/CLAUDE.md)  
**Need business logic?** → [`/lib/CLAUDE.md`](../lib/CLAUDE.md)
