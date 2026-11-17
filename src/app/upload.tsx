import { LimitsLine } from "../components/LimitsLine";
import Constants from "expo-constants";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { router, useLocalSearchParams } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  Body,
  Button,
  Checkbox,
  H1,
  Label,
  Screen,
  StepHeader,
  Tip,
} from "../components/ui";
import { WHO_FOR } from "../data/catalog";
import { problemRoute } from "../lib/errorRoute";
import { useAppState } from "../state/AppState";
import { colors, fonts } from "../theme";

const pawNavy = require("../../assets/images/brand/paw-navy-icon.webp");
const PRIVACY_URL: string =
  Constants.expoConfig?.extra?.privacyPolicyUrl ??
  "https://www.goodwookie.com/terms-and-conditions";

export default function Upload() {
  const { photo, setPhoto, uploadPhoto, who, setWho, whoConsent, setWhoConsent } =
    useAppState();
  const { again } = useLocalSearchParams<{ again?: string }>();
  const [aiConsent, setAiConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  async function pick(source: "camera" | "library") {
    setNotice(null);
    if (source === "camera") {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        setNotice(
          "Camera access is off. You can turn it on in Settings, or choose a photo instead.",
        );
        return;
      }
    }
    const options: ImagePicker.ImagePickerOptions = {
      mediaTypes: ["images"],
      quality: 0.85,
    };
    const result =
      source === "camera"
        ? await ImagePicker.launchCameraAsync(options)
        : await ImagePicker.launchImageLibraryAsync(options);
    if (result.canceled || !result.assets?.[0]) return;
    const a = result.assets[0];
    setPhoto({
      uri: a.uri,
      mimeType: a.mimeType ?? undefined,
      fileName: a.fileName ?? undefined,
    });
  }

  async function onContinue() {
    setBusy(true);
    try {
      await uploadPhoto();
      router.push("/style");
    } catch (e) {
      router.push(problemRoute(e) as never);
    } finally {
      setBusy(false);
    }
  }

  const chosen = WHO_FOR.find((w) => w.id === who) ?? null;
  const ready = !!photo && !!chosen && whoConsent && aiConsent && !busy;

  return (
    <Screen
      footer={
        <>
          <Button
            title={busy ? "Uploading…" : "Continue"}
            disabled={!ready}
            onPress={onContinue}
          />
          <LimitsLine />
        </>
      }
    >
      <StepHeader step={1} />
      <View style={{ gap: 6 }}>
        <H1>Add your photo</H1>
        <Body>
          {again && !photo
            ? "To try another look, add the photo again. We don\u2019t keep your photos on this phone once a design is done."
            : "One photo of one person. You can try every look on it without uploading it again."}
        </Body>
      </View>

      <View style={styles.drop}>
        {photo ? (
          <Image
            source={{ uri: photo.uri }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            accessibilityLabel="Your photo"
          />
        ) : (
          <>
            <Image
              source={pawNavy}
              style={{ width: 48, height: 48 }}
              contentFit="contain"
            />
            <Text style={styles.dropTitle}>One face, close up</Text>
            <Body style={{ textAlign: "center", fontSize: 15 }}>
              A selfie is perfect. So is the photo your mother keeps on the
              fridge.
            </Body>
          </>
        )}
        {busy ? (
          <ActivityIndicator
            style={StyleSheet.absoluteFill}
            color={colors.navy}
          />
        ) : null}
      </View>

      <View style={styles.twoUp}>
        {Platform.OS !== "web" ? (
          <View style={{ flex: 1 }}>
            <Button
              variant="secondary"
              title="Take photo"
              onPress={() => pick("camera")}
            />
          </View>
        ) : null}
        <View style={{ flex: 1 }}>
          <Button
            variant="secondary"
            title="Upload photo"
            onPress={() => pick("library")}
          />
        </View>
      </View>
      {notice ? <Body style={{ color: colors.error }}>{notice}</Body> : null}

      <View style={{ gap: 10 }}>
        <Label>GETTING A GOOD RESULT</Label>
        <Tip strong="Just one person.">
          Head and shoulders, filling most of the frame.
        </Tip>
        <Tip strong="Good light.">
          Face the light, eyes visible. Sunglasses and hats hide what makes
          it you.
        </Tip>
        <Tip strong="Look like yourself.">
          A plain, recent photo beats a filtered one.
        </Tip>
      </View>

      <View style={{ gap: 10 }}>
        <Text nativeID="whoLabel" style={styles.whoLabel}>
          Who is in this photo?
        </Text>
        <View
          style={{ gap: 8 }}
          accessibilityRole="radiogroup"
          accessibilityLabelledBy="whoLabel"
        >
          {WHO_FOR.map((w) => {
            const on = w.id === who;
            return (
              <Pressable
                key={w.id}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
                accessibilityLabel={`${w.title}. ${w.detail}`}
                onPress={() => setWho(w.id)}
                style={[styles.who, on && styles.whoOn]}
              >
                <Text style={[styles.whoTitle, on && { color: colors.cream }]}>
                  {w.title}
                </Text>
                <Text style={[styles.whoDetail, on && { color: colors.cream }]}>
                  {w.detail}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.consent}>
        {chosen ? (
          <Checkbox checked={whoConsent} onChange={setWhoConsent}>
            <Text style={styles.consentText}>{chosen.promise}</Text>
          </Checkbox>
        ) : (
          <Text style={styles.consentText}>
            Choose who is in the photo above. We only make portraits of
            adults, and only with their say-so.
          </Text>
        )}
        <Checkbox checked={aiConsent} onChange={setAiConsent}>
          <Text style={styles.consentText}>
            I agree that this photo, including the face in it, and any text
            I add, is sent to Google&apos;s Gemini AI to create the design and
            run safety checks. It is not used to identify anyone or to train
            AI.{" "}
            <Text
              accessibilityRole="link"
              style={styles.link}
              onPress={() => WebBrowser.openBrowserAsync(PRIVACY_URL)}
            >
              Privacy policy
            </Text>
          </Text>
        </Checkbox>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  drop: {
    height: 170,
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: colors.bronze,
    borderRadius: 20,
    backgroundColor: colors.paper,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    padding: 14,
    overflow: "hidden",
  },
  dropTitle: { fontFamily: fonts.bodySemi, fontSize: 17, color: colors.navy },
  twoUp: { flexDirection: "row", gap: 12 },
  whoLabel: { fontFamily: fonts.bodySemi, fontSize: 16, color: colors.navy },
  who: {
    minHeight: 56,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: colors.agedCream,
    backgroundColor: colors.card,
    gap: 2,
  },
  whoOn: { backgroundColor: colors.navy, borderColor: colors.navy },
  whoTitle: { fontFamily: fonts.bodySemi, fontSize: 16, color: colors.navy },
  whoDetail: { fontFamily: fonts.body, fontSize: 14, color: colors.slate },
  consent: {
    gap: 10,
    padding: 14,
    borderRadius: 14,
    backgroundColor: colors.paper,
  },
  consentText: {
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 20,
    color: colors.navy,
  },
  link: { fontFamily: fonts.bodyBold, textDecorationLine: "underline" },
});
