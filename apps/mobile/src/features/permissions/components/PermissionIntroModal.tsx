import { Pressable, StyleSheet, Text, View } from "react-native";

type PermissionIntroModalProps = {
  isRequestingNotificationPermission: boolean;
  onRequestNotificationPermission: () => void;
};

export function PermissionIntroModal({
  isRequestingNotificationPermission,
  onRequestNotificationPermission,
}: PermissionIntroModalProps) {
  return (
    <View style={styles.permissionIntroOverlay}>
      <View style={styles.permissionIntroCard}>
        {/* 위치(날씨) 권한 단계는 잠시 비활성화. 푸시 권한만 노출 */}
        <View style={styles.permissionTextWrap}>
          <Text style={styles.permissionRowTitle}>푸시 알림 권한 설정</Text>
          <Text style={styles.permissionRowDescription}>
            오늘 기록 흐름을 놓치지 않도록{"\n"}
            리마인드 알림을 켜둘까요?
          </Text>
        </View>

        <View style={styles.permissionFooterActions}>
          <Pressable
            style={styles.permissionPrimaryButtonSingle}
            onPress={onRequestNotificationPermission}
            disabled={isRequestingNotificationPermission}
          >
            <Text style={styles.permissionPrimaryButtonText}>
              {isRequestingNotificationPermission ? "요청 중" : "좋아요, 할게요"}
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  permissionIntroOverlay: {
    ...StyleSheet.absoluteFillObject,
    paddingHorizontal: 20,
    backgroundColor: "#0B1220",
    alignItems: "center",
    justifyContent: "center",
  },
  permissionIntroCard: {
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
  permissionTextWrap: {
    gap: 8,
  },
  permissionRowTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: "#F8FAFC",
    letterSpacing: -0.3,
  },
  permissionRowDescription: {
    fontSize: 15,
    lineHeight: 24,
    color: "#94A3B8",
  },
  permissionFooterActions: {
    marginTop: 22,
    width: "100%",
  },
  permissionPrimaryButtonSingle: {
    width: "100%",
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    backgroundColor: "#2CE6A6",
  },
  permissionPrimaryButtonText: {
    color: "#052E2B",
    fontWeight: "800",
    fontSize: 14,
  },
});
