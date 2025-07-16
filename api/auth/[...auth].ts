import type { VercelRequest, VercelResponse } from '@vercel/node';
import express from 'express';
import { setupAuth } from '../../server/replitAuth.js';

const app = express();

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: false, limit: '10mb' }));

// CORS headers
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
  
  // Set the correct path for auth routes
  req.url = `/api/auth${req.url?.replace('/api/auth', '') || ''}`;
  
  return app(req, res);
}
