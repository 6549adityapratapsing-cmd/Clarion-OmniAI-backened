import app from './app';
import { config } from './config';

const server = app.listen(config.port, () => {
  console.log(`=======================================================`);
  console.log(`🚀 Clarion OmniAI Backend running on port ${config.port}`);
  console.log(`📡 Environment: ${config.nodeEnv}`);
  console.log(`🔍 Health Check: http://localhost:${config.port}/health`);
  console.log(`🤖 AI Provider: ${config.aiProvider}`);
  console.log(`👁️ OCR Provider: ${config.ocrProvider}`);
  console.log(`=======================================================`);
});

const gracefulShutdown = () => {
  console.log('\nReceived shutdown signal, terminating server gracefully...');
  server.close(() => {
    console.log('HTTP server closed. Exiting process.');
    process.exit(0);
  });
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);
