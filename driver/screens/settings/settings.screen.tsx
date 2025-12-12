import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from "react-native";
import { windowHeight, windowWidth, fontSizes } from "@/themes/app.constant";
import color from "@/themes/app.colors";
import DocumentUploadCard from "@/components/settings/document-upload-card";
import {
  uploadDocument,
  getDriverDocuments,
  DocumentType,
} from "@/services/document.service";
import * as ImagePicker from "expo-image-picker";
import { Toast } from "react-native-toast-notifications";

const SettingsScreen: React.FC = () => {
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
      Toast.show(error.message || "Failed to load documents", {
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
      Alert.alert(
        "Permissions Required",
        "Please grant camera and photo library permissions to upload documents."
      );
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
      Toast.show("Failed to pick image", {
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
        Toast.show("Document uploaded successfully!", {
          type: "success",
          placement: "bottom",
        });
        // Reload documents to get updated URLs
        await loadDocuments();
      }
    } catch (error: any) {
      console.error("Upload error:", error);
      Toast.show(error.message || "Failed to upload document", {
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
        <Text style={styles.loadingText}>Loading documents...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Required Documents</Text>
        <Text style={styles.headerSubtitle}>
          Please upload all required documents to complete your profile
          verification
        </Text>
      </View>

      {documents.verified && (
        <View style={styles.verifiedBanner}>
          <Text style={styles.verifiedText}>
            ✓ Your documents have been verified
          </Text>
        </View>
      )}

      <View style={styles.cardsContainer}>
        <DocumentUploadCard
          title="Selfie Photo"
          description="Take a clear selfie photo for identity verification"
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
          title="Driver's License - Front Side"
          description="Upload a clear photo of the front side of your driver's license"
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
          title="Driver's License - Back Side"
          description="Upload a clear photo of the back side of your driver's license"
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
          title="Criminal Record (Fish & Tashbih)"
          description="Upload your criminal record document (Fish & Tashbih)"
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
          title="Drug Test Document"
          description="Upload or capture a photo of your drug test analysis document"
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
  verifiedBanner: {
    backgroundColor: color.semantic.successLight,
    marginHorizontal: windowWidth(20),
    marginTop: windowHeight(20),
    padding: windowWidth(16),
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: color.semantic.success,
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
