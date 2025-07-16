import type { VercelRequest, VercelResponse } from '@vercel/node';
import express from 'express';
import { registerRoutes } from '../server/routes.js';
import { setupAuth } from '../server/replitAuth.js';
import path from 'path';
import { readFile } from 'fs/promises';

const app = express();

// Global server compatibility settings
app.use((req, res, next) => {
  // CORS headers for global access
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, X-API-Key');
  res.header('Access-Control-Max-Age', '86400'); // 24 hours
  
  // Security headers for global deployment
  res.header('X-Content-Type-Options', 'nosniff');
  res.header('X-Frame-Options', 'DENY');
  res.header('X-XSS-Protection', '1; mode=block');
  res.header('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Handle preflight requests
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

// Serve static files from dist/public
app.use(express.static(path.join(process.cwd(), 'dist/public')));

// Catch-all handler for React app
app.get('*', async (req, res) => {
  try {
    const htmlPath = path.join(process.cwd(), 'dist/public/index.html');
    const html = await readFile(htmlPath, 'utf-8');
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (error) {
    console.error('Error serving index.html:', error);
    res.status(500).send('Internal Server Error');
  }
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  await initializeApp();
  return app(req, res);
}
