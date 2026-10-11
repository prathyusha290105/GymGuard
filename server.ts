import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import { membershipService } from './src/services/membership/membershipService';
import { formatDateISO } from './src/utils/dateUtils';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const isProd = process.env.NODE_ENV === 'production';

app.use(express.json());

// Track background job metrics
let lastExpiryJobResult: {
  timestamp: string;
  gymId: string;
  result: any;
  status: 'SUCCESS' | 'ERROR';
  error?: string;
} | null = null;

// Trigger server-side membership expiry automation job
async function executeServerSideExpiryJob(gymId: string = 'gym-01') {
  console.log(`[ServerJob] Running server-side membership expiry automation for gym: ${gymId}`);
  const todayStr = formatDateISO();
  try {
    const res = await membershipService.runExpiryAutomationJob(gymId, todayStr);
    lastExpiryJobResult = {
      timestamp: new Date().toISOString(),
      gymId,
      result: res,
      status: 'SUCCESS',
    };
    console.log(`[ServerJob] Completed expiry automation:`, res);
    return lastExpiryJobResult;
  } catch (err: any) {
    console.error(`[ServerJob] Expiry automation error:`, err);
    lastExpiryJobResult = {
      timestamp: new Date().toISOString(),
      gymId,
      result: null,
      status: 'ERROR',
      error: err?.message || String(err),
    };
    return lastExpiryJobResult;
  }
}

// Health check endpoint
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'HEALTHY',
    service: 'GymGuard Server-Side Core',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.round(process.uptime()),
    lastJob: lastExpiryJobResult,
  });
});

// Manual/Webhook trigger endpoint for expiry job
app.post('/api/jobs/membership-expiry', async (req: Request, res: Response) => {
  const gymId = req.body?.gymId || 'gym-01';
  try {
    const result = await executeServerSideExpiryJob(gymId);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to execute job' });
  }
});

// Get job execution status
app.get('/api/jobs/status', (_req: Request, res: Response) => {
  res.json({
    scheduledProcessingActive: true,
    intervalMs: 3600000, // 1 hour
    lastResult: lastExpiryJobResult,
  });
});

async function startServer() {
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[GymGuard Core] Server running on http://0.0.0.0:${PORT}`);

    // Initial run 10 seconds after startup
    setTimeout(() => {
      executeServerSideExpiryJob('gym-01').catch(console.error);
    }, 10000);

    // Scheduled background processing runs every 1 hour completely server-side
    setInterval(() => {
      executeServerSideExpiryJob('gym-01').catch(console.error);
    }, 60 * 60 * 1000);
  });
}

startServer().catch(err => {
  console.error('[GymGuard Core] Fatal server startup error:', err);
  process.exit(1);
});
