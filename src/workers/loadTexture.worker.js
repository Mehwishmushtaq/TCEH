/* eslint-disable no-restricted-globals */

// PHASE 2.02a, 2.02b, 2.02c: Worker for loading and processing textures
self.onmessage = (e) => {
  const { base64 } = e.data

  try {
    // Report initial progress
    self.postMessage({ type: "progress", percent: 0 })

    // Remove data URL prefix if present
    const base64Content = base64.includes("base64,") ? base64.split("base64,")[1] : base64

    // Convert base64 to binary
    const binaryString = atob(base64Content)
    const bytes = new Uint8Array(binaryString.length)

    // Report progress during conversion
    const totalBytes = binaryString.length
    const chunkSize = 10000

    for (let i = 0; i < totalBytes; i++) {
      bytes[i] = binaryString.charCodeAt(i)

      // Report progress periodically
      if (i % chunkSize === 0) {
        const progress = Math.round((i / totalBytes) * 100)
        self.postMessage({ type: "progress", percent: progress })
      }
    }

    // Create blob
    const blob = new Blob([bytes], { type: "image/jpeg" })

    // Report completion
    self.postMessage({ type: "progress", percent: 100 })

    // Return the blob
    self.postMessage({ type: "result", blob })
  } catch (error) {
    self.postMessage({ type: "error", error: error.message })
  }
}
