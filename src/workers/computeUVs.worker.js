/* eslint-disable no-restricted-globals */

// PHASE 2.02b, 2.02c: Worker for computing UVs for image overlay
self.onmessage = (e) => {
  const { positions, textureWidth, textureHeight, jgwValues } = e.data

  // Extract JGW values
  const { pixelWidth, pixelHeight, topLeftX, topLeftY, rotationX, rotationY } = jgwValues

  // Create UV array
  const vertexCount = positions.length / 3
  const uvArray = new Float32Array(vertexCount * 2)

  // Report initial progress
  self.postMessage({ type: "progress", percent: 0 })

  // Process vertices in batches to report progress
  const batchSize = 1000
  const totalBatches = Math.ceil(vertexCount / batchSize)

  for (let batch = 0; batch < totalBatches; batch++) {
    const start = batch * batchSize
    const end = Math.min(start + batchSize, vertexCount)

    for (let i = start; i < end; i++) {
      const x = positions[i * 3]
      const y = positions[i * 3 + 1]

      // Convert world coordinates to pixel coordinates
      let pixelX, pixelY

      if (rotationX !== 0 || rotationY !== 0) {
        // Handle rotation if present
        const dx = x - topLeftX
        const dy = y - topLeftY

        // Apply inverse rotation and scaling
        pixelX = (dx - (rotationY * dy) / pixelHeight) / (pixelWidth - (rotationX * rotationY) / pixelHeight)
        pixelY = (dy - (rotationX * dx) / pixelWidth) / (pixelHeight - (rotationX * rotationY) / pixelWidth)
      } else {
        // Simple case without rotation
        pixelX = (x - topLeftX) / pixelWidth
        pixelY = (topLeftY - y) / Math.abs(pixelHeight)
      }

      // Convert to UV coordinates (0-1 range)
      uvArray[i * 2] = pixelX / textureWidth
      uvArray[i * 2 + 1] = pixelY / textureHeight
    }

    // Report progress
    const progress = Math.round(((batch + 1) / totalBatches) * 100)
    self.postMessage({ type: "progress", percent: progress })
  }

  // Return the computed UV array
  self.postMessage({ type: "result", uvArray: uvArray })
}
