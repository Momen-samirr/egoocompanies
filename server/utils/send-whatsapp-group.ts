import axios from "axios";

export interface SendWhatsAppGroupOptions {
  groupId: string; // WhatsApp Group JID (e.g., "120363123456789012@g.us")
  message: string;
}

/**
 * Validate group ID format
 * Group JID format: [numbers]@g.us
 * @param groupId The group ID to validate
 * @returns true if valid, false otherwise
 */
export const validateGroupId = (groupId: string): boolean => {
  if (!groupId || typeof groupId !== "string") {
    return false;
  }
  const groupJidPattern = /^\d+@g\.us$/;
  return groupJidPattern.test(groupId);
};

/**
 * Send WhatsApp message to a group using Green API
 * Documentation: https://green-api.com/en/docs/api/sending/SendMessage/
 * @param options Configuration object with groupId and message
 * @returns Promise that resolves when message is sent
 * @throws Error if configuration is invalid or API call fails
 */
export const sendWhatsAppToGroup = async (
  options: SendWhatsAppGroupOptions
): Promise<void> => {
  try {
    // Validate group ID format
    if (!validateGroupId(options.groupId)) {
      throw new Error(
        `Invalid group ID format: ${options.groupId}. Expected format: [numbers]@g.us`
      );
    }

    // Validate required environment variables
    const instanceId = process.env.GREEN_API_INSTANCE_ID;
    const apiToken = process.env.GREEN_API_TOKEN;

    if (!instanceId || !apiToken) {
      throw new Error(
        "Green API credentials not configured. Please set GREEN_API_INSTANCE_ID and GREEN_API_TOKEN environment variables."
      );
    }

    // Validate message is not empty
    if (!options.message || options.message.trim().length === 0) {
      throw new Error("Message cannot be empty");
    }

    // Send message via Green API
    const response = await axios.post(
      `https://api.green-api.com/waInstance${instanceId}/sendMessage/${apiToken}`,
      {
        chatId: options.groupId,
        message: options.message,
      },
      {
        headers: {
          "Content-Type": "application/json",
        },
        timeout: 10000, // 10 second timeout
      }
    );

    // Check if response indicates success
    if (response.data && response.data.idMessage) {
      console.log(
        `WhatsApp message sent successfully to group ${options.groupId}. Message ID: ${response.data.idMessage}`
      );
    } else {
      console.warn(`WhatsApp API response unexpected format:`, response.data);
    }
  } catch (error: any) {
    // Enhanced error logging
    if (error.response) {
      // API responded with error status
      console.error("WhatsApp API error response:", {
        status: error.response.status,
        statusText: error.response.statusText,
        data: error.response.data,
        groupId: options.groupId,
      });
      throw new Error(
        `WhatsApp API error: ${error.response.status} - ${
          error.response.data?.message || error.response.statusText
        }`
      );
    } else if (error.request) {
      // Request was made but no response received
      console.error("WhatsApp API request error (no response):", {
        message: error.message,
        groupId: options.groupId,
      });
      throw new Error(
        `WhatsApp API request failed: No response received. ${error.message}`
      );
    } else {
      // Error in request setup
      console.error("WhatsApp API setup error:", {
        message: error.message,
        groupId: options.groupId,
      });
      throw error;
    }
  }
};
