require("dotenv").config();
import { NextFunction, Request, Response } from "express";
import twilio from "twilio";
import prisma from "../utils/prisma";
import jwt from "jsonwebtoken";
import { sendToken } from "../utils/send-token";
import { sendEmail } from "../utils/send-email";
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = twilio(accountSid, authToken, {
  lazyLoading: true,
});

// register new user
export const registerUser = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { phone_number } = req.body;
    
    // Validate phone number
    if (!phone_number) {
      return res.status(400).json({
        success: false,
        message: "Phone number is required",
      });
    }

    // Check if Twilio credentials are configured
    if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN || !process.env.TWILIO_SERVICE_SID) {
      console.error("Twilio credentials are not configured");
      return res.status(500).json({
        success: false,
        message: "SMS service is not configured. Please contact support.",
      });
    }

    try {
      await client.verify.v2
        ?.services(process.env.TWILIO_SERVICE_SID!)
        .verifications.create({
          channel: "sms",
          to: phone_number,
        });

      console.log(`OTP sent successfully to ${phone_number}`);
      res.status(201).json({
        success: true,
        message: "OTP sent successfully",
      });
    } catch (error: any) {
      console.error("Twilio Error:", error);
      const errorMessage = error.message || "Failed to send OTP";
      res.status(400).json({
        success: false,
        message: errorMessage,
      });
    }
  } catch (error: any) {
    console.error("Registration Error:", error);
    res.status(400).json({
      success: false,
      message: error.message || "An error occurred during registration",
    });
  }
};

// verify otp
export const verifyOtp = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { phone_number, otp } = req.body;

    try {
      await client.verify.v2
        .services(process.env.TWILIO_SERVICE_SID!)
        .verificationChecks.create({
          to: phone_number,
          code: otp,
        });
      // is user exist
      const isUserExist = await prisma.user.findUnique({
        where: {
          phone_number,
        },
      });
      if (isUserExist) {
        await sendToken(isUserExist, res);
      } else {
        // create account
        const user = await prisma.user.create({
          data: {
            phone_number: phone_number,
          },
        });
        res.status(200).json({
          success: true,
          message: "OTP verified successfully!",
          user: user,
        });
      }
    } catch (error) {
      console.log(error);
      res.status(400).json({
        success: false,
        message: "Something went wrong!",
      });
    }
  } catch (error) {
    console.log(error);
    res.status(400).json({
      success: false,
    });
  }
};

// sending otp to email
export const sendingOtpToEmail = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { email, name, userId } = req.body;

    // Validate required fields
    if (!email || !name || !userId) {
      return res.status(400).json({
        success: false,
        message: "Email, name, and userId are required",
      });
    }

    // Check if email service is configured
    if (!process.env.EMAIL_USER) {
      console.error("Email service is not configured");
      return res.status(500).json({
        success: false,
        message: "Email service is not configured. Please contact support.",
      });
    }

    const otp = Math.floor(1000 + Math.random() * 9000).toString();
    const user = {
      userId,
      name,
      email,
    };
    const token = jwt.sign(
      {
        user,
        otp,
      },
      process.env.EMAIL_ACTIVATION_SECRET!,
      {
        expiresIn: "5m",
      }
    );
    try {
      await sendEmail({
        to: email,
        name: name,
        subject: "Verify your email address!",
        html: `
          <p>Hi ${name},</p>
          <p>Your Ridewave verification code is <strong>${otp}</strong>. If you didn't request for this OTP, please ignore this email!</p>
          <p>Thanks,<br>Ridewave Team</p>
        `,
      });
      console.log(`Email OTP sent successfully to ${email}`);
      res.status(201).json({
        success: true,
        token,
        message: "OTP sent successfully to your email",
      });
    } catch (error: any) {
      console.error("Email Error:", error);
      const errorMessage = error.message || "Failed to send email";
      
      res.status(400).json({
        success: false,
        message: "Failed to send verification email. Please try again.",
        error: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
      });
    }
  } catch (error: any) {
    console.error("Email OTP Request Error:", error);
    res.status(400).json({
      success: false,
      message: error.message || "An error occurred while processing your request",
    });
  }
};

// verifying email otp
export const verifyingEmail = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { otp, token } = req.body;

    const newUser: any = jwt.verify(
      token,
      process.env.EMAIL_ACTIVATION_SECRET!
    );

    if (newUser.otp !== otp) {
      return res.status(400).json({
        success: false,
        message: "OTP is not correct or expired!",
      });
    }

    const { name, email, userId } = newUser.user;

    const user = await prisma.user.findUnique({
      where: {
        id: userId,
      },
    });
    if (user?.email === null) {
      const updatedUser = await prisma.user.update({
        where: {
          id: userId,
        },
        data: {
          name: name,
          email: email,
        },
      });
      await sendToken(updatedUser, res);
    }
  } catch (error) {
    console.log(error);
    res.status(400).json({
      success: false,
      message: "Your otp is expired!",
    });
  }
};

// get logged in user data
export const getLoggedInUserData = async (req: any, res: Response) => {
  try {
    const user = req.user;

    res.status(201).json({
      success: true,
      user,
    });
  } catch (error) {
    console.log(error);
  }
};

// getting user rides
export const getAllRides = async (req: any, res: Response) => {
  const rides = await prisma.rides.findMany({
    where: {
      userId: req.user?.id,
    },
    include: {
      driver: true,
      user: true,
    },
  });
  res.status(201).json({
    rides,
  });
};
