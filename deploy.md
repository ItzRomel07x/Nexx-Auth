# NexxAuth - Vercel Deployment Guide

## Overview

NexxAuth is a multi-tenant authentication system that can be deployed to Vercel for production use. This guide covers the complete deployment process.

## Prerequisites

- Vercel account
- PostgreSQL database (Neon recommended)
- Firebase project with Google Authentication enabled
- Node.js 20.x or later

## Environment Variables

Create these environment variables in your Vercel project settings:

### Database Configuration
```
DATABASE_URL=postgresql://username:password@host:5432/database?sslmode=require
```

### Firebase Configuration
```
FIREBASE_API_KEY=your_firebase_api_key
FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_STORAGE_BUCKET=your_project.appspot.com
FIREBASE_MESSAGING_SENDER_ID=your_sender_id
FIREBASE_APP_ID=your_app_id

# Firebase Admin SDK
FIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nyour_private_key\n-----END PRIVATE KEY-----\n"
FIREBASE_ADMIN_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your_project.iam.gserviceaccount.com
FIREBASE_ADMIN_PROJECT_ID=your_project_id
```

### Session Configuration
```
SESSION_SECRET=your_very_long_random_session_secret_at_least_64_characters_long
```

### Optional Webhook Configuration
```
WEBHOOK_SECRET=your_webhook_secret_for_signature_verification
```

## Database Setup

1. **Create PostgreSQL Database**
   - Use Neon, Supabase, or any PostgreSQL provider
   - Ensure SSL is enabled for production

2. **Run Database Migrations**
   ```bash
   npm run db:push
   ```

## Firebase Setup

1. **Create Firebase Project**
   - Go to [Firebase Console](https://console.firebase.google.com/)
   - Create a new project
   - Enable Google Authentication

2. **Configure Authentication**
   - Go to Authentication > Sign-in method
   - Enable Google provider
   - Add your Vercel domain to authorized domains

3. **Generate Service Account Key**
   - Go to Project Settings > Service Accounts
   - Generate new private key
   - Extract the required fields for environment variables

## Vercel Deployment

### Method 1: Vercel CLI

1. **Install Vercel CLI**
   ```bash
   npm install -g vercel
   ```

2. **Deploy**
   ```bash
   vercel
   ```

3. **Set Environment Variables**
   ```bash
   vercel env add DATABASE_URL
   vercel env add FIREBASE_API_KEY
   # ... add all other environment variables
   ```

### Method 2: GitHub Integration

1. **Push to GitHub**
   ```bash
   git add .
   git commit -m "Prepare for Vercel deployment"
   git push origin main
   ```

2. **Import to Vercel**
   - Go to [Vercel Dashboard](https://vercel.com/dashboard)
   - Click "Add New..."
   - Import your GitHub repository

3. **Configure Environment Variables**
   - In project settings, add all environment variables
   - Redeploy after adding variables

## Project Structure for Vercel

```
/
├── api/                    # Vercel serverless functions
│   ├── index.ts           # Main handler for static files
│   ├── auth/
│   │   └── [...auth].ts   # Authentication endpoints
│   └── v1/
│       └── [...api].ts    # API endpoints
├── client/                # React frontend
├── server/                # Server logic (imported by API functions)
├── shared/                # Shared types and schemas
├── dist/public/           # Built frontend (generated)
└── vercel.json           # Vercel configuration
```

## Configuration Files

### vercel.json
```json
{
  "version": 2,
  "buildCommand": "vite build",
  "outputDirectory": "dist/public",
  "routes": [
    {
      "src": "/api/auth/(.*)",
      "dest": "/api/auth/[...auth]"
    },
    {
      "src": "/api/v1/(.*)",
      "dest": "/api/v1/[...api]"
    },
    {
      "src": "/api/(.*)",
      "dest": "/api/index"
    },
    {
      "src": "/(.*)",
      "dest": "/api/index"
    }
  ],
  "functions": {
    "api/**/*.ts": {
      "runtime": "nodejs20.x"
    }
  }
}
```

## Security Considerations

1. **Environment Variables**
   - Never commit secrets to version control
   - Use Vercel's environment variable system
   - Set different values for preview and production

2. **CORS Configuration**
   - Update allowed origins for production
   - Remove wildcard (*) in production CORS settings

3. **Database Security**
   - Use SSL connections
   - Implement connection pooling
   - Monitor database performance

## Testing Deployment

1. **Local Testing**
   ```bash
   vercel dev
   ```

2. **Production Testing**
   - Test authentication flow
   - Verify API endpoints
   - Check database connectivity
   - Test webhook functionality

## Monitoring and Logs

1. **Vercel Dashboard**
   - Monitor function performance
   - View deployment logs
   - Check error rates

2. **Database Monitoring**
   - Monitor connection pools
   - Track query performance
   - Set up alerts for issues

## Troubleshooting

### Common Issues

1. **Firebase Authentication Errors**
   - Verify authorized domains include your Vercel URL
   - Check Firebase API key configuration
   - Ensure service account permissions

2. **Database Connection Issues**
   - Verify DATABASE_URL format
   - Check SSL configuration
   - Monitor connection limits

3. **Build Failures**
   - Check Node.js version compatibility
   - Verify all dependencies are listed
   - Review build logs for specific errors

### Debug Commands

```bash
# Check environment variables
vercel env ls

# View function logs
vercel logs

# Test local development
vercel dev
```

## Performance Optimization

1. **Cold Start Optimization**
   - Keep serverless functions lightweight
   - Use connection pooling
   - Implement proper caching

2. **Frontend Optimization**
   - Enable Vite build optimizations
   - Use code splitting
   - Optimize bundle size

## Support

For deployment issues:
1. Check Vercel documentation
2. Review Firebase setup guides
3. Monitor database provider status
4. Check project logs and error messages

## Deployment Checklist

- [ ] Database created and configured
- [ ] Firebase project setup with Google Auth
- [ ] All environment variables set in Vercel
- [ ] Domain added to Firebase authorized domains
- [ ] Database migrations run successfully
- [ ] Authentication flow tested
- [ ] API endpoints verified
- [ ] Production security settings configured
- [ ] Monitoring and alerts setup

Your NexxAuth application should now be successfully deployed to Vercel!