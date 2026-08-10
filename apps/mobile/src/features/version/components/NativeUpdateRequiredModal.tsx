import { Pressable, StyleSheet, Text, View } from "react-native";

type NativeUpdateRequiredModalProps = {
  onUpdatePress: () => void;
};

export function NativeUpdateRequiredModal({
  onUpdatePress,
}: NativeUpdateRequiredModalProps) {
  return (
    <View style={styles.overlay}>
      <View style={styles.card}>
        <View style={styles.textWrap}>
          <Text style={styles.title}>업데이트가 필요해요</Text>
          <Text style={styles.description}>
            최신 버전에 새로운 기능이 포함되어 있어요.{"\n"}
            업데이트 후 다시 실행해주세요.
          </Text>
        </View>

        <View style={styles.footer}>
          <Pressable style={styles.primaryButton} onPress={onUpdatePress}>
            <Text style={styles.primaryButtonText}>업데이트하기</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 40,
    paddingHorizontal: 20,
    backgroundColor: "#0B1220",
    alignItems: "center",
    justifyContent: "center",
  },
  card: {
    width: "100%",
    maxWidth: 430,
    borderRadius: 24,
    backgroundColor: "#0F172A",
    borderWidth: 1,
    borderColor: "#1E293B",
    paddingHorizontal: 18,
    paddingTop: 22,
    paddingBottom: 18,
    shadowColor: "#020817",
    shadowOpacity: 0.35,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
  textWrap: {
    gap: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: "#F8FAFC",
    letterSpacing: -0.3,
  },
  description: {
    fontSize: 15,
    lineHeight: 24,
    color: "#94A3B8",
  },
  footer: {
    marginTop: 22,
    width: "100%",
  },
  primaryButton: {
    width: "100%",
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    backgroundColor: "#2CE6A6",
  },
  primaryButtonText: {
    color: "#052E2B",
    fontWeight: "800",
    fontSize: 14,
  },
});
