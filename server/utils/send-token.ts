import jwt from "jsonwebtoken";

// send token
export const sendToken = async (user: any, res: any) => {
  if (!user) {
    return res.status(404).json({
      success: false,
      message: "User not found",
    });
  }

  const accessToken = jwt.sign(
    { id: user.id },
    process.env.ACCESS_TOKEN_SECRET!,
    {
      expiresIn: "30d",
    }
  );
  res.status(201).json({
    success: true,
    accessToken,
    user,
  });
};
