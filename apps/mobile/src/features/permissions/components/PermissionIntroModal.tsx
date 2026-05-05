import { Pressable, StyleSheet, Text, View } from "react-native";

export type PermissionIntroStep = "notification" | "location";

type PermissionIntroModalProps = {
  step: PermissionIntroStep;
  isRequestingNotificationPermission: boolean;
  isRequestingLocationPermission: boolean;
  onMoveToLocationStep: () => void;
  onRequestNotificationPermission: () => void;
  onRequestLocationPermission: () => void;
  onClose: () => void;
  onOpenSettings: () => void;
};

export function PermissionIntroModal({
  step,
  isRequestingNotificationPermission,
  isRequestingLocationPermission,
  onMoveToLocationStep,
  onRequestNotificationPermission,
  onRequestLocationPermission,
  onClose,
  onOpenSettings,
}: PermissionIntroModalProps) {
  return (
    <View style={styles.permissionIntroOverlay}>
      <View style={styles.permissionIntroCard}>
        {step === "notification" ? (
          <View style={styles.permissionTextWrap}>
            <Text style={styles.permissionRowTitle}>푸시 알림 권한 설정</Text>
            <Text style={styles.permissionRowDescription}>
              리마인드를 더 잘 도와드릴 수 있도록{"\n"}
              푸시 알림을 켜둘까요?
            </Text>
          </View>
        ) : (
          <View style={styles.permissionTextWrap}>
            <Text style={styles.permissionRowTitle}>위치 권한 설정</Text>
            <Text style={styles.permissionRowDescription}>
              캘린더에 날씨 효과를 보여드리기 위해{"\n"}
              위치 권한이 필요해요.
            </Text>
          </View>
        )}

        <View style={styles.permissionFooterActions}>
          {step === "notification" ? (
            <>
              <Pressable style={styles.permissionGhostButton} onPress={onMoveToLocationStep}>
                <Text style={styles.permissionGhostButtonText}>아니요, 다음에요</Text>
              </Pressable>
              <Pressable
                style={styles.permissionPrimaryButton}
                onPress={onRequestNotificationPermission}
                disabled={isRequestingNotificationPermission}
              >
                <Text style={styles.permissionPrimaryButtonText}>
                  {isRequestingNotificationPermission ? "요청 중" : "좋아요, 할게요"}
                </Text>
              </Pressable>
            </>
          ) : (
            <>
              <Pressable style={styles.permissionGhostButton} onPress={onClose}>
                <Text style={styles.permissionGhostButtonText}>아니요, 다음에요</Text>
              </Pressable>
              <Pressable
                style={styles.permissionPrimaryButton}
                onPress={onRequestLocationPermission}
                disabled={isRequestingLocationPermission}
              >
                <Text style={styles.permissionPrimaryButtonText}>
                  {isRequestingLocationPermission ? "요청 중" : "좋아요, 할게요"}
                </Text>
              </Pressable>
            </>
          )}
        </View>

        <Pressable style={styles.permissionSettingsLink} onPress={onOpenSettings}>
          <Text style={styles.permissionSettingsLinkText}>권한은 설정에서 언제든 다시 변경할 수 있어요</Text>
        </Pressable>
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
    flexDirection: "row",
    gap: 8,
  },
  permissionGhostButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#334155",
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    backgroundColor: "#111827",
  },
  permissionGhostButtonText: {
    color: "#CBD5E1",
    fontWeight: "700",
    fontSize: 14,
  },
  permissionPrimaryButton: {
    flex: 1,
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
  permissionSettingsLink: {
    marginTop: 14,
    alignSelf: "center",
  },
  permissionSettingsLinkText: {
    color: "#93C5FD",
    fontSize: 13,
    fontWeight: "500",
  },
});
