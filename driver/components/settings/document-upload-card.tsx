import React from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { useTranslation } from "react-i18next";
import { windowHeight, windowWidth, fontSizes } from "@/themes/app.constant";
import color from "@/themes/app.colors";

export type DocumentType =
  | "selfie"
  | "license"
  | "license_front"
  | "license_back"
  | "criminal_record"
  | "drug_test";

interface DocumentUploadCardProps {
  title: string;
  description: string;
  documentType: DocumentType;
  imageUrl?: string;
  isUploaded: boolean;
  isUploading: boolean;
  status?: "pending" | "approved" | "rejected";
  rejectionReason?: string;
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
  status,
  rejectionReason,
  onTakePhoto,
  onUploadFromGallery,
}) => {
  const { t } = useTranslation("components");

  const getStatusBadge = () => {
    if (!status && !isUploaded) return null;

    let badgeStyle = styles.statusBadge;
    let badgeText = t("docUploaded");
    let textColor = "#fff";

    if (status === "approved") {
      badgeStyle = [styles.statusBadge, styles.approvedBadge];
      badgeText = t("docApprovedBadge");
      textColor = "#fff";
    } else if (status === "rejected") {
      badgeStyle = [styles.statusBadge, styles.rejectedBadge];
      badgeText = t("docRejectedBadge");
      textColor = "#fff";
    } else if (status === "pending" || (isUploaded && !status)) {
      badgeStyle = [styles.statusBadge, styles.pendingBadge];
      badgeText = t("docPendingReview");
      textColor = "#fff";
    }

    return (
      <View style={badgeStyle}>
        <Text style={[styles.statusText, { color: textColor }]}>
          {badgeText}
        </Text>
      </View>
    );
  };

  // Determine if upload buttons should be shown
  // Show upload buttons when: no status (not uploaded), approved (can update), or rejected (can re-upload)
  // Do NOT show upload buttons when: pending (waiting for admin review)
  // Show approved message ONLY when status is explicitly "approved"
  const showUploadButtons =
    !status || status === "approved" || status === "rejected";
  const showApprovedMessage = status === "approved";
  const isPending = status === "pending";

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        {getStatusBadge()}
      </View>
      <Text style={styles.description}>{description}</Text>
      {status === "rejected" && rejectionReason && (
        <View style={styles.rejectionContainer}>
          <Text style={styles.rejectionLabel}>{t("docRejectionReason")}</Text>
          <Text style={styles.rejectionReason}>{rejectionReason}</Text>
        </View>
      )}

      {imageUrl ? (
        <View style={styles.imageContainer}>
          <Image source={{ uri: imageUrl }} style={styles.image} />
          {isUploading && (
            <View style={styles.uploadingOverlay}>
              <ActivityIndicator size="large" color={color.buttonBg} />
              <Text style={styles.uploadingText}>{t("docUploading")}</Text>
            </View>
          )}
        </View>
      ) : (
        <View style={styles.placeholderContainer}>
          <View style={styles.placeholderIcon}>
            <Text style={styles.placeholderText}>📄</Text>
          </View>
          <Text style={styles.placeholderLabel}>{t("docNoUpload")}</Text>
        </View>
      )}

      <View style={styles.buttonContainer}>
        {isPending ? (
          <View style={styles.pendingMessage}>
            <Text style={styles.pendingText}>{t("docPendingWait")}</Text>
          </View>
        ) : showUploadButtons ? (
          <>
            <TouchableOpacity
              style={[
                styles.actionButton,
                styles.cameraButton,
                (isUploading || isPending) && styles.disabledButton,
              ]}
              onPress={onTakePhoto}
              disabled={isUploading || isPending}
            >
              <Text style={[styles.actionButtonText, { color: "#fff" }]}>
                {status === "rejected"
                  ? t("docReupload")
                  : status === "approved"
                  ? t("docUpdate")
                  : t("docTakePhoto")}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.actionButton,
                styles.galleryButton,
                (isUploading || isPending) && styles.disabledButton,
              ]}
              onPress={onUploadFromGallery}
              disabled={isUploading || isPending}
            >
              <Text style={[styles.actionButtonText, { color: "#000" }]}>
                {t("docUploadGallery")}
              </Text>
            </TouchableOpacity>
          </>
        ) : showApprovedMessage ? (
          <View style={styles.approvedMessage}>
            <Text style={styles.approvedText}>{t("docApprovedLine")}</Text>
            <Text style={styles.approvedSubtext}>{t("docApprovedHint")}</Text>
          </View>
        ) : null}
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
    paddingHorizontal: windowWidth(12),
    paddingVertical: windowHeight(4),
    borderRadius: 12,
  },
  approvedBadge: {
    backgroundColor: "#10B981",
  },
  rejectedBadge: {
    backgroundColor: "#EF4444",
  },
  pendingBadge: {
    backgroundColor: "#F59E0B",
  },
  statusText: {
    fontSize: fontSizes.FONT12,
    fontWeight: "600",
  },
  rejectionContainer: {
    backgroundColor: "#FEE2E2",
    padding: windowWidth(12),
    borderRadius: 8,
    marginBottom: windowHeight(12),
    borderStartWidth: 3,
    borderStartColor: "#EF4444",
  },
  rejectionLabel: {
    fontSize: fontSizes.FONT12,
    fontWeight: "600",
    color: "#991B1B",
    marginBottom: windowHeight(4),
  },
  rejectionReason: {
    fontSize: fontSizes.FONT14,
    color: "#DC2626",
    lineHeight: 20,
  },
  disabledButton: {
    opacity: 0.5,
  },
  approvedMessage: {
    width: "100%",
    paddingVertical: windowHeight(12),
    backgroundColor: "#D1FAE5",
    borderRadius: 8,
    alignItems: "center",
  },
  approvedText: {
    fontSize: fontSizes.FONT14,
    color: "#065F46",
    fontWeight: "600",
  },
  approvedSubtext: {
    fontSize: fontSizes.FONT12,
    color: "#047857",
    marginTop: windowHeight(4),
  },
  pendingMessage: {
    width: "100%",
    paddingVertical: windowHeight(12),
    backgroundColor: "#FEF3C7",
    borderRadius: 8,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#F59E0B",
  },
  pendingText: {
    fontSize: fontSizes.FONT14,
    color: "#92400E",
    fontWeight: "500",
    textAlign: "center",
    paddingHorizontal: windowWidth(8),
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
