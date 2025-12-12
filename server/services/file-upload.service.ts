import { v2 as cloudinary } from "cloudinary";
import { Readable } from "stream";

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export type DocumentType = "selfie" | "license" | "criminal_record";

interface UploadOptions {
  folder: string;
  resource_type?: "image" | "auto";
  transformation?: Array<{
    width?: number;
    height?: number;
    crop?: string;
    quality?: string;
    format?: string;
  }>;
}

/**
 * Upload a file buffer to Cloudinary
 */
export const uploadToCloudinary = async (
  buffer: Buffer,
  fileName: string,
  options: UploadOptions = { folder: "driver-documents" }
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        ...options,
        public_id: fileName,
        overwrite: false,
        invalidate: true,
      },
      (error, result) => {
        if (error) {
          console.error("Cloudinary upload error:", error);
          reject(new Error("Failed to upload file to cloud storage"));
        } else if (result) {
          resolve(result.secure_url);
        } else {
          reject(new Error("Upload failed: No result returned"));
        }
      }
    );

    const readableStream = Readable.from(buffer);
    readableStream.pipe(uploadStream);
  });
};

/**
 * Upload a base64 image to Cloudinary
 */
export const uploadBase64ToCloudinary = async (
  base64String: string,
  fileName: string,
  options: UploadOptions = { folder: "driver-documents" }
): Promise<string> => {
  try {
    // Remove data URL prefix if present
    const base64Data = base64String.includes(",")
      ? base64String.split(",")[1]
      : base64String;

    const result = await cloudinary.uploader.upload(
      `data:image/jpeg;base64,${base64Data}`,
      {
        ...options,
        public_id: fileName,
        overwrite: false,
        invalidate: true,
        transformation: [
          {
            width: 1920,
            height: 1920,
            crop: "limit",
            quality: "auto",
            format: "jpg",
          },
        ],
      }
    );

    return result.secure_url;
  } catch (error) {
    console.error("Cloudinary upload error:", error);
    throw new Error("Failed to upload file to cloud storage");
  }
};

/**
 * Delete a file from Cloudinary
 */
export const deleteFromCloudinary = async (publicId: string): Promise<void> => {
  try {
    await cloudinary.uploader.destroy(publicId);
  } catch (error) {
    console.error("Cloudinary delete error:", error);
    // Don't throw error - deletion failure shouldn't break the flow
  }
};

/**
 * Validate file type
 */
export const validateFileType = (
  mimetype: string,
  allowedTypes: string[] = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
  ]
): boolean => {
  return allowedTypes.includes(mimetype.toLowerCase());
};

/**
 * Validate file size (in bytes)
 */
export const validateFileSize = (
  size: number,
  maxSize: number = 5 * 1024 * 1024 // 5MB default
): boolean => {
  return size <= maxSize;
};

/**
 * Generate a unique file name for driver documents
 */
export const generateDocumentFileName = (
  driverId: string,
  documentType: DocumentType
): string => {
  const timestamp = Date.now();
  return `driver-${driverId}-${documentType}-${timestamp}`;
};
