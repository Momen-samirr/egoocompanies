import axios from "axios";
import { getServerUri } from "@/configs/constants";

/**
 * Triggers SMS/phone OTP pipeline (server may no-op SMS); required before phone verification step.
 */
export async function sendSignupOtpRequest(phoneNumber: string): Promise<void> {
  await axios.post(
    `${getServerUri()}/driver/send-otp`,
    { phone_number: phoneNumber },
    { timeout: 10000 }
  );
}
