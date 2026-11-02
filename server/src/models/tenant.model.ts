import mongoose, { Document, Schema } from "mongoose";

export interface ITenantSettings {
  opdStartTime: string; // e.g. "09:00"
  opdEndTime: string;   // e.g. "17:00"
  slotDurationMinutes: number;
  consultationFeeDefault: number;
  branding?: {
    logoUrl?: string;
    primaryColor?: string; // Hex color (e.g. #0284c7)
  };
}

export interface ITenant extends Document {
  name: string;
  slug: string; // Unique subdomain e.g. "apollo", "fortis"
  status: "active" | "suspended" | "trial";
  contact: {
    email: string;
    phone: string;
    address?: string;
  };
  settings: ITenantSettings;
  createdAt: Date;
  updatedAt: Date;
}

const TenantSchema = new Schema<ITenant>(
  {
    name: {
      type: String,
      required: [true, "Tenant name is required"],
      trim: true,
    },
    slug: {
      type: String,
      required: [true, "Tenant slug is required"],
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["active", "suspended", "trial"],
      default: "active",
      index: true,
    },
    contact: {
      email: { type: String, required: true, lowercase: true, trim: true },
      phone: { type: String, required: true, trim: true },
      address: { type: String },
    },
    settings: {
      opdStartTime: { type: String, default: "09:00" },
      opdEndTime: { type: String, default: "17:00" },
      slotDurationMinutes: { type: Number, default: 15 },
      consultationFeeDefault: { type: Number, default: 500 },
      branding: {
        logoUrl: { type: String },
        primaryColor: { type: String, default: "#0284c7" },
      },
    },
  },
  {
    timestamps: true,
  }
);

export const Tenant = mongoose.model<ITenant>("Tenant", TenantSchema);
