import { useEffect, useState } from "react";
import { Button } from "../../../components/ui/Button";
import { requestNotificationPermission } from "../../../utils/notifications";
import { SettingsDetailShell } from "./SettingsDetailShell";

export function SettingsNotificationsView() {
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default");

  useEffect(() => {
    if (typeof window === "undefined" || typeof Notification === "undefined") {
      setPermission("unsupported");
      return;
    }
    setPermission(Notification.permission);
  }, []);

  const handleRequestPermission = () => {
    void (async () => {
      const next = await requestNotificationPermission();
      setPermission(next);
    })();
  };

  const permissionLabel =
    permission === "granted"
      ? "허용됨"
      : permission === "denied"
      ? "차단됨"
      : permission === "unsupported"
      ? "지원 안 됨"
      : "요청 전";

  return (
    <SettingsDetailShell title="알림" description="알림 설정은 다음 단계에서 추가할게요.">
      <div className="space-y-3 rounded-xl border border-base-300/80 bg-base-100/75 p-3">
        <p className="m-0 text-sm text-base-content/70">
          푸시 알림, 일정 리마인더, 방해 금지 시간 설정을 이 화면에 확장할 수 있어요.
        </p>
        <div className="flex items-center justify-between gap-3 rounded-lg border border-base-300/70 bg-base-200/40 px-3 py-2">
          <p className="m-0 text-sm text-base-content/80">브라우저 알림 권한: {permissionLabel}</p>
          <Button size="sm" variant="primary" onClick={handleRequestPermission} disabled={permission !== "default"}>
            권한 요청
          </Button>
        </div>
      </div>
    </SettingsDetailShell>
  );
}
