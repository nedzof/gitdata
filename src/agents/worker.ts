// Basic worker for testing
export function startJobsWorker() {
  const worker = {
    start: () => {},
    stop: () => {},
    isRunning: () => false
  };

  // Start the worker
  worker.start();

  // Return cleanup function that calls stop
  return () => worker.stop();
}