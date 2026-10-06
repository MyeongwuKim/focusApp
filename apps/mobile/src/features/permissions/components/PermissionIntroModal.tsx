import { Pressable, StyleSheet, Text, View } from "react-native";

const NOTEBOOK_RULES = Array.from({ length: 15 }, (_, index) => index);

type PermissionIntroModalProps = {
  isRequestingNotificationPermission: boolean;
  onRequestNotificationPermission: () => void;
};

/**
 * 앱이 시스템 알림 권한을 요청하기 전에 목적을 설명하는 네이티브 안내 화면이다.
 * 버튼을 누르면 부모가 전달한 권한 요청을 실행하며, 요청 중에는 중복 실행을 막는다.
 */
export function PermissionIntroModal({
  isRequestingNotificationPermission,
  onRequestNotificationPermission,
}: PermissionIntroModalProps) {
  return (
    <View style={styles.permissionIntroOverlay}>
      <View pointerEvents="none" style={styles.backgroundMarginLine} />
      {NOTEBOOK_RULES.map((index) => (
        <View
          pointerEvents="none"
          key={`permission-rule-${index}`}
          style={[styles.backgroundRule, { top: 38 + index * 48 }]}
        />
      ))}

      <View style={styles.permissionIntroCard}>
        {/* 위치(날씨) 권한 단계는 잠시 비활성화. 푸시 권한만 노출 */}
        <View style={styles.permissionHeader}>
          <Text style={styles.permissionRowTitle}>알림 설정</Text>
          <View pointerEvents="none" style={styles.permissionTitleUnderline} />
        </View>

        <View style={styles.permissionTextWrap}>
          <Text style={styles.permissionEyebrow}>필요한 순간을 놓치지 않게</Text>
          <Text style={styles.permissionRowDescription}>
            시작 시간과 미완료 할 일을 알려드릴게요.{"\n"}
            알림을 받아볼까요?
          </Text>
        </View>

        <View style={styles.permissionFooterActions}>
          <Pressable
            style={({ pressed }) => [
              styles.permissionPrimaryButtonSingle,
              pressed && styles.permissionPrimaryButtonPressed,
              isRequestingNotificationPermission && styles.permissionPrimaryButtonDisabled,
            ]}
            onPress={onRequestNotificationPermission}
            disabled={isRequestingNotificationPermission}
          >
            <Text style={styles.permissionPrimaryButtonText}>
              {isRequestingNotificationPermission ? "권한 확인 중..." : "알림 허용하기"}
            </Text>
          </Pressable>
          <Text style={styles.permissionFootnote}>나중에 설정에서 언제든 바꿀 수 있어요.</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  permissionIntroOverlay: {
    ...StyleSheet.absoluteFillObject,
    paddingHorizontal: 24,
    backgroundColor: "#F8EDCA",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  backgroundMarginLine: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 58,
    width: 1,
    backgroundColor: "rgba(190, 91, 78, 0.42)",
  },
  backgroundRule: {
    position: "absolute",
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(98, 132, 144, 0.2)",
  },
  permissionIntroCard: {
    width: "100%",
    maxWidth: 430,
    borderRadius: 18,
    backgroundColor: "rgba(255, 250, 231, 0.94)",
    borderWidth: 1,
    borderColor: "rgba(91, 81, 61, 0.2)",
    paddingHorizontal: 22,
    paddingTop: 20,
    paddingBottom: 19,
    shadowColor: "#6A542D",
    shadowOpacity: 0.13,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  permissionHeader: {
    alignItems: "center",
    alignSelf: "center",
    marginBottom: 25,
  },
  permissionTextWrap: {
    alignItems: "center",
    gap: 9,
  },
  permissionRowTitle: {
    zIndex: 1,
    fontSize: 26,
    fontWeight: "700",
    color: "#3F3B32",
    letterSpacing: 0.8,
  },
  permissionTitleUnderline: {
    position: "absolute",
    right: -8,
    bottom: -5,
    left: -8,
    height: 8,
    borderRadius: 8,
    backgroundColor: "rgba(233, 174, 39, 0.52)",
    transform: [{ rotate: "-1.5deg" }],
  },
  permissionEyebrow: {
    fontSize: 17,
    lineHeight: 24,
    fontWeight: "700",
    color: "#4A463C",
    letterSpacing: -0.2,
  },
  permissionRowDescription: {
    fontSize: 14,
    lineHeight: 22,
    color: "rgba(63, 59, 50, 0.68)",
    textAlign: "center",
  },
  permissionFooterActions: {
    marginTop: 26,
    width: "100%",
    alignItems: "center",
  },
  permissionPrimaryButtonSingle: {
    width: "100%",
    minHeight: 48,
    borderRadius: 13,
    borderWidth: 1.5,
    borderColor: "rgba(83, 111, 82, 0.48)",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    backgroundColor: "rgba(132, 160, 126, 0.28)",
    shadowColor: "#54472F",
    shadowOpacity: 0.1,
    shadowRadius: 2,
    shadowOffset: { width: 1, height: 2 },
  },
  permissionPrimaryButtonPressed: {
    transform: [{ translateY: 1 }],
    shadowOpacity: 0.04,
    backgroundColor: "rgba(132, 160, 126, 0.38)",
  },
  permissionPrimaryButtonDisabled: {
    opacity: 0.62,
  },
  permissionPrimaryButtonText: {
    color: "#465B47",
    fontWeight: "700",
    fontSize: 15,
    letterSpacing: 0.2,
  },
  permissionFootnote: {
    marginTop: 11,
    fontSize: 12,
    color: "rgba(63, 59, 50, 0.5)",
  },
});
