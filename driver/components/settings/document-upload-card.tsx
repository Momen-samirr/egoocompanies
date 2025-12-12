import React from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { windowHeight, windowWidth, fontSizes } from "@/themes/app.constant";
import color from "@/themes/app.colors";
import Button from "@/components/common/button";

export type DocumentType = "selfie" | "license" | "criminal_record";

interface DocumentUploadCardProps {
  title: string;
  description: string;
  documentType: DocumentType;
  imageUrl?: string;
  isUploaded: boolean;
  isUploading: boolean;
  onTakePhoto: () => void;
  onUploadFromGallery: () => void;
}

const DocumentUploadCard: React.FC<DocumentUploadCardProps> = ({
  title,
  description,
  documentType,
  imageUrl,
  isUploaded,
  isUploading,
  onTakePhoto,
  onUploadFromGallery,
}) => {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        {isUploaded && (
          <View style={styles.statusBadge}>
            <Text style={styles.statusText}>Uploaded</Text>
          </View>
        )}
      </View>
      <Text style={styles.description}>{description}</Text>

      {imageUrl ? (
        <View style={styles.imageContainer}>
          <Image source={{ uri: imageUrl }} style={styles.image} />
          {isUploading && (
            <View style={styles.uploadingOverlay}>
              <ActivityIndicator size="large" color={color.buttonBg} />
              <Text style={styles.uploadingText}>Uploading...</Text>
            </View>
          )}
        </View>
      ) : (
        <View style={styles.placeholderContainer}>
          <View style={styles.placeholderIcon}>
            <Text style={styles.placeholderText}>📄</Text>
          </View>
          <Text style={styles.placeholderLabel}>No document uploaded</Text>
        </View>
      )}

      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[styles.actionButton, styles.cameraButton]}
          onPress={onTakePhoto}
          disabled={isUploading}
        >
          <Text style={[styles.actionButtonText, { color: "#fff" }]}>
            📷 Take Photo
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, styles.galleryButton]}
          onPress={onUploadFromGallery}
          disabled={isUploading}
        >
          <Text style={[styles.actionButtonText, { color: "#000" }]}>
            🖼️ Upload from Gallery
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: windowWidth(20),
    marginBottom: windowHeight(20),
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: windowHeight(8),
  },
  title: {
    fontSize: fontSizes.FONT18,
    fontWeight: "600",
    color: "#000",
  },
  statusBadge: {
    backgroundColor: "#10B981",
    paddingHorizontal: windowWidth(12),
    paddingVertical: windowHeight(4),
    borderRadius: 12,
  },
  statusText: {
    color: "#fff",
    fontSize: fontSizes.FONT12,
    fontWeight: "600",
  },
  description: {
    fontSize: fontSizes.FONT14,
    color: "#6B7280",
    marginBottom: windowHeight(16),
  },
  imageContainer: {
    position: "relative",
    width: "100%",
    height: windowHeight(200),
    borderRadius: 8,
    overflow: "hidden",
    marginBottom: windowHeight(16),
    backgroundColor: "#F3F4F6",
  },
  image: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  uploadingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  uploadingText: {
    color: "#fff",
    marginTop: windowHeight(8),
    fontSize: fontSizes.FONT14,
    fontWeight: "500",
  },
  placeholderContainer: {
    width: "100%",
    height: windowHeight(200),
    borderRadius: 8,
    backgroundColor: "#F3F4F6",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: windowHeight(16),
  },
  placeholderIcon: {
    marginBottom: windowHeight(8),
  },
  placeholderText: {
    fontSize: 48,
  },
  placeholderLabel: {
    fontSize: fontSizes.FONT14,
    color: "#9CA3AF",
  },
  buttonContainer: {
    flexDirection: "row",
    gap: windowWidth(12),
  },
  actionButton: {
    flex: 1,
    paddingVertical: windowHeight(12),
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  cameraButton: {
    backgroundColor: color.buttonBg,
  },
  galleryButton: {
    backgroundColor: "#F3F4F6",
    borderWidth: 1,
    borderColor: color.border,
  },
  actionButtonText: {
    fontSize: fontSizes.FONT14,
    fontWeight: "600",
    color: "#000",
  },
});

export default DocumentUploadCard;
