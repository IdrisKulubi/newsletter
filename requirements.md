# Newsletter SaaS Platform – Requirements

This document outlines the functional and technical requirements for the AI-powered end-to-end newsletter SaaS platform for consulting companies.

---

## 1. Overview
The platform enables consulting firms to:
- Create, customize, and manage newsletters.
- Use AI (via OpenAI with Vercel’s AI SDK) for content generation, subject line optimization, and post-campaign insights.
- Send newsletters through **Resend** as the email provider.
- Track analytics (opens, clicks, bounces, unsubscribes).
- Provide each tenant/company with a dedicated subdomain/section for content and campaigns.

---

## 2. Core Features

### 2.1 Multi-Tenant Support
- Each company has its own workspace.
- Subdomain or custom domain support:  
  - `company1.newsletter.com` (default)  
  - `news.company1.com` (custom DNS setup).  
- Role-based access: Admins, Editors, Viewers.

### 2.2 Authentication & Authorization
- Implemented with **BetterAuth**.
- Supports:
  - Email/password login.
  - OAuth (Google, Microsoft).
  - Multi-tenant session handling.
- RBAC: Admin (manage workspace), Editor (create campaigns), Viewer (analytics only).

### 2.3 Newsletter Creation
- Editor interface with block-based content builder.
- Support for text, images, links, and sections.
- React Email templates (render to both HTML + text).
- AI-assisted tools:
  - Content summarizer.
  - Subject line optimizer.
  - Tone/style adjustments.

### 2.4 Campaign Management
- Create, preview, and schedule campaigns.
- Workflow: Draft → Review → Schedule/Send → Completed.
- Send via **Resend API** (batch + queue system with retry).
- Personalization tokens (e.g., `{{firstName}}`).

### 2.5 Analytics & Feedback
- Webhook integration from Resend for events:
  - Delivered, Opened, Clicked, Bounced, Unsubscribed, Complained.
- Dashboard with:
  - Open/click-through rate.
  - Bounce rate.
  - Engagement by link.
  - Audience segmentation performance.
- AI post-campaign insights (OpenAI).

---

## 3. Technical Requirements

### 3.1 Frontend
- **Next.js 15** with Server-Side Rendering (SSR).
- **Server Actions** for secure DB mutations and email sending.
- UI framework: **Tailwind CSS + shadcn/ui**.
- Template rendering: **@react-email**.

### 3.2 Backend
- Database: **Postgres** with **Drizzle ORM**.
- Queue system: Redis + BullMQ (for batch email sends).
- Email provider: **Resend**.
- AI provider: **OpenAI** via **Vercel AI SDK**.
- File storage (images/logos): Supabase Storage or Vercel Blob.

### 3.3 Authentication
- **BetterAuth** for session management.
- Secure cookie-based sessions.
- CSRF & RLS policies in DB for tenant isolation.

### 3.4 Analytics
- Store raw email events in DB.
- Aggregate nightly for dashboards.
- Optional: forward raw logs to **ClickHouse** for advanced analytics.

---

## 4. AI Features

### 4.1 Content Generation
- Generate draft newsletter copy from uploaded documents or notes.
- Summarize long reports into key insights.

### 4.2 Optimization
- Generate multiple subject line variations with performance predictions.
- Suggest tone adjustments (professional, casual, concise).

### 4.3 Post-Campaign Analysis
- AI writes executive summary of campaign results.
- Highlight high-performing links and audience segments.

---

## 5. Non-Functional Requirements
- **Scalability**: Support multiple companies, each sending thousands of emails.
- **Deliverability**: Warmup flows for new domains, DKIM/SPF setup.
- **Security**:  
  - Tenant data isolation.  
  - Encrypted secrets.  
  - Rate limiting on API actions.  
- **Performance**:  
  - Dashboard loads <1s for 100k events.  
  - Batch sending system handles retries gracefully.  
- **Observability**:  
  - Logging with pino/winston.  
  - Monitoring via Sentry/Datadog.

---

## 6. Milestones (MVP → Full)
1. **MVP**  
   - Multi-tenant auth.  
   - Basic newsletter creation.  
   - Resend integration for sending.  
   - Basic analytics (delivered, opened, clicked).  
   - AI subject line generation.  

2. **Phase 2**  
   - Custom domains.  
   - AI-powered content summarization.  
   - Advanced analytics dashboard.  
   - Role-based access.  

3. **Phase 3**  
   - AI-driven post-campaign executive summaries.  
   - Segmentation + personalization tokens.  
   - Billing & subscription plans.  
   - API for external integrations (CRMs, Slack).  

---
