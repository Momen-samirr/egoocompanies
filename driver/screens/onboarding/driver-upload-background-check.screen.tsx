import React, { useState } from "react";
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

const NEXT_ROUTE = "/(routes)/driver-upload-license";
const PREVIEW_PLACEHOLDER =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuAOLX5MVDzRxPjbyi69NfHyUY430h1SU_dMsrtmBqZKgKqSrxfY9Egn0zOplbkCHrPYPQ4tNjG7Qrbu7x4Co7o4JcfttSNlbHBwhIhEkzgqeefJolIje00cD27T8XMOs-5n25F9nqEAd2bEAN3CL81Q0ThRz2mk2z6c_FzThInXU3DOO0HfEAtVvJL-0Q9zOpQkyNbvCHAol8Q5_xylu0CGm2ySSGDexfcz4wE1H7OL71RrDDnuQ8De2RsyZV5M14INRVPwrMARUSJ1";

export default function DriverUploadBackgroundCheckScreen() {
  const signupParams = useLocalSearchParams<Record<string, string | string[]>>();
  const [fileUri, setFileUri] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [ready, setReady] = useState(false);

  const normalizedParams = React.useMemo(() => {
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

  const uploadBackgroundCheck = async (uri: string) => {
    try {
      setUploading(true);
      setFileUri(uri);
      const response = await uploadDocument("criminal_record", uri);
      if (!response.success) throw new Error(response.message || "Upload failed");
      setReady(true);
      Toast.show(t("backgroundUploaded"), { type: "success" });
      setTimeout(() => {
        router.push({
          pathname: NEXT_ROUTE as any,
          params: normalizedParams,
        });
      }, 450);
    } catch (error: any) {
      setReady(false);
      Toast.show(error.message || t("backgroundFailed"), { type: "danger" });
    } finally {
      setUploading(false);
    }
  };

  const pickFromCamera = async () => {
    const hasPermission = await requestPermissions();
    if (!hasPermission) return;

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.85,
    });
    if (!result.canceled && result.assets?.[0]?.uri) {
      await uploadBackgroundCheck(result.assets[0].uri);
    }
  };

  const pickFromGallery = async () => {
    const hasPermission = await requestPermissions();
    if (!hasPermission) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.9,
    });
    if (!result.canceled && result.assets?.[0]?.uri) {
      await uploadBackgroundCheck(result.assets[0].uri);
    }
  };

  const onRetake = async () => {
    setReady(false);
    await pickFromCamera();
  };

  const onChooseDifferent = () => {
    Alert.alert(t("chooseFile"), t("selectSource"), [
      { text: t("camera"), onPress: () => void pickFromCamera() },
      { text: t("gallery"), onPress: () => void pickFromGallery() },
      { text: tc("cancel"), style: "cancel" },
    ]);
  };

  const onContinue = () => {
    if (!ready) {
      Toast.show(t("uploadCriminalFirst"), { type: "warning" });
      return;
    }
    router.push({
      pathname: NEXT_ROUTE as any,
      params: normalizedParams,
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton} activeOpacity={0.75}>
            <Ionicons name="arrow-back" size={22} color={kinetic.colors.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Verification</Text>
        </View>
        <View style={styles.stepBadge}>
          <Text style={styles.stepBadgeMain}>2</Text>
          <Text style={styles.stepBadgeSub}>/ 3</Text>
        </View>
      </View>

      <View style={styles.progressTrack}>
        <View style={styles.progressFill} />
      </View>

      <View style={styles.content}>
        <Text style={styles.title}>Criminal Record</Text>
        <Text style={styles.subtitle}>
          Upload your Criminal Record. Make sure all text is readable and the whole document is visible.
        </Text>

        <View style={styles.previewWrap}>
          <Image source={{ uri: fileUri || PREVIEW_PLACEHOLDER }} style={styles.previewImage} resizeMode="cover" />
        </View>

        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.secondaryAction} onPress={onRetake} activeOpacity={0.85} disabled={uploading}>
            <Ionicons name="refresh" size={20} color={kinetic.colors.onSurfaceVariant} />
            <Text style={styles.secondaryActionText}>Retake</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.secondaryAction}
            onPress={onChooseDifferent}
            activeOpacity={0.85}
            disabled={uploading}
          >
            <Ionicons name="document-attach-outline" size={20} color={kinetic.colors.onSurfaceVariant} />
            <Text style={styles.secondaryActionText}>Choose Different</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.qualityCard}>
          <View style={styles.qualityIconWrap}>
            <Ionicons name="information" size={20} color="#FFFFFF" />
          </View>
          <View style={styles.qualityBody}>
            <Text style={styles.qualityTitle}>Quality Check</Text>
            <Text style={styles.qualityBullet}>• No glare or dark shadows</Text>
            <Text style={styles.qualityBullet}>• All four corners are visible</Text>
            <Text style={styles.qualityBullet}>• Issued within last 6 months</Text>
          </View>
        </View>
      </View>

      <View style={styles.bottomBar}>
        <TouchableOpacity style={styles.backFab} onPress={() => router.back()} activeOpacity={0.8}>
          <Ionicons name="arrow-back" size={20} color="#9CA3AF" />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.continueButton, !ready && styles.continueButtonDisabled]}
          onPress={onContinue}
          activeOpacity={0.9}
          disabled={!ready || uploading}
        >
          {uploading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Text style={styles.continueText}>Continue</Text>
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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.md,
  },
  headerLeft: {
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
    color: kinetic.colors.primary,
    fontFamily: fonts.bold,
    fontSize: fontSizes.FONT30,
  },
  stepBadge: {
    backgroundColor: kinetic.colors.surfaceLow,
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  stepBadgeMain: {
    color: kinetic.colors.primary,
    fontFamily: fonts.bold,
    fontSize: fontSizes.FONT14,
  },
  stepBadgeSub: {
    color: kinetic.colors.onSurfaceVariant,
    fontFamily: fonts.medium,
    fontSize: fontSizes.FONT14,
  },
  progressTrack: {
    height: 4,
    width: "100%",
    backgroundColor: "#E7E8E9",
  },
  progressFill: {
    width: "66.66%",
    height: "100%",
    backgroundColor: kinetic.colors.primary,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.md,
  },
  title: {
    color: kinetic.colors.onSurface,
    fontFamily: fonts.bold,
    fontSize: 40,
    marginBottom: spacing.sm,
  },
  subtitle: {
    color: kinetic.colors.onSurfaceVariant,
    fontFamily: fonts.medium,
    fontSize: fontSizes.FONT18,
    lineHeight: 30,
    marginBottom: spacing.lg,
  },
  previewWrap: {
    width: "100%",
    aspectRatio: 3 / 4,
    borderRadius: 24,
    overflow: "hidden",
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: "#A0A4B0",
    backgroundColor: kinetic.colors.surfaceLow,
    marginBottom: spacing.md,
  },
  previewImage: {
    width: "100%",
    height: "100%",
  },
  actionRow: {
    flexDirection: "row",
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  secondaryAction: {
    flex: 1,
    height: 64,
    backgroundColor: kinetic.colors.surfaceLow,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: spacing.sm,
  },
  secondaryActionText: {
    color: kinetic.colors.onSurfaceVariant,
    fontFamily: fonts.bold,
    fontSize: fontSizes.FONT18,
  },
  qualityCard: {
    backgroundColor: "rgba(96,99,238,0.1)",
    borderRadius: 24,
    padding: spacing.lg,
    flexDirection: "row",
    gap: spacing.md,
  },
  qualityIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 999,
    backgroundColor: kinetic.colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  qualityBody: {
    flex: 1,
  },
  qualityTitle: {
    color: "#2F2EBE",
    fontFamily: fonts.bold,
    fontSize: fontSizes.FONT20,
    marginBottom: 4,
  },
  qualityBullet: {
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
  continueButton: {
    flex: 1,
    height: 58,
    borderRadius: 24,
    backgroundColor: kinetic.colors.primary,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: spacing.sm,
  },
  continueButtonDisabled: {
    opacity: 0.55,
  },
  continueText: {
    color: "#FFFFFF",
    fontFamily: fonts.bold,
    fontSize: fontSizes.FONT24,
  },
});
