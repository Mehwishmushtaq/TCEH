"use client"

import { useState, useEffect } from "react"
import { Modal, Radio, Slider, Flex, InputNumber } from "antd"
import { filesContainingImages } from "../constants/refStore"
import { replaceFileExtFunc } from "../utils/parsingAndBuildingGeometries"

// We'll define shading modes:
const SHADING_MODES = {
  NO_SHADING: "NoShading",
  BY_SURFACE_COLOR: "BySurfaceColor",
  BY_ELEVATION: "ByElevation",
  BY_IMAGE: "ByImage",
}

const SurfacePropertiesModal = ({
  visible,
  onClose,
  surfaceData, // the entire "surf" object
  onSaveChanges, // callback to apply changes
  loadingImage,
  zipFileData,
  imageOverLayingProgress,
  imageProgress,
  surfaceLibrary,
  bvhCalculationLoading,
  genericProgressBar,
}) => {
  const findSurface = surfaceLibrary.find((surf) => surf.id === surfaceData)
  // const findZipFileData = zipFileData?.find(
  //   (zi) => zi.xmlFileName.split('.').shift() === findSurface?.surfaceName
  // );
  const findZipFileData =
    filesContainingImages?.current?.includes(replaceFileExtFunc(findSurface?.surfaceName)) ||
    filesContainingImages?.current?.includes(replaceFileExtFunc(findSurface?.mainZipFileName))
  const [shadingMode, setShadingMode] = useState(SHADING_MODES.NO_SHADING)
  const [transparency, setTransparency] = useState(0) // 0 means opaque

  // PHASE 2.02c: Add state for custom elevation input
  const [customElevation, setCustomElevation] = useState(0)
  const [showElevationInput, setShowElevationInput] = useState(false)

  // Optionally store a color if you want a "By Surface Color"
  const [surfaceColor, setSurfaceColor] = useState("#ff0000")

  useEffect(() => {
    if (findSurface) {
      // If the surface object has a saved mode or color, load them
      setShadingMode(findSurface.shadingMode || SHADING_MODES.NO_SHADING)
      setSurfaceColor(findSurface.color || "#ff0000")
      setTransparency(findSurface.transparency || 0)
    }
  }, [findSurface])

  const handleOk = () => {
    // Pass changes up
    onSaveChanges({
      shadingMode,
      color: surfaceColor,
      transparency,
      // PHASE 2.02c: Include custom elevation in saved changes
      customElevation: showElevationInput ? customElevation : undefined,
    })
    // onClose();
  }

  return (
    <Modal
      title={`Surface Properties: ${findSurface?.surfaceName || ""}`}
      open={visible}
      onOk={handleOk}
      onCancel={onClose}
      destroyOnClose
      okButtonProps={{ disabled: loadingImage }}
      cancelButtonProps={{ disabled: loadingImage }}
    >
      <div className="mb-4">
        <strong>Surface Classification: </strong>
        {findSurface?.classification || "Unclassified"}
      </div>
      <div className="mb-4">
        <strong>Transparency:</strong> (0% = fully opaque, 100% = invisible)
        <Slider
          min={0}
          max={100}
          value={transparency}
          onChange={(val) => setTransparency(val)}
          disabled={loadingImage}
        />
      </div>
      <div className="mb-4">
        <strong>Shading Options:</strong>
        <Radio.Group
          disabled={loadingImage}
          className="flex flex-col gap-2"
          value={shadingMode}
          onChange={(e) => setShadingMode(e.target.value)}
        >
          <Radio value={SHADING_MODES.NO_SHADING}>No Shading</Radio>
          <Radio value={SHADING_MODES.BY_SURFACE_COLOR}>By Surface Color</Radio>
          <Radio value={SHADING_MODES.BY_ELEVATION}>By Elevation</Radio>
          {findSurface?.uvArrayData && findSurface?.blobData && (
            <Radio disabled={bvhCalculationLoading} value={SHADING_MODES.BY_IMAGE}>
              By Image{" "}
            </Radio>
          )}
        </Radio.Group>
        {findZipFileData && genericProgressBar > 0 && genericProgressBar < 100 && (
          <Flex justify="center" align="center" vertical>
            <div className="p-2">
              <p>Image Data Loading... {genericProgressBar}%</p>
              {/* Or a real progress bar */}
              <progress value={genericProgressBar} max="100">
                {genericProgressBar}%
              </progress>
            </div>
          </Flex>
        )}
        {imageOverLayingProgress > 0 && imageOverLayingProgress < 100 && (
          <Flex justify="center" align="center" vertical>
            <div className="p-2">
              <p>Applying Image... {imageOverLayingProgress}%</p>
              {/* Or a real progress bar */}
              <progress value={imageOverLayingProgress} max="100">
                {imageOverLayingProgress}%
              </progress>
            </div>
          </Flex>
        )}
        {imageProgress > 0 && imageProgress < 100 && (
          <Flex justify="center" align="center" vertical>
            <div className="p-2">
              <p>Image Loading... {imageProgress}%</p>
              {/* Or a real progress bar */}
              <progress value={imageProgress} max="100">
                {imageProgress}%
              </progress>
            </div>
          </Flex>
        )}
      </div>
      {shadingMode === SHADING_MODES.BY_SURFACE_COLOR && (
        <div className="mb-4">
          <strong>Surface Color:</strong>
          <input type="color" value={surfaceColor} onChange={(e) => setSurfaceColor(e.target.value)} className="ml-2" />
        </div>
      )}

      {/* PHASE 2.02c: Add custom elevation input section */}
      <div className="mb-4">
        <Flex align="center" justify="space-between">
          <strong>Custom Elevation:</strong>
          <button
            className="text-blue-500 hover:text-blue-700"
            onClick={() => setShowElevationInput(!showElevationInput)}
          >
            {showElevationInput ? "Hide" : "Show"}
          </button>
        </Flex>

        {showElevationInput && (
          <div className="mt-2">
            <InputNumber
              min={-10000}
              max={10000}
              step={0.1}
              value={customElevation}
              onChange={(value) => setCustomElevation(value)}
              style={{ width: "100%" }}
              addonAfter="meters"
              disabled={loadingImage}
            />
            <div className="text-xs text-gray-500 mt-1">
              Enter the elevation value for image overlay when no elevation data is available
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}

export { SurfacePropertiesModal }
