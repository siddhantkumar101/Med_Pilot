import { ITenant } from "../models/tenant.model";

declare global {
  namespace Express {
    interface Request {
      tenant?: ITenant;
    }
  }
}
