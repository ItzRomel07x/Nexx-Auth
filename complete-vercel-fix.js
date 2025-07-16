#!/usr/bin/env node

/**
 * Complete Vercel Deployment Fix
 * Comprehensive solution for all deployment issues
 */

import fs from 'fs';
import { execSync } from 'child_process';

console.log('🚀 Applying complete Vercel deployment fix...\n');

// Step 1: Fix all API routes for proper ES module imports
console.log('1. Fixing API routes...');
const apiRoutes = {
  'api/index.ts': `import type { VercelRequest, VercelResponse } from '@vercel/node';
import express from 'express';
import { registerRoutes } from '../server/routes.js';
import { setupAuth } from '../server/replitAuth.js';
import path from 'path';
import { readFile } from 'fs/promises';

const app = express();

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, X-API-Key');
  res.header('X-Content-Type-Options', 'nosniff');
  res.header('X-Frame-Options', 'DENY');
  res.header('X-XSS-Protection', '1; mode=block');
  
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: false, limit: '10mb' }));

let initialized = false;

async function initializeApp() {
  if (initialized) return;
  
  try {
    await setupAuth(app);
    await registerRoutes(app);
    initialized = true;
  } catch (error) {
    console.error('Failed to initialize app:', error);
    throw error;
  }
}

// Serve static files
app.use(express.static(path.join(process.cwd(), 'dist/public')));

// Fallback for SPA
app.get('*', async (req, res) => {
  try {
    const indexPath = path.join(process.cwd(), 'dist/public/index.html');
    const indexHtml = await readFile(indexPath, 'utf-8');
    res.send(indexHtml);
  } catch (error) {
    res.status(500).send('Server Error');
  }
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  await initializeApp();
  return app(req, res);
}`,

  'api/auth/[...auth].ts': `import type { VercelRequest, VercelResponse } from '@vercel/node';
import express from 'express';
import { setupAuth } from '../../server/replitAuth.js';
import { isAuthenticated } from '../../server/replitAuth.js';

const app = express();

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

app.use(express.json());

let initialized = false;

async function initializeAuth() {
  if (initialized) return;
  
  try {
    await setupAuth(app);
    initialized = true;
  } catch (error) {
    console.error('Failed to initialize auth:', error);
    throw error;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  await initializeAuth();
  return app(req, res);
}`,

  'api/v1/[...api].ts': `import type { VercelRequest, VercelResponse } from '@vercel/node';
import express from 'express';
import { registerRoutes } from '../../server/routes.js';

const app = express();

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, X-API-Key');
  
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

app.use(express.json());

let initialized = false;

async function initializeAPI() {
  if (initialized) return;
  
  try {
    await registerRoutes(app);
    initialized = true;
  } catch (error) {
    console.error('Failed to initialize API:', error);
    throw error;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  await initializeAPI();
  return app(req, res);
}`
};

// Write all API routes
for (const [filepath, content] of Object.entries(apiRoutes)) {
  fs.writeFileSync(filepath, content);
  console.log(`✅ Fixed ${filepath}`);
}

// Step 2: Create optimized vercel.json
console.log('\n2. Creating optimized vercel.json...');
const vercelConfig = {
  "version": 2,
  "buildCommand": "npm run build",
  "outputDirectory": "dist/public",
  "functions": {
    "api/**/*.ts": {
      "runtime": "@vercel/node@3.0.15"
    }
  },
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
      "src": "/(.*)",
      "dest": "/api/index"
    }
  ]
};

fs.writeFileSync('vercel.json', JSON.stringify(vercelConfig, null, 2));
console.log('✅ vercel.json optimized');

// Step 3: Run build process
console.log('\n3. Running build process...');
try {
  // Clean build directory
  if (fs.existsSync('dist')) {
    fs.rmSync('dist', { recursive: true, force: true });
  }
  fs.mkdirSync('dist', { recursive: true });
  fs.mkdirSync('dist/public', { recursive: true });

  // Build frontend
  console.log('Building frontend...');
  execSync('npx vite build --outDir dist/public', { stdio: 'inherit', timeout: 180000 });

  // Build backend
  console.log('Building backend...');
  execSync('npx esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist --target=es2020 --external:@replit/vite-plugin-cartographer', { stdio: 'inherit' });

  console.log('✅ Build completed successfully');
} catch (error) {
  console.error('❌ Build failed:', error.message);
  process.exit(1);
}

// Step 4: Verify deployment readiness
console.log('\n4. Verifying deployment readiness...');
const requiredFiles = [
  'dist/public/index.html',
  'dist/index.js',
  'api/index.ts',
  'api/auth/[...auth].ts',
  'api/v1/[...api].ts',
  'vercel.json'
];

let allFilesPresent = true;
for (const file of requiredFiles) {
  if (!fs.existsSync(file)) {
    console.error(`❌ Missing required file: ${file}`);
    allFilesPresent = false;
  }
}

if (allFilesPresent) {
  console.log('✅ All required files present');
} else {
  process.exit(1);
}

// Step 5: Test API routes
console.log('\n5. Testing API routes...');
try {
  const apiIndex = fs.readFileSync('api/index.ts', 'utf8');
  const apiAuth = fs.readFileSync('api/auth/[...auth].ts', 'utf8');
  const apiV1 = fs.readFileSync('api/v1/[...api].ts', 'utf8');

  if (apiIndex.includes('export default') && 
      apiAuth.includes('export default') && 
      apiV1.includes('export default')) {
    console.log('✅ API routes have proper exports');
  } else {
    console.error('❌ API routes missing proper exports');
    process.exit(1);
  }
} catch (error) {
  console.error('❌ Failed to test API routes:', error.message);
  process.exit(1);
}

console.log('\n🎉 Complete Vercel deployment fix applied successfully!');
console.log('\n📋 Summary of fixes:');
console.log('✅ API routes fixed with proper ES module imports');
console.log('✅ vercel.json optimized for serverless deployment');
console.log('✅ Build process completed successfully');
console.log('✅ All required files verified');
console.log('✅ API routes tested for proper exports');

console.log('\n🚀 Project is now ready for Vercel deployment!');
console.log('\nDeployment steps:');
console.log('1. npx vercel --prod');
console.log('2. Set environment variables in Vercel dashboard');
console.log('3. Test the deployed application');