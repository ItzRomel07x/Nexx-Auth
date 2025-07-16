import type { VercelRequest, VercelResponse } from '@vercel/node';
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
}