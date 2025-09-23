/**
 * Marketplace-focused server with essential API routes
 */
import express from 'express';

import { catalogRouter } from './routes/catalog';
import { dataRouter } from './routes/data';
import { healthRouter } from './routes/health';
import { payRouter } from './routes/pay';
import { priceRouter } from './routes/price';
import { producersRouter } from './routes/producers';
import { readyRouter } from './routes/ready';

const app = express();
const PORT = process.env.PORT || 8788;

// Basic CORS configuration
app.use((req, res, next) => {
  const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [
    'http://localhost:3000',
    'http://localhost:5173',
  ];
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

// Global middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve static files from UI build directory
app.use(express.static('./ui/build'));

// Health and readiness checks
app.use(healthRouter());
app.use(readyRouter());

// Core marketplace routes
app.use('/v1', catalogRouter());
app.use('/v1', dataRouter());
app.use('/v1', priceRouter());
app.use('/v1', payRouter());
app.use('/v1', producersRouter());

// Simple manifests endpoint for compatibility
app.get('/v1/manifests', async (req, res) => {
  try {
    // Forward to catalog search
    const searchReq = { ...req, url: '/search', originalUrl: '/v1/manifests' };
    searchReq.query = { ...req.query };

    // Use catalog router's search functionality
    const catalogResponse = await new Promise((resolve, reject) => {
      const mockRes = {
        status: (code: number) => ({
          json: (data: any) => resolve({ status: code, data }),
        }),
        json: (data: any) => resolve({ status: 200, data }),
      };

      // This is a simplified approach - in practice, we'd need to properly integrate with the catalog router
      res.json({
        success: true,
        data: [],
        message: 'Use /v1/search endpoint for manifest queries',
      });
    });
  } catch (error) {
    console.error('Manifests endpoint error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Server error:', err);

  if (err.type === 'entity.too.large') {
    return res.status(413).json({
      success: false,
      error: 'Request entity too large',
      message: 'The request payload exceeds the maximum allowed size',
    });
  }

  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'An unexpected error occurred',
  });
});

// Catch-all handler - serve index.html for SPA routes
app.get('*', (req: express.Request, res: express.Response) => {
  // If it's an API route that doesn't exist, return 404 JSON
  if (req.path.startsWith('/api') || req.path.startsWith('/v1')) {
    return res.status(404).json({
      success: false,
      error: 'Not found',
      message: `Route ${req.method} ${req.originalUrl} not found`,
    });
  }

  // For all other routes, serve the SPA
  res.sendFile('./ui/build/index.html', { root: '.' });
});

// Graceful shutdown handling
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  process.exit(0);
});

// Start server
const server = app.listen(PORT, () => {
  console.log(`🚀 Gitdata marketplace server running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`📋 Marketplace: http://localhost:${PORT}/v1/search`);
  console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
});

export { app, server };
