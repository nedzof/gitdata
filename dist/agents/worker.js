"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.startJobsWorker = startJobsWorker;
// Basic worker for testing
function startJobsWorker() {
    const worker = {
        start: () => { },
        stop: () => { },
        isRunning: () => false,
    };
    // Start the worker
    worker.start();
    // Return cleanup function that calls stop
    return () => worker.stop();
}
//# sourceMappingURL=worker.js.map