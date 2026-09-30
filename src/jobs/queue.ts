import { Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config';
import { documentOrchestrator } from '../services/document/documentOrchestrator';

export interface DocumentJobData {
  jobId: string;
  documentId: string;
  stage: string;
  attempts: number;
}

export class JobManager {
  private bullQueue: Queue | null = null;
  private bullWorker: Worker | null = null;
  private inMemoryJobs = new Map<string, { id: string; documentId: string; status: 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED'; error?: string }>();

  constructor() {
    this.initQueue();
  }

  private initQueue() {
    if (config.redisUrl) {
      try {
        const connection = new IORedis(config.redisUrl, { maxRetriesPerRequest: null });
        connection.on('connect', () => {
          console.log('✅ Connected to Redis for BullMQ');
        });
        connection.on('error', (err) => {
          console.warn('⚠️ Redis error, utilizing resilient in-memory async fallback queue:', err.message);
        });

        this.bullQueue = new Queue('document-processing', { connection });
        this.bullWorker = new Worker(
          'document-processing',
          async (job) => {
            const { documentId } = job.data;
            await documentOrchestrator.processDocument(documentId);
          },
          { connection }
        );
      } catch (err: any) {
        console.warn('⚠️ BullMQ init failed, running with in-process worker queue:', err.message);
      }
    } else {
      console.log('ℹ️ Running with embedded in-process background worker queue');
    }
  }

  async addJob(documentId: string, stage: string = 'ALL'): Promise<string> {
    const jobId = uuidv4();

    if (this.bullQueue) {
      try {
        await this.bullQueue.add(
          'process-doc',
          { jobId, documentId, stage, attempts: 1 },
          { attempts: 3, backoff: { type: 'exponential', delay: 1000 } }
        );
        return jobId;
      } catch (err) {
        console.warn('BullMQ enqueue failed, executing in async queue:', err);
      }
    }

    // In-Memory Asynchronous Worker execution
    this.inMemoryJobs.set(jobId, { id: jobId, documentId, status: 'QUEUED' });

    setImmediate(async () => {
      const job = this.inMemoryJobs.get(jobId);
      if (job) job.status = 'RUNNING';

      try {
        await documentOrchestrator.processDocument(documentId);
        if (job) job.status = 'COMPLETED';
      } catch (err: any) {
        if (job) {
          job.status = 'FAILED';
          job.error = err.message;
        }
      }
    });

    return jobId;
  }

  getJob(jobId: string) {
    return this.inMemoryJobs.get(jobId);
  }
}

export const jobManager = new JobManager();
