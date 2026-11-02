import mongoose, { Document, Schema, Types } from "mongoose";

export enum UserRole {
  SUPERADMIN = "SUPERADMIN",       // Platform root admin
  HOSPITAL_ADMIN = "HOSPITAL_ADMIN", // Hospital administrator
  DOCTOR = "DOCTOR",               // Doctor attending OPD
  RECEPTIONIST = "RECEPTIONIST",   // OPD staff & token desk
  PATIENT = "PATIENT",             // Patient booking & checking queue
}

export interface IUser extends Document {
  tenantId?: Types.ObjectId; // Optional only for SUPERADMIN
  name: string;
  email: string;
  password: string;
  role: UserRole;
  phone?: string;
  isActive: boolean;
  metadata?: {
    specialization?: string; // For DOCTOR (e.g. "Cardiology")
    licenseNumber?: string;  // For DOCTOR
    department?: string;     // For DOCTOR / RECEPTIONIST
    dateOfBirth?: Date;      // For PATIENT
    bloodGroup?: string;     // For PATIENT
  };
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: "Tenant",
      required: function (this: IUser) {
        // Only SUPERADMIN can exist without a tenantId
        return this.role !== UserRole.SUPERADMIN;
      },
      index: true,
    },
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      select: false, // Prevents returning hashed password in queries by default
    },
    role: {
      type: String,
      enum: Object.values(UserRole),
      default: UserRole.PATIENT,
      index: true,
    },
    phone: {
      type: String,
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    metadata: {
      specialization: { type: String, trim: true },
      licenseNumber: { type: String, trim: true },
      department: { type: String, trim: true },
      dateOfBirth: { type: Date },
      bloodGroup: { type: String, trim: true },
    },
  },
  {
    timestamps: true,
  }
);

// Compound Index: Enforce email uniqueness per tenant
// e.g. "rahul@gmail.com" can exist in Apollo AND in Fortis, but only once in Apollo!
UserSchema.index({ tenantId: 1, email: 1 }, { unique: true });

export const User = mongoose.model<IUser>("User", UserSchema);
