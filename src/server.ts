import { app } from './app.js';
import { config } from './config.js';
import { prisma } from './db.js';

const server = app.listen(config.port, () => {
  console.log(`Server is running on port ${config.port}`);
});

let isShuttingDown = false;

server.on('error', (error: NodeJS.ErrnoException) => {
  const details = error.code ? `${error.code}: ${error.message}` : error.message;

  console.error(`Failed to start server: ${details}`);

  void prisma.$disconnect().finally(() => {
    process.exit(1);
  });
});

async function shutdown(signal: NodeJS.Signals): Promise<void> {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;

  console.log(`Received ${signal}. Shutting down...`);

  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
}

process.on('SIGINT', (signal) => {
  void shutdown(signal);
});

process.on('SIGTERM', (signal) => {
  void shutdown(signal);
});
