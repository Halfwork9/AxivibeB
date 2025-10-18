import mongoose from "mongoose";

const UserSchema = new mongoose.Schema({
  userName: {
    type: String,
    required: true,
    unique: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
  },
  password: {
    type: String,
    required: true,
  },
  role: {
    type: String,
    default: "user",
  },
   googleId: { type: String },
    avatar: { type: String },
    // ✅ NEW: Fields for password reset
    resetPasswordToken: { type: String },
    resetPasswordExpires: { type: Date },
  
},  { timestamps: true }
                                      );

const User = mongoose.model("User", UserSchema);

export default User;
