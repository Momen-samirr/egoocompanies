import React, { useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Image,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { Toast } from "react-native-toast-notifications";
import { uploadDocument } from "@/services/document.service";
import { kinetic, spacing } from "@/styles/design-system";
import fonts from "@/themes/app.fonts";
import { fontSizes } from "@/themes/app.constant";

const NEXT_ROUTE = "/(routes)/driver-upload-background-check";
const PLACEHOLDER_SELFIE =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuBy_z8hKhPfwXT6QNx3heTz8JztbLuOWTzhwNxSAliaUfiYkvEOmL6hNsytVHuxmyi8q18PJCudVTZNviAmQOXI7w7gEuT9hIdWRJhpIFAUZzEwdjOEffvfi03WVgGV7EFON-nRpTfwVTfn4sqpVIGByPVzWTqT2ma-yfhJodScwTJeXcHUGIBewbDZPnuQsaOLbmGg1PnWsU7gBQ4ckGHg-QNESRDInptFWLG2emtNn5xJWN87s7BBJHcQGHPHiH-ChoYVLhibt_7J";

export default function DriverUploadSelfieScreen() {
  const { t } = useTranslation("documents");
  const { t: tc } = useTranslation("common");
  const { width } = useWindowDimensions();
  const signupParams = useLocalSearchParams<Record<string, string | string[]>>();
  const [selfieUri, setSelfieUri] = useState<string | null>(null);
  const normalizedParams = useMemo(() => {
    const serialized: Record<string, string> = {};
    Object.entries(signupParams).forEach(([key, value]) => {
      serialized[key] = Array.isArray(value) ? String(value[0] || "") : String(value ?? "");
    });
    return serialized;
  }, [signupParams]);

  const [uploading, setUploading] = useState(false);
  const [uploadComplete, setUploadComplete] = useState(false);
  const [hasValidSelfie, setHasValidSelfie] = useState(false);
  const pulse = useRef(new Animated.Value(0.7)).current;

  const frameSize = useMemo(() => Math.min(width * 0.72, 290), [width]);

  React.useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0.7,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [pulse]);

  const ensurePermissions = async () => {
    const camera = await ImagePicker.requestCameraPermissionsAsync();
    const gallery = await ImagePicker.requestMediaLibraryPermissionsAsync();
    const granted = camera.status === "granted" && gallery.status === "granted";
    if (!granted) {
      Toast.show(t("cameraGalleryRequired"), {
        type: "danger",
      });
    }
    return granted;
  };

  const pickFromCamera = async () => {
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });
    if (!result.canceled && result.assets[0]?.uri) {
      await handleUpload(result.assets[0].uri);
    }
  };

  const pickFromGallery = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });
    if (!result.canceled && result.assets[0]?.uri) {
      await handleUpload(result.assets[0].uri);
    }
  };

  const openSourcePicker = async () => {
    const ok = await ensurePermissions();
    if (!ok) return;

    Alert.alert(t("uploadSelfieTitle"), t("chooseSelfieSource"), [
      { text: t("camera"), onPress: pickFromCamera },
      { text: t("gallery"), onPress: pickFromGallery },
      { text: tc("cancel"), style: "cancel" },
    ]);
  };

  const retakeSelfie = async () => {
    const ok = await ensurePermissions();
    if (!ok) return;
    setUploadComplete(false);
    setHasValidSelfie(false);
    await pickFromCamera();
  };

  const isAuthError = (message?: string) => {
    const normalized = (message || "").toLowerCase();
    return normalized.includes("not authenticated") || normalized.includes("unauthorized");
  };

  const handleUpload = async (uri: string) => {
    if (!uri?.trim()) {
      Toast.show(t("invalidSelfie"), { type: "danger" });
      return;
    }

    try {
      setUploading(true);
      setSelfieUri(uri);
      setHasValidSelfie(true);
      const response = await uploadDocument("selfie", uri);
      if (!response.success) {
        throw new Error(response.message || "Upload failed");
      }
      setUploadComplete(true);
      Toast.show(t("selfieUploaded"), { type: "success" });
      setTimeout(() => {
        router.push({
          pathname: NEXT_ROUTE as any,
          params: normalizedParams,
        });
      }, 400);
    } catch (error: any) {
      const message = error?.message || t("failedUploadSelfie");
      setUploadComplete(false);

      if (isAuthError(message)) {
        Toast.show(t("selfieSavedContinue"), {
          type: "warning",
        });
        return;
      }

      setHasValidSelfie(false);
      Toast.show(message, { type: "danger" });
    } finally {
      setUploading(false);
    }
  };

  const handleNext = async () => {
    if (!hasValidSelfie || !selfieUri) {
      Toast.show(t("captureSelfieFirst"), { type: "warning" });
      return;
    }

    // Retry upload on manual Next if capture succeeded but upload was deferred.
    if (!uploadComplete) {
      try {
        setUploading(true);
        const response = await uploadDocument("selfie", selfieUri);
        if (response.success) {
          setUploadComplete(true);
        }
      } catch (error: any) {
        const message = error?.message || t("failedUploadSelfie");
        if (!isAuthError(message)) {
          Toast.show(message, { type: "danger" });
          setUploading(false);
          return;
        }
      } finally {
        setUploading(false);
      }
    }

    router.push({
      pathname: NEXT_ROUTE as any,
      params: {
        ...normalizedParams,
        selfieUri,
      },
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.leftHeader}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backButton}
            activeOpacity={0.75}
          >
            <Ionicons name="arrow-back" size={22} color={kinetic.colors.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Verification</Text>
        </View>
      </View>

      <View style={styles.content}>
        <View style={styles.progressWrap}>
          <View style={styles.progressHeader}>
            <Text style={styles.stepLabel}>Step 1</Text>
            <Text style={styles.ofLabel}>OF 3 STEPS</Text>
          </View>
          <View style={styles.progressTrack}>
            <View style={styles.progressFill} />
          </View>
        </View>

        <View style={styles.copyWrap}>
          <Text style={styles.title}>Capture Profile Photo</Text>
          <Text style={styles.subtitle}>
            Take a clear photo of yourself. Ensure your face is centered and well-lit.
          </Text>
        </View>

        <View style={[styles.previewOuter, { width: frameSize + 20, height: frameSize + 20 }]}>
          <View style={[styles.previewFrame, { width: frameSize, height: frameSize }]}>
            <Image
              source={{ uri: selfieUri || PLACEHOLDER_SELFIE }}
              style={styles.previewImage}
              resizeMode="cover"
            />
            <View style={styles.overlayMask} />
            <View style={styles.alignFaceTag}>
              <Text style={styles.alignFaceText}>ALIGN FACE</Text>
            </View>
          </View>
        </View>

        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={styles.secondaryAction}
            activeOpacity={0.85}
            onPress={retakeSelfie}
            disabled={uploading}
          >
            <View style={styles.secondaryIconWrap}>
              <Ionicons name="refresh" size={22} color="#4B5565" />
            </View>
            <Text style={styles.secondaryText}>Retake</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.primaryAction}
            activeOpacity={0.85}
            onPress={openSourcePicker}
            disabled={uploading}
          >
            <View style={styles.primaryIconWrap}>
              {uploading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Ionicons name="camera" size={22} color="#FFFFFF" />
              )}
            </View>
            <Text style={styles.primaryText}>{uploading ? "Uploading..." : "Capture"}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.tipCard}>
          <Animated.View style={{ opacity: pulse }}>
            <Ionicons name="sunny-outline" size={22} color="#904900" />
          </Animated.View>
          <View style={styles.tipTextWrap}>
            <Text style={styles.tipTitle}>LIGHTING TIP</Text>
            <Text style={styles.tipSubtitle}>
              Avoid backlighting or strong shadows on your face for faster verification.
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.bottomBar}>
        <View style={styles.readyWrap}>
          <Ionicons
            name={hasValidSelfie ? "checkmark-circle" : "ellipse-outline"}
            size={20}
            color={hasValidSelfie ? "#8A98AF" : "#C2C7D1"}
          />
        </View>
        <TouchableOpacity
          style={[styles.nextButton, !hasValidSelfie && styles.nextButtonDisabled]}
          activeOpacity={0.9}
          onPress={handleNext}
          disabled={!hasValidSelfie || uploading}
        >
          <Text style={styles.nextText}>Next Step</Text>
          <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
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
    borderBottomWidth: 1,
    borderBottomColor: "rgba(199,196,215,0.35)",
  },
  leftHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  backButton: {
    width: 34,
    height: 34,
    borderRadius: 999,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    color: kinetic.colors.primary,
    fontFamily: fonts.bold,
    fontSize: fontSizes.FONT30,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.lg,
    alignItems: "center",
  },
  progressWrap: {
    width: "100%",
    marginBottom: spacing.xl,
  },
  progressHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginBottom: spacing.sm,
  },
  stepLabel: {
    fontFamily: fonts.bold,
    color: kinetic.colors.primary,
    fontSize: 40,
  },
  ofLabel: {
    fontFamily: fonts.bold,
    color: kinetic.colors.onSurfaceVariant,
    fontSize: fontSizes.FONT16,
    letterSpacing: 0.6,
  },
  progressTrack: {
    width: "100%",
    height: 8,
    borderRadius: 999,
    backgroundColor: "#E7E8E9",
    overflow: "hidden",
  },
  progressFill: {
    width: "33.33%",
    height: "100%",
    borderRadius: 999,
    backgroundColor: kinetic.colors.primary,
  },
  copyWrap: {
    alignItems: "center",
    marginBottom: spacing.xl,
  },
  title: {
    fontFamily: fonts.bold,
    color: kinetic.colors.onSurface,
    fontSize: 34,
    marginBottom: spacing.sm,
    textAlign: "center",
  },
  subtitle: {
    fontFamily: fonts.medium,
    color: kinetic.colors.onSurfaceVariant,
    fontSize: fontSizes.FONT18,
    lineHeight: 30,
    textAlign: "center",
    maxWidth: 360,
  },
  previewOuter: {
    borderRadius: 999,
    backgroundColor: "rgba(70,72,212,0.08)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: spacing.xl,
  },
  previewFrame: {
    borderRadius: 999,
    overflow: "hidden",
    borderWidth: 4,
    borderColor: "#FFFFFF",
    ...kinetic.shadows.ambient,
  },
  previewImage: {
    width: "100%",
    height: "100%",
  },
  overlayMask: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 20,
    borderColor: "rgba(0,0,0,0.14)",
    borderRadius: 999,
  },
  alignFaceTag: {
    position: "absolute",
    bottom: 20,
    alignSelf: "center",
    backgroundColor: "rgba(0,0,0,0.45)",
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
  },
  alignFaceText: {
    color: "#FFFFFF",
    fontFamily: fonts.bold,
    fontSize: fontSizes.FONT11,
    letterSpacing: 2,
  },
  actionsRow: {
    width: "100%",
    flexDirection: "row",
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  secondaryAction: {
    flex: 1,
    backgroundColor: "#F3F4F5",
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.md,
    minHeight: 108,
  },
  secondaryIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.sm,
  },
  secondaryText: {
    fontFamily: fonts.bold,
    color: kinetic.colors.onSurface,
    fontSize: fontSizes.FONT18,
  },
  primaryAction: {
    flex: 1,
    backgroundColor: kinetic.colors.primary,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.md,
    minHeight: 108,
    ...kinetic.shadows.soft,
  },
  primaryIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.sm,
  },
  primaryText: {
    fontFamily: fonts.bold,
    color: "#FFFFFF",
    fontSize: fontSizes.FONT18,
  },
  tipCard: {
    width: "100%",
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "rgba(199,196,215,0.25)",
    padding: spacing.lg,
    flexDirection: "row",
    gap: spacing.md,
    alignItems: "flex-start",
  },
  tipTextWrap: {
    flex: 1,
  },
  tipTitle: {
    fontFamily: fonts.bold,
    color: kinetic.colors.onSurface,
    fontSize: fontSizes.FONT14,
    letterSpacing: 1,
    marginBottom: 2,
  },
  tipSubtitle: {
    fontFamily: fonts.medium,
    color: kinetic.colors.onSurfaceVariant,
    fontSize: fontSizes.FONT14,
    lineHeight: 20,
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
  readyWrap: {
    width: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  nextButton: {
    flex: 1,
    height: 60,
    borderRadius: 24,
    backgroundColor: kinetic.colors.primary,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: spacing.sm,
  },
  nextButtonDisabled: {
    opacity: 0.55,
  },
  nextText: {
    color: "#FFFFFF",
    fontFamily: fonts.bold,
    fontSize: fontSizes.FONT24,
  },
});
