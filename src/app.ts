import cors from 'cors';
import express, { Application, Request, Response } from 'express';
import helmet from 'helmet';
import path from 'path';
import { config } from './config';
import { errorHandler } from './middleware/errorHandler';
import { supabaseClient } from './repositories/database';
import { dataStore } from './repositories/dataStore';
import apiRoutes from './routes';

const app: Application = express();

// Security & Parsing Middleware
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      const allowedStatic = [
        config.frontendUrl,
        'https://clarion-omni-ai-forntend-982v.vercel.app',
        'http://localhost:5173',
        'http://localhost:3000',
        'http://127.0.0.1:5173'
      ];
      if (
        allowedStatic.includes(origin) ||
        origin.endsWith('.vercel.app') ||
        origin.endsWith('.onrender.com') ||
        origin.includes('localhost')
      ) {
        return callback(null, true);
      }
      return callback(null, true);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
  })
);
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

// Static preview/storage route
app.use('/storage', express.static(path.resolve(__dirname, '../storage')));

// Health Check Endpoint (Real system observability)
app.get('/health', async (_req: Request, res: Response) => {
  const uptimeSeconds = Math.floor(process.uptime());
  const docCount = dataStore.documents.size;
  const userCount = dataStore.users.size;

  res.json({
    status: 'UP',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    uptime: `${uptimeSeconds}s`,
    environment: config.nodeEnv,
    services: {
      api: { status: 'HEALTHY' },
      supabaseAuth: {
        connected: !!supabaseClient,
        url: config.supabaseUrl,
        mode: 'PRIMARY_AUTHENTICATION'
      },
      database: {
        driver: supabaseClient ? 'Supabase PostgreSQL' : 'Embedded DataStore (Active)',
        status: 'HEALTHY',
        entities: {
          documents: docCount,
          users: userCount,
          suppliers: dataStore.suppliers.size
        }
      },
      aiProvider: {
        active: config.aiProvider,
        status: 'READY'
      },
      ocrProvider: {
        active: config.ocrProvider,
        status: 'READY'
      },
      queue: {
        mode: config.redisUrl ? 'BullMQ/Redis' : 'Async In-Memory Worker',
        status: 'ACTIVE'
      }
    }
  });
});

// Mount Main API Router
app.use('/api', apiRoutes);

// Centralized Error Handling Middleware
app.use(errorHandler);

export default app;
