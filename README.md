# Newsletter SaaS Platform

A multi-tenant newsletter platform built with Next.js 15, TypeScript, and modern web technologies.

## Features

- Multi-tenant architecture with custom domains
- AI-powered content generation
- Advanced email automation
- Real-time analytics and reporting
- Subscription management with Stripe
- File storage with AWS S3
- Background job processing with Redis/BullMQ

## Tech Stack

- **Framework**: Next.js 15 with TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: Better Auth
- **Styling**: Tailwind CSS with shadcn/ui
- **Email**: Resend
- **Storage**: AWS S3
- **Queue**: Redis + BullMQ
- **AI**: OpenAI API
- **Payments**: Stripe

## Getting Started

1. Clone the repository
2. Install dependencies:
   ```bash
   pnpm install
   ```

3. Copy environment variables:
   ```bash
   cp .env.example .env.local
   ```

4. Fill in your environment variables in `.env.local`

5. Set up your database:
   ```bash
   pnpm db:push
   ```

6. Start the development server:
   ```bash
   pnpm dev
   ```

## Available Scripts

- `pnpm dev` - Start development server
- `pnpm build` - Build for production
- `pnpm start` - Start production server
- `pnpm lint` - Run ESLint
- `pnpm type-check` - Run TypeScript type checking
- `pnpm db:generate` - Generate database migrations
- `pnpm db:migrate` - Run database migrations
- `pnpm db:push` - Push schema changes to database
- `pnpm db:studio` - Open Drizzle Studio
- `pnpm db:seed` - Seed database with sample data

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