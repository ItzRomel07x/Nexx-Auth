import type { VercelRequest, VercelResponse } from '@vercel/node';
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
}