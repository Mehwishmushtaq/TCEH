"use client"

import { useState, useEffect } from "react"
import { Modal, Input, Radio, Slider, Button, Form } from "antd"

const ImageSettingsModal = ({ visible, onClose, onApply, imageData, defaultElevation = 0 }) => {
  const [form] = Form.useForm()
  const [shadingOption, setShadingOption] = useState("noShading")
  const [transparency, setTransparency] = useState(0)
  const [elevation, setElevation] = useState(defaultElevation)

  useEffect(() => {
    if (visible && imageData) {
      // If image has elevation data from txt file, use it
      if (imageData.elevation !== null && imageData.elevation !== undefined) {
        setElevation(imageData.elevation)
        form.setFieldsValue({ elevation: imageData.elevation })
      } else {
        setElevation(defaultElevation)
        form.setFieldsValue({ elevation: defaultElevation })
      }
    }
  }, [visible, imageData, defaultElevation, form])

  const handleOk = () => {
    form
      .validateFields()
      .then((values) => {
        onApply({
          elevation: Number.parseFloat(values.elevation),
          transparency: transparency / 100,
          shadingOption,
        })
        onClose()
      })
      .catch((info) => {
        console.log("Validate Failed:", info)
      })
  }

  return (
    <Modal
      title="Image Display Settings"
      open={visible}
      onCancel={onClose}
      footer={[
        <Button key="cancel" onClick={onClose}>
          Cancel
        </Button>,
        <Button key="apply" type="primary" onClick={handleOk}>
          OK
        </Button>,
      ]}
    >
      <Form
        form={form}
        layout="vertical"
        initialValues={{
          elevation: elevation,
          shadingOption: shadingOption,
        }}
      >
        <Form.Item
          name="elevation"
          label="Elevation (RL)"
          rules={[{ required: true, message: "Please enter elevation" }]}
        >
          <Input type="number" step="0.1" onChange={(e) => setElevation(Number.parseFloat(e.target.value))} />
        </Form.Item>

        <div style={{ marginBottom: 16 }}>
          <div style={{ marginBottom: 8 }}>
            Transparency: ({transparency}% ={" "}
            {transparency === 0 ? "fully opaque" : transparency === 100 ? "invisible" : "semi-transparent"})
          </div>
          <Slider min={0} max={100} value={transparency} onChange={setTransparency} />
        </div>

        <Form.Item name="shadingOption" label="Shading Options:">
          <Radio.Group onChange={(e) => setShadingOption(e.target.value)}>
            <Radio style={{ display: "block", marginBottom: 8 }} value="noShading">
              No Shading
            </Radio>
            <Radio style={{ display: "block", marginBottom: 8 }} value="bySurfaceColor">
              By Surface Color
            </Radio>
            <Radio style={{ display: "block", marginBottom: 8 }} value="byElevation">
              By Elevation
            </Radio>
            <Radio style={{ display: "block" }} value="byImage">
              By Image
            </Radio>
          </Radio.Group>
        </Form.Item>
      </Form>
    </Modal>
  )
}

export default ImageSettingsModal
