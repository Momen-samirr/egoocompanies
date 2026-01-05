import { Parent } from "@prisma/client";

declare global {
  namespace Express {
    interface Request {
      parent?: Parent;
      user?: any;
      driver?: any;
      admin?: any;
    }
  }
}

export {};

