# FinWise Backend

Multi-tenant household finance management application built with Node.js, TypeScript, Express, and Prisma.

## Features

- 🏠 **Multi-tenant Architecture** - Users can belong to multiple households
- 💰 **Comprehensive Finance Tracking** - Accounts, transactions, budgets, and goals
- 🔒 **Security First** - Rate limiting, Helmet, HPP, and CORS protection
- 📊 **Multi-currency Support** - Store original currency + converted base currency
- 🔄 **Recurring Transactions** - Support for recurring rules
- 📈 **AI Insights** - Budget advice, anomaly detection, savings tips
- 🗑️ **Soft Deletes** - All entities support soft deletion
- 📝 **Audit Trail** - Complete audit logging for all operations

## Tech Stack

- **Runtime**: Node.js 18+
- **Language**: TypeScript
- **Framework**: Express.js
- **ORM**: Prisma
- **Database**: PostgreSQL
- **Security**: Helmet, HPP, express-rate-limit, CORS
- **Authentication**: JWT (ready for implementation)

## Getting Started

### Prerequisites

- Node.js >= 18.0.0
- PostgreSQL database

### Installation

1. Clone the repository
2. Install dependencies:
```bash
npm install
```

3. Copy `.env.example` to `.env` and configure your database:
```bash
cp .env.example .env
```

4. Update the `DATABASE_URL` in `.env`:
```env
DATABASE_URL="postgresql://user:password@localhost:5432/finwise?schema=public"
```

5. Generate Prisma Client:
```bash
npm run prisma:generate
```

6. Run database migrations:
```bash
npm run prisma:migrate
```

### Development

Run the development server with hot reload:
```bash
npm run dev
```

### Production

Build the project:
```bash
npm run build
```

Start the production server:
```bash
npm start
```

## Database Schema

### Core Entities

- **User**: User accounts with authentication
- **Household**: Multi-tenant household management
- **HouseholdMember**: User-household relationships with roles (OWNER, ADMIN, ADULT, CHILD)
- **Invitation**: Household invitation system

### Financial Entities

- **Account**: Financial accounts (CASH, BANK, CARD, MOBILE_WALLET, OTHER)
- **Category**: Transaction categories with hierarchy support
- **Transaction**: Financial transactions with multi-currency support
- **Attachment**: Transaction attachments (receipts, documents)

### Planning & Analysis

- **Budget**: Budget management with customizable periods
- **BudgetLine**: Budget allocations per category
- **RecurringRule**: Recurring transaction rules (iCal RRULE format)
- **Goal**: Financial goals tracking
- **PlannedPayment**: Future payment planning

### Intelligence

- **Insight**: AI-generated financial insights
- **AuditLog**: Complete audit trail

## API Endpoints

### Health Check
```
GET / - API information
GET /health - Health check endpoint
```

### Coming Soon
- Authentication endpoints
- Household management
- Transaction CRUD
- Budget management
- Analytics and insights

## Security Features

- **Rate Limiting**: Global rate limiting (100 req/15min per IP)
- **Helmet**: Security headers protection
- **HPP**: HTTP Parameter Pollution protection
- **CORS**: Configurable CORS policy
- **Input Validation**: Express-validator ready
- **JWT Authentication**: Ready for implementation

## Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build TypeScript to JavaScript
- `npm start` - Run production server
- `npm run prisma:generate` - Generate Prisma Client
- `npm run prisma:migrate` - Run database migrations
- `npm run prisma:studio` - Open Prisma Studio
- `npm run lint` - Type check without emitting files

## Environment Variables

See `.env.example` for all available environment variables.

## License

Private
