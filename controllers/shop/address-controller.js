// controllers/shop/address-controller.js
import Address from "../../models/Address.js";

export const addAddress = async (req, res) => {
  try {
    const { userId, address, city, pincode, phone, notes } = req.body;
    // Make notes optional - only check for required fields
    if (!userId || !address || !city || !pincode || !phone) {
      return res.status(400).json({ success: false, message: "Invalid data provided!" });
    }
    const newlyCreatedAddress = new Address({ 
      userId, 
      address, 
      city, 
      pincode, 
      phone,
      notes: notes || "" // Set notes to empty string if not provided
    });
    await newlyCreatedAddress.save();
    res.status(201).json({ success: true, data: newlyCreatedAddress });
  } catch (e) {
    res.status(500).json({ success: false, message: "Error" });
  }
};

export const fetchAllAddress = async (req, res) => {
  try {
    const { userId } = req.params;
    if (!userId) return res.status(400).json({ success: false, message: "User id is required!" });
    const addressList = await Address.find({ userId });
    res.status(200).json({ success: true, data: addressList });
  } catch {
    res.status(500).json({ success: false, message: "Error" });
  }
};

export const editAddress = async (req, res) => {
  try {
    const { userId, addressId } = req.params;
    const formData = req.body;
    const address = await Address.findOneAndUpdate(
      { _id: addressId, userId }, 
      formData, 
      { new: true }
    );
    if (!address) return res.status(404).json({ success: false, message: "Address not found" });
    res.status(200).json({ success: true, data: address });
  } catch {
    res.status(500).json({ success: false, message: "Error" });
  }
};

export const deleteAddress = async (req, res) => {
  try {
    const { userId, addressId } = req.params;
    const address = await Address.findOneAndDelete({ _id: addressId, userId });
    if (!address) return res.status(404).json({ success: false, message: "Address not found" });
    res.status(200).json({ success: true, message: "Address deleted successfully" });
  } catch {
    res.status(500).json({ success: false, message: "Error" });
  }
};
