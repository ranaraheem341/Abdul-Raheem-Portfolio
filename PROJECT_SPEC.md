# Abdul Raheem portfolio

## Objective and scope

Build a professional portfolio for Abdul Raheem covering IT infrastructure, Windows Server, enterprise networking, Microsoft 365, cloud technologies, and DevOps. This objective and Step 02 scope come from the user-provided brief. Do not invent employment, credentials, achievements, contact details, or client projects.

## Foundation

- Existing stack: Next.js 16.4.6 App Router, React 19.3, strict TypeScript, Tailwind CSS 4.3.3.
- Retain the existing Turbopack CSS integration and next/font Geist / Geist Mono.
- Theme tokens live in `src/app/globals.css` using Tailwind 4 `@theme`; font variables use `@theme inline`.
- Midnight #080F1F, secondary #0C1528, surface #111D33, blue #3B82F6, cyan #22D3EE, foreground #F8FAFC, muted #94A3B8, border #253247.
- Filled actions use #2563EB for readable white labels; electric blue remains the core accent.
- Fluid display/section typography, 4px spacing unit, responsive gutters and section spacing, shared radii, shadows, transitions, and focus tokens.

## Reusable UI

Named exports in `src/components/ui/index.ts`: Container, SectionHeading, Button, Card, Badge, and their prop types.

- Container: maximum 76rem width with fluid horizontal gutters; accepts div attributes.
- SectionHeading: h2 with optional eyebrow, description, and headingId for section labeling.
- Button: primary/secondary/outline, sm/md/lg; href renders a native link, otherwise a native button defaulting to type=button. Supports native attributes, disabled buttons, and client-side handlers when imported by a Client Component. All sizes have at least 44px height.
- Card: responsive padding, optional decorative hover treatment; no implied click or tab stop.
- Badge: default/accent visual variants for compact text labels.

The page is a temporary design-system preview. Client boundaries cover the interactive button demonstration and navigation behavior; the shared shell, brand, and footer remain server components. Include named landmarks, skip navigation, visible keyboard focus, reduced-motion rules, and forced-colors fallbacks. The architecture illustration is conceptual, not a live system or achievement claim.

## Step 03 shared layout

- `src/components/layout/site-layout.tsx` owns the single header, skip link, main landmark, and footer. The root layout applies it without duplicating fonts or metadata.
- `navigation-config.ts` registers Home, About, Experience, Skills, Services, Projects, and Contact. Only Home is available, targeting the existing preview introduction at `/#home`. Activate future sections only once matching IDs exist.
- Pending sections render as disabled, unfocusable labels with accessible coming-soon descriptions; no placeholder pages or dangling anchors.
- The sticky header is 5rem tall, with global scroll padding and target margins for anchor clearance. Desktop navigation begins at 64rem.
- The mobile navigation is a nonmodal disclosure with aria-expanded/controls, native hidden behavior, Escape focus restoration, close-on-selection, outside-pointer dismissal, and resize cleanup. It overlays content without shifting the page. Active indication observes only available sections and clears outside their visible region.
- `contactLinks` in the same configuration holds nullable HTTPS/mailto destinations. LinkedIn, GitHub, Fiverr, and Email remain disabled until verified destinations are supplied.
- The footer includes brand, quick links, expertise, and contact columns. Its year is computed server-side when rendered; the current static build refreshes it on rebuild.

## Later work

The final homepage and full About, Experience, Services, Projects, and Contact sections belong to later steps. Step 03 was authorized by the supplied Step 03 brief. Step 04 requires explicit user approval. No deployment, domains, external APIs, commits, or pushes are included in the current scope.
