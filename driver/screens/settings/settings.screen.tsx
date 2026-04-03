import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
  TouchableOpacity,
} from "react-native";
import { useTranslation } from "react-i18next";
import { windowHeight, windowWidth, fontSizes } from "@/themes/app.constant";
import color from "@/themes/app.colors";
import DocumentUploadCard from "@/components/settings/document-upload-card";
import { useI18nActions } from "@/contexts/I18nActionsContext";
import {
  uploadDocument,
  getDriverDocuments,
  DocumentType,
} from "@/services/document.service";
import * as ImagePicker from "expo-image-picker";
import { Toast } from "react-native-toast-notifications";

const SettingsScreen: React.FC = () => {
  const { t } = useTranslation("settings");
  const { applyLanguage } = useI18nActions();
  const [langBusy, setLangBusy] = useState(false);
  const [documents, setDocuments] = useState({
    selfie: {
      url: undefined as string | undefined,
      uploaded: false,
      status: undefined as "pending" | "approved" | "rejected" | undefined,
      rejectionReason: undefined as string | undefined,
    },
    licenseFront: {
      url: undefined as string | undefined,
      uploaded: false,
      status: undefined as "pending" | "approved" | "rejected" | undefined,
      rejectionReason: undefined as string | undefined,
    },
    licenseBack: {
      url: undefined as string | undefined,
      uploaded: false,
      status: undefined as "pending" | "approved" | "rejected" | undefined,
      rejectionReason: undefined as string | undefined,
    },
    criminalRecord: {
      url: undefined as string | undefined,
      uploaded: false,
      status: undefined as "pending" | "approved" | "rejected" | undefined,
      rejectionReason: undefined as string | undefined,
    },
    drugTest: {
      url: undefined as string | undefined,
      uploaded: false,
      status: undefined as "pending" | "approved" | "rejected" | undefined,
      rejectionReason: undefined as string | undefined,
    },
    verified: false,
    verifiedAt: undefined as string | undefined,
  });
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<{
    [key in DocumentType]?: boolean;
  }>({});

  useEffect(() => {
    loadDocuments();
  }, []);

  const loadDocuments = async () => {
    try {
      setLoading(true);
      const docs = await getDriverDocuments();
      setDocuments({
        selfie: {
          url: docs.selfie.url,
          uploaded: docs.selfie.uploaded,
          status: docs.selfie.status,
          rejectionReason: docs.selfie.rejectionReason,
        },
        licenseFront: {
          url: docs.licenseFront.url,
          uploaded: docs.licenseFront.uploaded,
          status: docs.licenseFront.status,
          rejectionReason: docs.licenseFront.rejectionReason,
        },
        licenseBack: {
          url: docs.licenseBack.url,
          uploaded: docs.licenseBack.uploaded,
          status: docs.licenseBack.status,
          rejectionReason: docs.licenseBack.rejectionReason,
        },
        criminalRecord: {
          url: docs.criminalRecord.url,
          uploaded: docs.criminalRecord.uploaded,
          status: docs.criminalRecord.status,
          rejectionReason: docs.criminalRecord.rejectionReason,
        },
        drugTest: {
          url: docs.drugTest.url,
          uploaded: docs.drugTest.uploaded,
          status: docs.drugTest.status,
          rejectionReason: docs.drugTest.rejectionReason,
        },
        verified: docs.verified,
        verifiedAt: docs.verifiedAt,
      });
    } catch (error: any) {
      console.error("Error loading documents:", error);
      Toast.show(error.message || t("loadFailed"), {
        type: "danger",
        placement: "bottom",
      });
    } finally {
      setLoading(false);
    }
  };

  const requestPermissions = async () => {
    const { status: cameraStatus } =
      await ImagePicker.requestCameraPermissionsAsync();
    const { status: libraryStatus } =
      await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (cameraStatus !== "granted" || libraryStatus !== "granted") {
      Alert.alert(t("permissionsTitle"), t("permissionsBody"));
      return false;
    }
    return true;
  };

  const handleImagePicker = async (
    documentType: DocumentType,
    source: "camera" | "gallery"
  ) => {
    const hasPermission = await requestPermissions();
    if (!hasPermission) return;

    try {
      let result;
      if (source === "camera") {
        result = await ImagePicker.launchCameraAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          aspect: [4, 3],
          quality: 0.8,
        });
      } else {
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          aspect: [4, 3],
          quality: 0.8,
        });
      }

      if (!result.canceled && result.assets[0]) {
        await uploadDocumentFile(documentType, result.assets[0].uri);
      }
    } catch (error: any) {
      console.error("Image picker error:", error);
      Toast.show(t("pickImageFailed"), {
        type: "danger",
        placement: "bottom",
      });
    }
  };

  const uploadDocumentFile = async (
    documentType: DocumentType,
    imageUri: string
  ) => {
    try {
      setUploading((prev) => ({ ...prev, [documentType]: true }));

      const result = await uploadDocument(documentType, imageUri);

      if (result.success) {
        Toast.show(t("uploadSuccess"), {
          type: "success",
          placement: "bottom",
        });
        // Reload documents to get updated URLs
        await loadDocuments();
      }
    } catch (error: any) {
      console.error("Upload error:", error);
      Toast.show(error.message || t("uploadFailed"), {
        type: "danger",
        placement: "bottom",
      });
    } finally {
      setUploading((prev) => ({ ...prev, [documentType]: false }));
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={color.buttonBg} />
        <Text style={styles.loadingText}>{t("loadingDocuments")}</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t("requiredDocuments")}</Text>
        <Text style={styles.headerSubtitle}>{t("documentsSubtitle")}</Text>
      </View>

      <View style={styles.languageSection}>
        <Text style={styles.languageTitle}>{t("language")}</Text>
        <Text style={styles.languageHint}>{t("languageSubtitle")}</Text>
        <View style={styles.languageRow}>
          <TouchableOpacity
            style={styles.languageChip}
            disabled={langBusy}
            onPress={async () => {
              if (langBusy) return;
              setLangBusy(true);
              try {
                await applyLanguage("en");
              } finally {
                setLangBusy(false);
              }
            }}
          >
            <Text style={styles.languageChipText}>{t("languageEnglish")}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.languageChip}
            disabled={langBusy}
            onPress={async () => {
              if (langBusy) return;
              setLangBusy(true);
              try {
                await applyLanguage("ar");
              } finally {
                setLangBusy(false);
              }
            }}
          >
            <Text style={styles.languageChipText}>{t("languageArabic")}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {documents.verified && (
        <View style={styles.verifiedBanner}>
          <Text style={styles.verifiedText}>{t("documentsVerified")}</Text>
        </View>
      )}

      <View style={styles.cardsContainer}>
        <DocumentUploadCard
          title={t("selfieTitle")}
          description={t("selfieDesc")}
          documentType="selfie"
          imageUrl={documents.selfie.url}
          isUploaded={documents.selfie.uploaded}
          isUploading={uploading.selfie || false}
          status={documents.selfie.status}
          rejectionReason={documents.selfie.rejectionReason}
          onTakePhoto={() => handleImagePicker("selfie", "camera")}
          onUploadFromGallery={() => handleImagePicker("selfie", "gallery")}
        />

        <DocumentUploadCard
          title={t("licenseFrontTitle")}
          description={t("licenseFrontDesc")}
          documentType="license_front"
          imageUrl={documents.licenseFront.url}
          isUploaded={documents.licenseFront.uploaded}
          isUploading={uploading.license_front || false}
          status={documents.licenseFront.status}
          rejectionReason={documents.licenseFront.rejectionReason}
          onTakePhoto={() => handleImagePicker("license_front", "camera")}
          onUploadFromGallery={() =>
            handleImagePicker("license_front", "gallery")
          }
        />

        <DocumentUploadCard
          title={t("licenseBackTitle")}
          description={t("licenseBackDesc")}
          documentType="license_back"
          imageUrl={documents.licenseBack.url}
          isUploaded={documents.licenseBack.uploaded}
          isUploading={uploading.license_back || false}
          status={documents.licenseBack.status}
          rejectionReason={documents.licenseBack.rejectionReason}
          onTakePhoto={() => handleImagePicker("license_back", "camera")}
          onUploadFromGallery={() =>
            handleImagePicker("license_back", "gallery")
          }
        />

        <DocumentUploadCard
          title={t("criminalTitle")}
          description={t("criminalDesc")}
          documentType="criminal_record"
          imageUrl={documents.criminalRecord.url}
          isUploaded={documents.criminalRecord.uploaded}
          isUploading={uploading.criminal_record || false}
          status={documents.criminalRecord.status}
          rejectionReason={documents.criminalRecord.rejectionReason}
          onTakePhoto={() => handleImagePicker("criminal_record", "camera")}
          onUploadFromGallery={() =>
            handleImagePicker("criminal_record", "gallery")
          }
        />

        <DocumentUploadCard
          title={t("drugTestTitle")}
          description={t("drugTestDesc")}
          documentType="drug_test"
          imageUrl={documents.drugTest.url}
          isUploaded={documents.drugTest.uploaded}
          isUploading={uploading.drug_test || false}
          status={documents.drugTest.status}
          rejectionReason={documents.drugTest.rejectionReason}
          onTakePhoto={() => handleImagePicker("drug_test", "camera")}
          onUploadFromGallery={() => handleImagePicker("drug_test", "gallery")}
        />
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: color.background.secondary,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: color.background.secondary,
  },
  loadingText: {
    marginTop: windowHeight(16),
    fontSize: fontSizes.FONT16,
    color: color.text.secondary,
  },
  header: {
    paddingTop: windowHeight(70),
    paddingHorizontal: windowWidth(20),
    paddingBottom: windowHeight(20),
    backgroundColor: "#fff",
  },
  headerTitle: {
    fontSize: fontSizes.FONT30,
    fontWeight: "600",
    color: color.text.primary,
    marginBottom: windowHeight(8),
  },
  headerSubtitle: {
    fontSize: fontSizes.FONT14,
    color: color.text.secondary,
    lineHeight: 20,
  },
  languageSection: {
    marginHorizontal: windowWidth(20),
    marginTop: windowHeight(16),
    padding: windowWidth(16),
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
  },
  languageTitle: {
    fontSize: fontSizes.FONT16,
    fontWeight: "700",
    color: color.text.primary,
    marginBottom: windowHeight(4),
  },
  languageHint: {
    fontSize: fontSizes.FONT12,
    color: color.text.secondary,
    marginBottom: windowHeight(12),
  },
  languageRow: {
    flexDirection: "row",
    gap: windowWidth(12),
  },
  languageChip: {
    flex: 1,
    paddingVertical: windowHeight(12),
    borderRadius: 12,
    backgroundColor: color.background.secondary,
    alignItems: "center",
    borderWidth: 1,
    borderColor: color.border,
  },
  languageChipText: {
    fontSize: fontSizes.FONT14,
    fontWeight: "600",
    color: color.text.primary,
  },
  verifiedBanner: {
    backgroundColor: color.semantic.successLight,
    marginHorizontal: windowWidth(20),
    marginTop: windowHeight(20),
    padding: windowWidth(16),
    borderRadius: 8,
    borderStartWidth: 4,
    borderStartColor: color.semantic.success,
  },
  verifiedText: {
    fontSize: fontSizes.FONT14,
    color: color.semantic.success,
    fontWeight: "600",
  },
  cardsContainer: {
    padding: windowWidth(20),
    paddingTop: windowHeight(20),
  },
});

export default SettingsScreen;
