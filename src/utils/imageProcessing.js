import * as THREE from "three"
import { computeUVsForDrapePixelCenter } from "./parsingAndBuildingGeometries"

/**
 * Processes a .psli file (zip containing jpg, jgw, and optional txt)
 * @param {Object} fileData - The extracted file data from the zip
 * @param {Blob} fileData.jpgFile - The JPG image file
 * @param {Object} fileData.jgwValues - The JGW georeferencing values
 * @param {Object} fileData.txtContent - Optional TXT file with elevation data
 * @returns {Promise<Object>} - Processed image data ready for display
 */
export const processPSLIFile = async (fileData) => {
  try {
    // Extract the image data
    const { jpgFile, jgwValues, txtContent } = fileData
    
    // Create image texture from JPG
    const imageBitmap = await createImageBitmap(jpgFile.blob || jpgFile)
    const texture = new THREE.Texture(imageBitmap)
    texture.needsUpdate = true
    
    // Parse JGW values
    let jgwData
    if (typeof jgwValues.data === "string") {
      const lines = jgwValues.data.split("\n").map(line => parseFloat(line.trim()))
      jgwData = {
        pixelWidth: lines[0],
        rotationX: lines[1],
        rotationY: lines[2],
        pixelHeight: lines[3],
        topLeftX: lines[4],
        topLeftY: lines[5]
      }
    } else {
      jgwData = jgwValues
    }
    
    // Parse elevation from txt file if available
    let elevation = null
    if (txtContent && txtContent.data) {
      const txtData = txtContent.data.toString().trim()
      // Try to extract elevation - it might be the last line or the only content
      const lines = txtData.split("\n").map(line => line.trim())
      if (lines.length > 6) {
        // If the txt file has the same format as JGW plus elevation
        elevation = parseFloat(lines[6])
      } else if (lines.length === 1 && !isNaN(parseFloat(lines[0]))) {
        // If the txt file only contains the elevation
        elevation = parseFloat(lines[0])
      }
    }
    
    return {
      texture,
      jgwData,
      elevation,
      imageWidth: imageBitmap.width,
      imageHeight: imageBitmap.height
    }
  } catch (error) {
    console.error("Error processing PSLI file:", error)
    throw error
  }
}

/**
 * Creates a textured plane mesh for displaying an image at specified coordinates and elevation
 * @param {Object} imageData - Processed image data
 * @param {THREE.Texture} imageData.texture - The image texture
 * @param {Object} imageData.jgwData - JGW georeferencing values
 * @param {number} imageData.imageWidth - Image width in pixels
 * @param {number} imageData.imageHeight - Image height in pixels
 * @param {number} elevation - Elevation at which to display the image
 * @returns {THREE.Mesh} - Mesh with the image as a texture
 */
export const createImagePlane = (imageData, elevation) => {
  const { texture, jgwData, imageWidth, imageHeight } = imageData
  
  // Calculate real-world dimensions based on JGW data
  const realWidth = Math.abs(jgwData.pixelWidth * imageWidth)
  const realHeight = Math.abs(jgwData.pixelHeight * imageHeight)
  
  // Create plane geometry
  const geometry = new THREE.PlaneGeometry(realWidth, realHeight)
  
  // Create material with the image texture
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    side: THREE.DoubleSide
  })
  
  // Create mesh
  const mesh = new THREE.Mesh(geometry, material)
  
  // Position the mesh at the correct coordinates and elevation
  // JGW coordinates refer to the top-left corner, but THREE.js uses center coordinates
  const centerX = jgwData.topLeftX + realWidth / 2
  const centerY = jgwData.topLeftY - realHeight / 2
  mesh.position.set(centerX, centerY, elevation || 0)
  
  // Rotate the mesh to be horizontal (facing up)
  mesh.rotation.x = -Math.PI / 2
  
  return mesh
}

/**
 * Drapes an image over a surface mesh
 * @param {THREE.Mesh} surfaceMesh - The surface mesh to drape the image over
 * @param {Object} imageData - Processed image data
 * @returns {THREE.Mesh} - Updated mesh with the image as a texture
 */
export const drapeImageOverSurface = (surfaceMesh, imageData) => {
  const { texture, jgwData } = imageData
  
  // Clone the surface geometry to avoid modifying the original
  const geometry = surfaceMesh.geometry.clone()
  
  // Compute UV coordinates based on JGW values
  const uvs = computeUVsForDrapePixelCenter(geometry, texture, jgwData)
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2))
  
  // Create a new material with the image texture
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    side: THREE.DoubleSide
  })
  
  // Create a new mesh with the geometry and material
  const drapedMesh = new THREE.Mesh(geometry, material)
  drapedMesh.position.copy(surfaceMesh.position)
  drapedMesh.rotation.copy(surfaceMesh.rotation)
  drapedMesh.scale.copy(surfaceMesh.scale)
  
  return drapedMesh
}
