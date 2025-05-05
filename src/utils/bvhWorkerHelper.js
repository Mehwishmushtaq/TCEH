// main code (e.g. inside a helper or a useEffect)
// ^ This depends on your bundler. Some do `new URL('./bvhWorker.js', import.meta.url)`.
// Or you might do: const worker = new Worker('/path/to/bvhWorker.js') in plain JS.
// main code (e.g. inside a helper or a useEffect)

export async function computeBVHInWorker(
  separatePositions,
  onProgress = () => {}
) {
  return new Promise((resolve, reject) => {
    // Create the worker
    let worker = new Worker(
      new URL('../workers/bvh.worker.js', import.meta.url),
      {
        type: 'module', // if needed
      }
    );

    // Listen for messages from the worker
    worker.onmessage = (evt) => {
      const { success, bvh, error, status, progress } = evt.data;
      if (status === 'progress') {
        // Handle progress updates
        onProgress(progress);
      } else if (success) {
        worker.terminate();
        worker = null; // explicitly clear reference
        resolve(bvh);
      } else {
        worker.terminate();
        worker = null; // explicitly clear reference
        reject(new Error(error));
      }
    };

    worker.onerror = (err) => {
      worker.terminate();
      worker = null; // explicitly clear reference
      reject(err);
    };

    // Send data to the worker
    worker.postMessage({
      type: 'BUILD_BVH',
      positions: separatePositions,
      maxTrianglesPerLeaf: 100,
    });
  });
}
