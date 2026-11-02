import { User, IUser, UserRole } from "../models/user.model";
import { hashPassword, comparePassword } from "../utils/password.util";
import { signAccessToken, signRefreshToken, verifyRefreshToken, ITokenPayload } from "../utils/jwt.util";
import { redis } from "../config/redis";
import { Types } from "mongoose";

const REFRESH_TOKEN_TTL = 7 * 24 * 60 * 60; // 7 days in seconds

export interface RegisterDTO {
  name: string;
  email: string;
  password: string;
  role?: UserRole;
  phone?: string;
  tenantId?: string;
  metadata?: IUser["metadata"];
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export class AuthService {
  /**
   * Register a new user under a specific hospital tenant
   */
  static async register(data: RegisterDTO): Promise<{ user: Partial<IUser>; tokens: AuthTokens }> {
    // 1. Check if user already exists in this tenant
    const query: { email: string; tenantId?: Types.ObjectId } = { email: data.email.toLowerCase() };
    if (data.tenantId) {
      query.tenantId = new Types.ObjectId(data.tenantId);
    }

    const existingUser = await User.findOne(query);
    if (existingUser) {
      throw new Error("A user with this email already exists in this hospital.");
    }

    // 2. Hash password
    const hashedPassword = await hashPassword(data.password);

    // 3. Create user
    const newUser = await User.create({
      name: data.name,
      email: data.email.toLowerCase(),
      password: hashedPassword,
      role: data.role || UserRole.PATIENT,
      phone: data.phone,
      tenantId: data.tenantId ? new Types.ObjectId(data.tenantId) : undefined,
      metadata: data.metadata,
    });

    // 4. Generate tokens
    const payload: ITokenPayload = {
      userId: newUser._id.toString(),
      email: newUser.email,
      role: newUser.role,
      tenantId: newUser.tenantId?.toString(),
    };

    const accessToken = signAccessToken(payload);
    const refreshToken = signRefreshToken(payload);

    // 5. Store refresh token in Redis for session revocation
    try {
      await redis.setex(`refresh_token:${newUser._id}`, REFRESH_TOKEN_TTL, refreshToken);
    } catch (redisErr) {
      console.warn("Failed to store refresh token in Redis:", redisErr);
    }

    const userObj = newUser.toObject();
    delete (userObj as { password?: string }).password;

    return {
      user: userObj,
      tokens: { accessToken, refreshToken },
    };
  }

  /**
   * Login user with tenant validation
   */
  static async login(
    email: string,
    passwordPlain: string,
    tenantId?: string
  ): Promise<{ user: Partial<IUser>; tokens: AuthTokens }> {
    const query: { email: string; tenantId?: Types.ObjectId } = { email: email.toLowerCase() };
    if (tenantId) {
      query.tenantId = new Types.ObjectId(tenantId);
    }

    // Must explicitly select password because it is { select: false } in schema
    const user = await User.findOne(query).select("+password");
    if (!user) {
      throw new Error("Invalid email or password.");
    }

    if (!user.isActive) {
      throw new Error("Your account has been deactivated. Please contact your hospital administrator.");
    }

    // Verify password
    const isPasswordValid = await comparePassword(passwordPlain, user.password);
    if (!isPasswordValid) {
      throw new Error("Invalid email or password.");
    }

    const payload: ITokenPayload = {
      userId: user._id.toString(),
      email: user.email,
      role: user.role,
      tenantId: user.tenantId?.toString(),
    };

    const accessToken = signAccessToken(payload);
    const refreshToken = signRefreshToken(payload);

    // Update Redis session
    try {
      await redis.setex(`refresh_token:${user._id}`, REFRESH_TOKEN_TTL, refreshToken);
    } catch (redisErr) {
      console.warn("Failed to store refresh token in Redis:", redisErr);
    }

    const userObj = user.toObject();
    delete (userObj as { password?: string }).password;

    return {
      user: userObj,
      tokens: { accessToken, refreshToken },
    };
  }

  /**
   * Refresh expired access token using valid refresh token
   */
  static async refresh(refreshToken: string): Promise<AuthTokens> {
    const decoded = verifyRefreshToken(refreshToken);

    // Check if token exists in Redis (not revoked)
    try {
      const storedToken = await redis.get(`refresh_token:${decoded.userId}`);
      if (!storedToken || storedToken !== refreshToken) {
        throw new Error("Refresh token expired or revoked. Please login again.");
      }
    } catch (err) {
      if ((err as Error).message.includes("revoked")) throw err;
      console.warn("Redis check bypassed during refresh:", err);
    }

    const payload: ITokenPayload = {
      userId: decoded.userId,
      email: decoded.email,
      role: decoded.role,
      tenantId: decoded.tenantId,
    };

    const newAccessToken = signAccessToken(payload);
    const newRefreshToken = signRefreshToken(payload);

    // Rotate refresh token in Redis
    try {
      await redis.setex(`refresh_token:${decoded.userId}`, REFRESH_TOKEN_TTL, newRefreshToken);
    } catch (redisErr) {
      console.warn("Failed to rotate refresh token in Redis:", redisErr);
    }

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    };
  }

  /**
   * Logout user by deleting refresh token from Redis
   */
  static async logout(userId: string): Promise<void> {
    try {
      await redis.del(`refresh_token:${userId}`);
    } catch (redisErr) {
      console.warn("Failed to delete refresh token from Redis:", redisErr);
    }
  }
}
