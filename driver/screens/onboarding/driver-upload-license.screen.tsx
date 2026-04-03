import React, { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { Toast } from "react-native-toast-notifications";
import { uploadDocument } from "@/services/document.service";
import { kinetic, spacing } from "@/styles/design-system";
import fonts from "@/themes/app.fonts";
import { fontSizes } from "@/themes/app.constant";

const NEXT_ROUTE = "/(tabs)/home";
const LICENSE_PLACEHOLDER =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuBIFxo2-Qyg0AgPtxbbid1hMa6W0UN3OfjF--Mn05077nCvNugyDGhvhdCFbfhTYyqTsPRpq2IAdhuBSvS1njmVs6TCBs1qMdwgf3vGc_CGorEHmhdTHgnVCp8uZ9Jl97-qaj1r_QjNYbj3-KNybWMnXNo4_-fMTXe_a-FGv0GtR60OzyA4JWlCf3OnponRvgAJn7gQAHcbOCHfK55mMknV8sb-q_7ofZin_j8Q7f13_MTkEtCPmOIQ4tZERq6Qg0hfjWQH6SVaXPW5";

export default function DriverUploadLicenseScreen() {
  const { t } = useTranslation("documents");
  const { t: tc } = useTranslation("common");
  const signupParams = useLocalSearchParams<Record<string, string | string[]>>();
  const [licenseUri, setLicenseUri] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [ready, setReady] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const normalizedParams = useMemo(() => {
    const serialized: Record<string, string> = {};
    Object.entries(signupParams).forEach(([key, value]) => {
      serialized[key] = Array.isArray(value) ? String(value[0] || "") : String(value ?? "");
    });
    return serialized;
  }, [signupParams]);

  const requestPermissions = async () => {
    const camera = await ImagePicker.requestCameraPermissionsAsync();
    const gallery = await ImagePicker.requestMediaLibraryPermissionsAsync();
    const granted = camera.status === "granted" && gallery.status === "granted";
    if (!granted) {
      Toast.show(t("cameraGalleryRequired"), { type: "danger" });
    }
    return granted;
  };

  const uploadLicense = async (uri: string) => {
    try {
      setUploading(true);
      setLicenseUri(uri);
      const response = await uploadDocument("license", uri);
      if (!response.success) {
        throw new Error(response.message || "Upload failed");
      }
      setReady(true);
      Toast.show(t("licenseUploaded"), { type: "success" });
    } catch (error: any) {
      setReady(false);
      Toast.show(error.message || t("licenseUploadFailed"), { type: "danger" });
    } finally {
      setUploading(false);
    }
  };

  const pickLicense = async () => {
    const hasPermission = await requestPermissions();
    if (!hasPermission) return;

    Alert.alert(t("uploadLicenseTitle"), t("chooseSource"), [
      {
        text: t("camera"),
        onPress: async () => {
          const result = await ImagePicker.launchCameraAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            quality: 0.9,
          });
          if (!result.canceled && result.assets?.[0]?.uri) {
            await uploadLicense(result.assets[0].uri);
          }
        },
      },
      {
        text: t("gallery"),
        onPress: async () => {
          const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            quality: 0.9,
          });
          if (!result.canceled && result.assets?.[0]?.uri) {
            await uploadLicense(result.assets[0].uri);
          }
        },
      },
      { text: tc("cancel"), style: "cancel" },
    ]);
  };

  const captureLicenseDirectly = async () => {
    const hasPermission = await requestPermissions();
    if (!hasPermission) return;

    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.9,
      });

      if (result.canceled) {
        Toast.show(t("captureCancelled"), { type: "normal" });
        return;
      }

      const uri = result.assets?.[0]?.uri;
      if (!uri) {
        Toast.show(t("invalidImage"), { type: "danger" });
        return;
      }

      await uploadLicense(uri);
    } catch (error: any) {
      Toast.show(error?.message || t("captureFailed"), { type: "danger" });
    }
  };

  const onRetake = async () => {
    setReady(false);
    await pickLicense();
  };

  const onSubmit = async () => {
    if (!ready) {
      Toast.show(t("uploadLicenseFirst"), { type: "warning" });
      return;
    }

    try {
      setSubmitting(true);
      router.push({
        pathname: NEXT_ROUTE as any,
        params: normalizedParams,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()} activeOpacity={0.75}>
            <Ionicons name="arrow-back" size={22} color={kinetic.colors.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Verification</Text>
        </View>
      </View>
      <View style={styles.progressTrack}>
        <View style={styles.progressFill} />
      </View>

      <View style={styles.content}>
        <View style={styles.stepPill}>
          <Text style={styles.stepPillText}>STEP 3 OF 3</Text>
        </View>

        <Text style={styles.title}>Upload Driver's License</Text>
        <Text style={styles.subtitle}>
          Both front and back should be clearly visible in the photo. Please ensure there is no glare.
        </Text>

        <View style={styles.cardWrap}>
          <View style={styles.previewShell}>
            <View style={styles.previewFrame}>
              <Image source={{ uri: licenseUri || LICENSE_PLACEHOLDER }} style={styles.previewImage} resizeMode="cover" />
              <View style={styles.scanChip}>
                <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                <Text style={styles.scanChipText}>{ready ? "Scan Complete" : "Ready to Scan"}</Text>
              </View>

              <View style={styles.cornerTopLeft} />
              <View style={styles.cornerTopRight} />
              <View style={styles.cornerBottomLeft} />
              <View style={styles.cornerBottomRight} />
            </View>
          </View>

          <TouchableOpacity style={styles.retakeFab} onPress={onRetake} activeOpacity={0.85} disabled={uploading}>
            {uploading ? (
              <ActivityIndicator size="small" color={kinetic.colors.onSurfaceVariant} />
            ) : (
              <>
                <Ionicons name="refresh" size={20} color={kinetic.colors.onSurfaceVariant} />
                <Text style={styles.retakeText}>Retake</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[styles.captureButton, uploading && styles.captureButtonDisabled]}
          onPress={captureLicenseDirectly}
          activeOpacity={0.9}
          disabled={uploading || submitting}
        >
          {uploading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Ionicons name="camera" size={18} color="#FFFFFF" />
              <Text style={styles.captureButtonText}>Capture</Text>
            </>
          )}
        </TouchableOpacity>

        <View style={styles.tipsCard}>
          <Text style={styles.tipsTitle}>Verification Tips</Text>
          <View style={styles.tipRow}>
            <View style={styles.tipIconWrap}>
              <Ionicons name="sunny-outline" size={16} color={kinetic.colors.primary} />
            </View>
            <Text style={styles.tipText}>Avoid direct glare from overhead lights.</Text>
          </View>
          <View style={styles.tipRow}>
            <View style={styles.tipIconWrap}>
              <Ionicons name="scan-outline" size={16} color={kinetic.colors.primary} />
            </View>
            <Text style={styles.tipText}>Keep all four edges within the frame.</Text>
          </View>
        </View>
      </View>

      <View style={styles.bottomBar}>
        <TouchableOpacity style={styles.backFab} onPress={() => router.back()} activeOpacity={0.8}>
          <Ionicons name="arrow-back" size={20} color="#9CA3AF" />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.submitButton, !ready && styles.submitButtonDisabled]}
          onPress={onSubmit}
          activeOpacity={0.9}
          disabled={!ready || submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Text style={styles.submitText}>SUBMIT{"\n"}DOCUMENTS</Text>
              <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
            </>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: kinetic.colors.surface,
  },
  header: {
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.md,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  backButton: {
    width: 34,
    height: 34,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    color: "#667085",
    fontFamily: fonts.bold,
    fontSize: fontSizes.FONT30,
  },
  progressTrack: {
    height: 4,
    width: "100%",
    backgroundColor: "#E7E8E9",
  },
  progressFill: {
    width: "100%",
    height: "100%",
    backgroundColor: kinetic.colors.primary,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.xl,
  },
  stepPill: {
    alignSelf: "center",
    borderRadius: 999,
    backgroundColor: "#E1E0FF",
    paddingHorizontal: spacing.lg,
    paddingVertical: 7,
    marginBottom: spacing.lg,
  },
  stepPillText: {
    color: "#2F2EBE",
    fontFamily: fonts.bold,
    fontSize: fontSizes.FONT16,
    letterSpacing: 1.2,
  },
  title: {
    color: kinetic.colors.onSurface,
    fontFamily: fonts.bold,
    fontSize: 44,
    textAlign: "center",
    marginBottom: spacing.sm,
  },
  subtitle: {
    color: kinetic.colors.onSurfaceVariant,
    fontFamily: fonts.medium,
    fontSize: fontSizes.FONT18,
    lineHeight: 30,
    textAlign: "center",
    marginBottom: spacing.xl,
  },
  cardWrap: {
    marginBottom: spacing.xl,
  },
  previewShell: {
    borderRadius: 26,
    backgroundColor: "#FFFFFF",
    padding: spacing.md,
    ...kinetic.shadows.ambient,
  },
  previewFrame: {
    width: "100%",
    aspectRatio: 1.6 / 1,
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: "rgba(118,117,134,0.3)",
    backgroundColor: kinetic.colors.surfaceLow,
    justifyContent: "center",
    alignItems: "center",
  },
  previewImage: {
    width: "100%",
    height: "100%",
  },
  scanChip: {
    position: "absolute",
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: "rgba(255,255,255,0.9)",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: 999,
  },
  scanChipText: {
    color: kinetic.colors.onSurface,
    fontFamily: fonts.bold,
    fontSize: fontSizes.FONT18,
  },
  cornerTopLeft: {
    position: "absolute",
    top: 12,
    left: 12,
    width: 24,
    height: 24,
    borderTopWidth: 2,
    borderLeftWidth: 2,
    borderColor: "rgba(70,72,212,0.4)",
    borderTopLeftRadius: 8,
  },
  cornerTopRight: {
    position: "absolute",
    top: 12,
    right: 12,
    width: 24,
    height: 24,
    borderTopWidth: 2,
    borderRightWidth: 2,
    borderColor: "rgba(70,72,212,0.4)",
    borderTopRightRadius: 8,
  },
  cornerBottomLeft: {
    position: "absolute",
    bottom: 12,
    left: 12,
    width: 24,
    height: 24,
    borderBottomWidth: 2,
    borderLeftWidth: 2,
    borderColor: "rgba(70,72,212,0.4)",
    borderBottomLeftRadius: 8,
  },
  cornerBottomRight: {
    position: "absolute",
    bottom: 12,
    right: 12,
    width: 24,
    height: 24,
    borderBottomWidth: 2,
    borderRightWidth: 2,
    borderColor: "rgba(70,72,212,0.4)",
    borderBottomRightRadius: 8,
  },
  retakeFab: {
    position: "absolute",
    right: spacing.xl,
    bottom: -18,
    backgroundColor: "#FFFFFF",
    borderRadius: 999,
    paddingHorizontal: spacing.lg,
    height: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: "rgba(199,196,215,0.25)",
    ...kinetic.shadows.soft,
  },
  retakeText: {
    color: kinetic.colors.onSurfaceVariant,
    fontFamily: fonts.bold,
    fontSize: fontSizes.FONT18,
  },
  tipsCard: {
    backgroundColor: kinetic.colors.surfaceLow,
    borderRadius: 16,
    padding: spacing.lg,
    gap: spacing.md,
  },
  captureButton: {
    height: 54,
    borderRadius: 18,
    backgroundColor: kinetic.colors.primary,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.lg,
    ...kinetic.shadows.soft,
  },
  captureButtonDisabled: {
    opacity: 0.7,
  },
  captureButtonText: {
    color: "#FFFFFF",
    fontFamily: fonts.bold,
    fontSize: fontSizes.FONT18,
  },
  tipsTitle: {
    color: kinetic.colors.onSurface,
    fontFamily: fonts.bold,
    fontSize: fontSizes.FONT24,
  },
  tipRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
  },
  tipIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  tipText: {
    flex: 1,
    color: kinetic.colors.onSurfaceVariant,
    fontFamily: fonts.medium,
    fontSize: fontSizes.FONT16,
    lineHeight: 24,
  },
  bottomBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.md,
    paddingBottom: Platform.OS === "ios" ? spacing.xxl : spacing.lg,
    backgroundColor: "rgba(255,255,255,0.92)",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    ...kinetic.shadows.ambient,
  },
  backFab: {
    width: 44,
    height: 44,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  submitButton: {
    flex: 1,
    height: 76,
    borderRadius: 999,
    backgroundColor: kinetic.colors.primary,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: spacing.sm,
  },
  submitButtonDisabled: {
    opacity: 0.55,
  },
  submitText: {
    color: "#FFFFFF",
    fontFamily: fonts.bold,
    fontSize: fontSizes.FONT18,
    textAlign: "center",
    letterSpacing: 0.8,
  },
});
