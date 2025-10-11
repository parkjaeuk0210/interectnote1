import { ref, update } from 'firebase/database';
import { database } from './firebase';
import { firebaseMetrics } from '../utils/firebaseMetrics';

const DEBUG = import.meta.env.DEV;

interface BatchUpdate {
  [path: string]: any;
}

class RealtimeDatabaseBatchManager {
  private updates: BatchUpdate = {};
  private deletePaths: string[] = [];
  private batchTimer: NodeJS.Timeout | null = null;
  private readonly BATCH_DELAY = 100; // Reduced to 100ms for better responsiveness
  private isInitialLoad = true;

  // Add update operation
  addUpdate(path: string, value: any) {
    this.updates[path] = value;
    this.scheduleBatch();
  }

  // Add delete operation (set to null in multi-path update)
  addDelete(path: string) {
    if (DEBUG) {
      console.log('[BatchManager] addDelete called for path:', path);
    }
    this.updates[path] = null;
    this.deletePaths.push(path);
    if (DEBUG) {
      console.log('[BatchManager] Current updates:', Object.keys(this.updates));
    }
    this.scheduleBatch();
  }

  // Schedule batch execution
  private scheduleBatch() {
    // Execute immediately during initial load for better performance
    if (this.isInitialLoad) {
      this.executeBatch();
      this.isInitialLoad = false;
      return;
    }
    
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
    }
    
    this.batchTimer = setTimeout(() => {
      this.executeBatch();
    }, this.BATCH_DELAY);
  }

  // Execute all pending operations
  private async executeBatch() {
    const updateCount = Object.keys(this.updates).length;

    if (updateCount === 0) {
      if (DEBUG) {
        console.log('[BatchManager] No updates to execute');
      }
      return;
    }

    const currentUpdates = { ...this.updates };
    const currentDeletes = [...this.deletePaths];
    this.updates = {};
    this.deletePaths = [];

    if (DEBUG) {
      console.log(`🔄 [BatchManager] Executing batch with ${updateCount} operations`);
      console.log('[BatchManager] Updates to execute:', currentUpdates);
      console.log('[BatchManager] Delete paths:', currentDeletes);
    }

    try {
      // Realtime Database multi-path update
      const rootRef = ref(database);
      if (DEBUG) {
        console.log('[BatchManager] Calling Firebase update...');
      }
      await update(rootRef, currentUpdates);

      // Track metrics
      const writeCount = updateCount - currentDeletes.length;
      const deleteCount = currentDeletes.length;

      for (let i = 0; i < writeCount; i++) {
        firebaseMetrics.incrementWrite();
      }
      for (let i = 0; i < deleteCount; i++) {
        firebaseMetrics.incrementDelete();
      }

      if (DEBUG) {
        console.log(`✅ Batch committed: ${writeCount} writes, ${deleteCount} deletes`);
      }
    } catch (error) {
      console.error('Batch commit failed:', error);
      // Restore failed operations for retry
      Object.assign(this.updates, currentUpdates);
      this.deletePaths.push(...currentDeletes);
      throw error;
    }
    
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }
  }

  // Force immediate execution
  async flush() {
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }
    await this.executeBatch();
  }

  // Get pending operations count
  getPendingCount() {
    return Object.keys(this.updates).length;
  }
}

export const realtimeBatchManager = new RealtimeDatabaseBatchManager();

// Flush on page unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    realtimeBatchManager.flush();
  });
}