# Newsletter SaaS Platform

A multi-tenant newsletter platform built with Next.js 15, TypeScript, and modern web technologies. Optimized for deployment on Vercel.

## Features

- Multi-tenant architecture with custom domains
- AI-powered content generation with OpenAI
- Advanced email automation with Resend
- Real-time analytics and reporting
- File storage with Cloudflare R2
- Background job processing with Redis/BullMQ
- Serverless-first architecture

## Tech Stack

- **Framework**: Next.js 15 with App Router & Server Actions
- **Database**: PostgreSQL (Neon/Supabase) with Drizzle ORM
- **Authentication**: Better Auth with secure sessions
- **Styling**: Tailwind CSS with shadcn/ui components
- **Email**: Resend with React Email templates
- **Storage**: Cloudflare R2 for file storage
- **Cache/Queue**: Redis (Upstash) + BullMQ
- **AI**: OpenAI API via Vercel AI SDK
- **Deployment**: Vercel with serverless functions

## Quick Start

### Local Development

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd newsletter
   ```

2. Install dependencies:
   ```bash
   pnpm install
   ```

3. Set up environment variables:
   ```bash
   cp .env.example .env.local
   # Edit .env.local with your values
   ```

4. Set up database:
   ```bash
   pnpm db:push
   pnpm db:seed
   ```

5. Start development server:
   ```bash
   pnpm dev
   ```

### Production Deployment

Deploy to Vercel in one click:

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/your-username/newsletter-saas)

Or follow the [detailed deployment guide](./VERCEL_DEPLOYMENT.md).

## Available Scripts

### Development
- `pnpm dev` - Start development server with Turbopack
- `pnpm build` - Build for production
- `pnpm start` - Start production server
- `pnpm lint` - Run ESLint
- `pnpm type-check` - Run TypeScript type checking

### Database
- `pnpm db:generate` - Generate database migrations
- `pnpm db:migrate` - Run database migrations
- `pnpm db:push` - Push schema changes to database
- `pnpm db:studio` - Open Drizzle Studio
- `pnpm db:seed` - Seed database with sample data

### Deployment
- `pnpm deploy:production` - Deploy to Vercel production
- `pnpm deploy:preview` - Deploy to Vercel preview

## Project Structure

```
src/
├── app/                 # Next.js app router
├── components/          # Reusable UI components
├── lib/                 # Utility libraries
│   ├── auth/           # Authentication logic
│   ├── db/             # Database configuration and schema
│   ├── email/          # Email service
│   ├── ai/             # AI service integration
│   ├── storage/        # File storage
│   └── queue/          # Background job processing
├── types/              # TypeScript type definitions
└── middleware.ts       # Next.js middleware
```

## Environment Variables

See `.env.example` for all required environment variables.

## License

MIT