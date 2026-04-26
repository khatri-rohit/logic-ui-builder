```markdown
# logic-ui-builder Development Patterns

> Auto-generated skill from repository analysis

## Overview
This skill teaches you the core development patterns, coding conventions, and common workflows for contributing to the `logic-ui-builder` repository. The project is a Next.js application written in TypeScript, focused on building modular UI sections and integrating features such as billing and pricing. You'll learn how to structure new components, follow the project's code style, and use suggested commands to streamline your workflow.

## Coding Conventions

**File Naming**
- Use `camelCase` for file and folder names.
  - Example: `userProfile.tsx`, `billingSection.tsx`

**Import Style**
- Use aliased imports for internal modules.
  - Example:
    ```typescript
    import { BillingForm } from '@/components/billing/billingForm';
    import { getPlans } from '@/lib/plans';
    ```

**Export Style**
- Mixed usage of default and named exports.
  - Example:
    ```typescript
    // Named export
    export function BillingSection() { ... }

    // Default export
    export default DashboardPage;
    ```

**Commit Patterns**
- Freeform commit messages, sometimes with prefixes.
- Average commit message length: ~77 characters.
  - Example: `Add pricing tier switcher to billing section`

## Workflows

### Add New UI Section or Component
**Trigger:** When you want to introduce a new section or feature to a page (e.g., landing, dashboard, billing).
**Command:** `/add-ui-section`

1. Create new component file(s) under the appropriate folder, such as `components/landing/`, `components/dashboard/`, or `components/[area]/`.
    - Example: `components/landing/featureHighlight.tsx`
2. Update the parent page or component to include the new section/component.
    - Example:
      ```typescript
      // In components/landing/landingPage.tsx
      import { FeatureHighlight } from './featureHighlight';

      export function LandingPage() {
        return (
          <main>
            {/* ...other sections... */}
            <FeatureHighlight />
          </main>
        );
      }
      ```
3. Optionally update related style files (e.g., `components/landing/page.module.css`).
4. Optionally update navigation or related UI to reference the new section.

**Files Involved:**
- `components/landing/*.tsx`
- `components/dashboard/*.tsx`
- `components/billing/*.tsx`
- `components/projects/*.tsx`
- `components/[area]/*.tsx`
- `components/landing/page.module.css`

---

### Integrate New Billing or Pricing Feature
**Trigger:** When you want to add or update billing, pricing, or subscription management functionality.
**Command:** `/add-billing-feature`

1. Create or update API route(s) under `app/api/billing/`.
    - Example: `app/api/billing/createSubscription.ts`
2. Update or add new components under `components/billing/` or `components/dashboard/`.
    - Example: `components/billing/planSelector.tsx`
3. Modify or extend billing logic in `lib/` (e.g., `lib/billing/`, `lib/plans.ts`, `lib/razorpay.ts`).
    - Example:
      ```typescript
      // lib/plans.ts
      export function getAvailablePlans() { ... }
      ```
4. Update the Prisma schema (`prisma/schema.prisma`) and generate new migration(s).
    - Example:
      ```prisma
      model Subscription {
        id        String   @id @default(uuid())
        userId    String
        plan      String
        createdAt DateTime @default(now())
      }
      ```
      Then run:
      ```
      npx prisma migrate dev --name add-subscription-model
      ```
5. Update or add relevant pages, such as `app/billing/`.

**Files Involved:**
- `app/api/billing/*.ts`
- `components/billing/*.tsx`
- `components/dashboard/*.tsx`
- `lib/billing/*.ts`
- `lib/plans.ts`
- `lib/razorpay.ts`
- `prisma/schema.prisma`
- `prisma/migrations/*/migration.sql`
- `app/billing/*.tsx`

---

## Testing Patterns

- Test files use the pattern `*.test.*` (e.g., `billingForm.test.tsx`).
- The specific testing framework is not detected, but typical TypeScript/Next.js projects use Jest or React Testing Library.
- Place test files alongside the modules they test or in a dedicated `__tests__` directory.

**Example:**
```typescript
// components/billing/billingForm.test.tsx
import { render, screen } from '@testing-library/react';
import { BillingForm } from './billingForm';

test('renders billing form', () => {
  render(<BillingForm />);
  expect(screen.getByLabelText(/credit card/i)).toBeInTheDocument();
});
```

## Commands

| Command             | Purpose                                                      |
|---------------------|--------------------------------------------------------------|
| /add-ui-section     | Scaffold and integrate a new UI section or component         |
| /add-billing-feature| Add or update billing, pricing, or subscription functionality|
```
