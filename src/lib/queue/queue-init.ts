/**
 * Queue System Initialization
 * Handles proper initialization of all queue components
 */

import { queueMonitor } from './queue-monitor';
import { startWorkers } from './workers';

let initialized = false;

/**
 * Initialize the complete queue system
 */
export async function initializeQueueSystem(): Promise<void> {
  if (initialized) {
    return;
  }

  try {
    console.log('Initializing queue system...');
    
    // Start workers
    startWorkers();
    
    // Initialize monitoring (with a small delay to ensure queues are ready)
    setTimeout(() => {
      queueMonitor.initialize();
    }, 1000);
    
    initialized = true;
    console.log('Queue system initialized successfully');
  } catch (error) {
    console.error('Failed to initialize queue system:', error);
    throw error;
  }
}

/**
 * Check if queue system is initialized
 */
export function isQueueSystemInitialized(): boolean {
  return initialized;
}