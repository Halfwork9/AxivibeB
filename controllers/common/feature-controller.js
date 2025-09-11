import Feature from "../../models/Feature.js";

export const addFeatureImage = async (req, res) => {
  try {
    const { image } = req.body;
    const featureImages = new Feature({ image });
    await featureImages.save();
    res.status(201).json({ success: true, data: featureImages });
  } catch (e) {
    console.log(e);
    res.status(500).json({ success: false, message: "Some error occured!" });
  }
};

export const getFeatureImages = async (req, res) => {
  try {
    const images = await Feature.find({});
    res.status(200).json({ success: true, data: images });
  } catch (e) {
    console.log(e);
    res.status(500).json({ success: false, message: "Some error occured!" });
  }
};

// New function to handle image deletion
export const deleteFeatureImage = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await Feature.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: "Not found" });
    }
    res.json({ success: true, message: "Feature image deleted" });
  } catch (e) {
    res.status(500).json({ success: false, message: "Error" });
  }
};