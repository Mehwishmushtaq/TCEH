"use client"

import { useState, useEffect } from "react"
import { Modal, Button, Input, Select, Typography, Divider, Form, Radio, Card } from "antd"
import { isMultiShapeCompleted, multiPointsRef } from "../constants/refStore"

const { Title, Text } = Typography
const { Option } = Select

export const SurfaceReportModal = ({
  visible,
  onClose,
  reportType,
  surfaceLibrary,
  selectedSurface,
  setSelectedSurface,
  selectedSecondSurface,
  setSelectedSecondSurface,
  customName,
  setCustomName,
  selectedElevation,
  setSelectedElevation,
  calculateVolume,
}) => {
  const [reportMode, setReportMode] = useState("stockpile") // stockpile or depression
  const [polygonDrawn, setPolygonDrawn] = useState(false)
  const [calculationComplete, setCalculationComplete] = useState(false)
  const [volumeResults, setVolumeResults] = useState(null)
  const [polygonPoints, setPolygonPoints] = useState([])
  const [polygonElevationError, setPolygonElevationError] = useState(false)

  useEffect(() => {
    // Reset state when modal opens
    setPolygonDrawn(false)
    setCalculationComplete(false)
    setVolumeResults(null)
    setPolygonPoints([])
    setPolygonElevationError(false)

    // Set default report mode based on report type
    if (reportType === "stockpile") {
      setReportMode("stockpile")
    }
  }, [visible, reportType])

  useEffect(() => {
    // Check if polygon is drawn (using the multiPointsRef from the main app)
    if (isMultiShapeCompleted.current && multiPointsRef.current.length > 2) {
      setPolygonDrawn(true)
      setPolygonPoints(multiPointsRef.current)

      // Check for elevation error (max-min > 0.5m)
      const elevations = multiPointsRef.current.map((point) => point.z)
      const maxElevation = Math.max(...elevations)
      const minElevation = Math.min(...elevations)
      setPolygonElevationError(maxElevation - minElevation > 0.5)
    } else {
      setPolygonDrawn(false)
    }
  }, [multiPointsRef.current])

  const handleCalculate = () => {
    // Perform volume calculation based on report type
    let results = null

    if (reportType === "stockpile") {
      // Calculate stockpile/depression volume
      results = calculateVolume(selectedSurface, null, polygonPoints)
    } else if (reportType === "elevation") {
      // Calculate surface to elevation volume
      results = calculateVolume(selectedSurface, { elevation: selectedElevation }, polygonPoints)
    } else if (reportType === "surface") {
      // Calculate surface to surface volume
      results = calculateVolume(selectedSurface, selectedSecondSurface, polygonPoints)
    }

    setVolumeResults(results)
    setCalculationComplete(true)
  }

  const handleSaveReport = () => {
    // In a real implementation, this would save the report to a file
    // For now, just close the modal
    onClose()
  }

  const renderReportForm = () => {
    switch (reportType) {
      case "stockpile":
        return (
          <Form layout="vertical">
            <Form.Item label="Calculation Type">
              <Radio.Group value={reportMode} onChange={(e) => setReportMode(e.target.value)}>
                <Radio value="stockpile">Stockpile</Radio>
                <Radio value="depression">Depression</Radio>
              </Radio.Group>
            </Form.Item>
            <Form.Item label="Custom Name">
              <Input
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder="Enter a name for this calculation"
              />
            </Form.Item>
            <Form.Item label="Select Surface">
              <Select
                value={selectedSurface}
                onChange={(value) => setSelectedSurface(value)}
                placeholder="Select a surface"
              >
                {surfaceLibrary.map((surface) => (
                  <Option key={surface.id} value={surface.id}>
                    {surface.surfaceName || surface.id}
                  </Option>
                ))}
              </Select>
            </Form.Item>
            <Form.Item>
              <Text>
                {polygonDrawn
                  ? "Polygon has been drawn. Ready to calculate."
                  : "Please draw a polygon around the stockpile/depression area."}
              </Text>
              {polygonElevationError && (
                <Text type="danger">
                  The polygon drawn around the perimeter of the {reportMode} indicates a potential base/top elevation
                  error. We recommend conducting a detailed analysis of the {reportMode} base.
                </Text>
              )}
            </Form.Item>
          </Form>
        )

      case "elevation":
        return (
          <Form layout="vertical">
            <Form.Item label="Custom Name">
              <Input
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder="Enter a name for this calculation"
              />
            </Form.Item>
            <Form.Item label="Select Surface">
              <Select
                value={selectedSurface}
                onChange={(value) => setSelectedSurface(value)}
                placeholder="Select a surface"
              >
                {surfaceLibrary.map((surface) => (
                  <Option key={surface.id} value={surface.id}>
                    {surface.surfaceName || surface.id}
                  </Option>
                ))}
              </Select>
            </Form.Item>
            <Form.Item label="Elevation (RL)">
              <Input
                type="number"
                value={selectedElevation}
                onChange={(e) => setSelectedElevation(Number.parseFloat(e.target.value))}
                placeholder="Enter elevation value"
              />
            </Form.Item>
            <Form.Item>
              <Text>
                {polygonDrawn
                  ? "Polygon has been drawn. Ready to calculate."
                  : "Please draw a polygon to define the calculation area."}
              </Text>
            </Form.Item>
          </Form>
        )

      case "surface":
        return (
          <Form layout="vertical">
            <Form.Item label="Custom Name">
              <Input
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder="Enter a name for this calculation"
              />
            </Form.Item>
            <Form.Item label="Initial Surface">
              <Select
                value={selectedSurface}
                onChange={(value) => setSelectedSurface(value)}
                placeholder="Select initial surface"
              >
                {surfaceLibrary.map((surface) => (
                  <Option key={surface.id} value={surface.id}>
                    {surface.surfaceName || surface.id}
                  </Option>
                ))}
              </Select>
            </Form.Item>
            <Form.Item label="Final Surface">
              <Select
                value={selectedSecondSurface}
                onChange={(value) => setSelectedSecondSurface(value)}
                placeholder="Select final surface"
              >
                {surfaceLibrary.map((surface) => (
                  <Option key={surface.id} value={surface.id}>
                    {surface.surfaceName || surface.id}
                  </Option>
                ))}
              </Select>
            </Form.Item>
            <Form.Item>
              <Text>
                {polygonDrawn
                  ? "Polygon has been drawn. Calculation will be limited to this area."
                  : "You can optionally draw a polygon to limit the calculation area."}
              </Text>
            </Form.Item>
          </Form>
        )

      default:
        return <Text>Please select a report type</Text>
    }
  }

  const renderResults = () => {
    if (!calculationComplete || !volumeResults) return null

    const { cut, fill, excess } = volumeResults

    return (
      <Card className="mt-4">
        <Title level={4}>Calculation Results</Title>
        <Divider />

        <Text strong>Name of calculation: </Text>
        <Text>
          {reportType === "stockpile"
            ? reportMode === "stockpile"
              ? "Stockpile"
              : "Depression"
            : reportType === "elevation"
              ? "Surface to Elevation (in polygon)"
              : "Surface to Surface"}
        </Text>
        <br />

        <Text strong>Custom Name: </Text>
        <Text>{customName || "N/A"}</Text>
        <br />

        <Text strong>Selected Surface: </Text>
        <Text>{surfaceLibrary.find((s) => s.id === selectedSurface)?.surfaceName || selectedSurface}</Text>
        <br />

        {reportType === "elevation" && (
          <>
            <Text strong>Selected RL: </Text>
            <Text>{selectedElevation}</Text>
            <br />
          </>
        )}

        {reportType === "surface" && (
          <>
            <Text strong>Second Surface: </Text>
            <Text>
              {surfaceLibrary.find((s) => s.id === selectedSecondSurface)?.surfaceName || selectedSecondSurface}
            </Text>
            <br />
          </>
        )}

        <Divider />

        <Text>Cut = {cut} m³</Text>
        <br />
        <Text>Fill = {fill} m³</Text>
        <br />
        <Text>--------------</Text>
        <br />
        <Text strong>
          {excess >= 0 ? "Excess" : "Shortage"} = {Math.abs(excess)} m³
        </Text>

        <Divider />

        {excess >= 0 ? (
          <Text type="secondary">
            The earthworks design results in a material surplus scenario, where the volume of excavated (cut) material
            exceeds the total fill requirements. This surplus material will require appropriate stockpiling, disposal,
            or reuse planning, in accordance with environmental and project specifications. Efficient surplus management
            is essential to minimize double handling, transport costs, and potential environmental impact.
          </Text>
        ) : (
          <Text type="secondary">
            The site presents a net import scenario, where the volume of available cut is insufficient to meet the fill
            requirements. As a result, additional material will need to be imported to achieve design levels. This may
            impact construction cost, logistics, and scheduling.
          </Text>
        )}

        {reportType === "stockpile" && reportMode === "stockpile" && (
          <Text type="secondary" className="mt-2">
            Note: Stockpile volume is calculated based on the surface and a base surface derived from the perimeter
            polygon. The accuracy of the volume estimate depends on how closely the polygon outline and elevation data
            represent the actual surface beneath the stockpile.
          </Text>
        )}
      </Card>
    )
  }

  return (
    <Modal
      title={<Title level={3}>Surface Report</Title>}
      open={visible}
      onCancel={onClose}
      width={800}
      footer={[
        <Button key="close" onClick={onClose}>
          Close
        </Button>,
        <Button key="calculate" type="primary" disabled={!polygonDrawn || !selectedSurface} onClick={handleCalculate}>
          Calculate
        </Button>,
        <Button key="save" type="primary" disabled={!calculationComplete} onClick={handleSaveReport}>
          Save Report
        </Button>,
      ]}
    >
      {renderReportForm()}
      {renderResults()}
    </Modal>
  )
}
