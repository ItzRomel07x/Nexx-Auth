# NexxAuth - Multi-Tenant Authentication System

A comprehensive multi-tenant authentication system built with React, Express.js, and PostgreSQL. Each user gets their own isolated authentication environment where they can create applications, manage users, and control access through API keys.

## 🚀 Quick Start

### Development Setup

1. **Clone and Install**
   ```bash
   git clone <your-repo>
   cd nexxauth
   npm install
   ```

2. **Environment Setup**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Database Setup**
   ```bash
   npm run db:push
   ```

4. **Start Development Server**
   ```bash
   npm run dev
   ```

### Production Deployment (Vercel)

See [deploy.md](./deploy.md) for complete deployment instructions.

## 🏗️ Architecture

- **Frontend**: React 18 + TypeScript + Vite
- **Backend**: Express.js + TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: Firebase Google OAuth + Custom Sessions
- **UI**: Tailwind CSS + Shadcn/ui
- **Deployment**: Vercel Serverless Functions

## 📚 Documentation

- [Deployment Guide](./deploy.md) - Complete Vercel deployment instructions
- [API Documentation](./client/src/pages/documentation.tsx) - API endpoints and integration
- [Integration Examples](./client/src/pages/integration-examples-new.tsx) - C#, Python examples

## 🔧 Key Features

- **Multi-Tenant Architecture**: Complete data isolation between tenants
- **Hardware ID Locking**: Prevent account sharing across devices
- **License Key System**: Control user registration and access
- **Webhook Support**: Real-time notifications for authentication events
- **Blacklist System**: Block by IP, username, email, or hardware ID
- **Activity Logging**: Comprehensive audit trail
- **Role-Based Access**: Owner, Admin, Moderator, User permissions

## 🛠️ Development Commands

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run db:push      # Push database schema
npm run check        # TypeScript type checking
```

## 📁 Project Structure

```
/
├── api/                    # Vercel serverless functions
├── client/                 # React frontend
├── server/                 # Express.js backend logic
├── shared/                 # Shared types and schemas
├── deploy.md              # Deployment documentation
└── vercel.json           # Vercel configuration
```

## 🔐 Security Features

- **Session Management**: Secure session handling with PostgreSQL store
- **CORS Protection**: Configurable cross-origin resource sharing
- **Rate Limiting**: API endpoint protection
- **Input Validation**: Zod schema validation
- **SQL Injection Protection**: Drizzle ORM with parameterized queries

## 🌐 Environment Variables

See `.env.example` for all required environment variables.

## 📄 License

MIT License - see LICENSE file for details.