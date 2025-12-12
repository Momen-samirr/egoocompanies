import axios from "axios";
import * as FileSystem from "expo-file-system";
import { getServerUri } from "@/configs/constants";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type DocumentType =
  | "selfie"
  | "license"
  | "license_front"
  | "license_back"
  | "criminal_record"
  | "drug_test";

export interface DocumentInfo {
  url?: string;
  uploaded: boolean;
  status?: "pending" | "approved" | "rejected";
  rejectionReason?: string;
  reviewedAt?: string;
}

export interface DocumentStatus {
  selfie: DocumentInfo;
  licenseFront: DocumentInfo;
  licenseBack: DocumentInfo;
  criminalRecord: DocumentInfo;
  drugTest: DocumentInfo;
  verified: boolean;
  verifiedAt?: string;
}

/**
 * Convert image URI to base64 string
 */
const imageToBase64 = async (uri: string): Promise<string> => {
  try {
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    return base64;
  } catch (error) {
    console.error("Error converting image to base64:", error);
    throw new Error("Failed to process image");
  }
};

/**
 * Upload a document to the server
 */
export const uploadDocument = async (
  documentType: DocumentType,
  imageUri: string
): Promise<{ success: boolean; documentUrl?: string; message?: string }> => {
  try {
    const accessToken = await AsyncStorage.getItem("accessToken");
    if (!accessToken) {
      throw new Error("Not authenticated");
    }

    // Convert image to base64
    const imageBase64 = await imageToBase64(imageUri);

    const response = await axios.post(
      `${getServerUri()}/driver/upload-document`,
      {
        documentType,
        imageBase64,
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        timeout: 30000, // 30 second timeout for uploads
      }
    );

    if (response.data.success) {
      return {
        success: true,
        documentUrl: response.data.documentUrl,
        message: response.data.message,
      };
    } else {
      throw new Error(response.data.message || "Upload failed");
    }
  } catch (error: any) {
    console.error("Upload document error:", error);
    if (error.response) {
      throw new Error(
        error.response.data?.message || "Failed to upload document"
      );
    } else if (error.request) {
      throw new Error("Network error. Please check your connection.");
    } else {
      throw new Error(error.message || "Failed to upload document");
    }
  }
};

/**
 * Get driver's document status
 */
export const getDriverDocuments = async (): Promise<DocumentStatus> => {
  try {
    const accessToken = await AsyncStorage.getItem("accessToken");
    if (!accessToken) {
      throw new Error("Not authenticated");
    }

    const response = await axios.get(`${getServerUri()}/driver/documents`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (response.data.success) {
      return response.data.documents;
    } else {
      throw new Error(response.data.message || "Failed to fetch documents");
    }
  } catch (error: any) {
    console.error("Get driver documents error:", error);
    if (error.response) {
      throw new Error(
        error.response.data?.message || "Failed to fetch documents"
      );
    } else if (error.request) {
      throw new Error("Network error. Please check your connection.");
    } else {
      throw new Error(error.message || "Failed to fetch documents");
    }
  }
};
