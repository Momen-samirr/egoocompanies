require("dotenv").config();
import express, { NextFunction, Request, Response } from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import userRouter from "./routes/user.route";
import driverRouter from "./routes/driver.route";
import adminRouter from "./routes/admin.route";

export const app = express();

// CORS configuration
const allowedOrigins = [
  "https://dashapp.egoobus.com",
  "http://localhost:3000",
  "http://localhost:3001",
  // Add other allowed origins as needed
];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, Postman, etc.)
      if (!origin) return callback(null, true);
      
      if (allowedOrigins.includes(origin) || process.env.NODE_ENV === "development") {
        callback(null, true);
      } else {
        // In production, only allow specific origins
        if (process.env.NODE_ENV === "production") {
          callback(new Error("Not allowed by CORS"));
        } else {
          callback(null, true);
        }
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// body parser
app.use(express.json({ limit: "50mb" }));

// cookie parser
app.use(cookieParser());

// Request logging middleware (after body parser to access req.body)
app.use((req: Request, res: Response, next: NextFunction) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  if (req.body && Object.keys(req.body).length > 0) {
    console.log("Request Body:", JSON.stringify(req.body, null, 2));
  }
  next();
});

// routes
app.use("/api/v1", userRouter);
app.use("/api/v1/driver", driverRouter);
app.use("/api/v1/admin", adminRouter);

// testing api
app.get("/test", (req: Request, res: Response, next: NextFunction) => {
  res.status(200).json({
    succcess: true,
    message: "API is working",
  });
});
