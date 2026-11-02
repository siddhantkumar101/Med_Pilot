import { ITenant } from "../models/tenant.model";
import { ITokenPayload } from "../utils/jwt.util";

declare global {
  namespace Express {
    interface Request {
      tenant?: ITenant;
      user?: ITokenPayload;
    }
  }
}
