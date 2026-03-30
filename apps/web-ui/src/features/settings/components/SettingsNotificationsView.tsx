import { SettingsDetailShell } from "./SettingsDetailShell";

export function SettingsNotificationsView() {
  return (
    <SettingsDetailShell title="알림" description="알림 설정은 다음 단계에서 추가할게요.">
      <div className="rounded-xl border border-base-300/80 bg-base-100/75 p-3">
        <p className="m-0 text-sm text-base-content/70">
          푸시 알림, 일정 리마인더, 방해 금지 시간 설정을 이 화면에 확장할 수 있어요.
        </p>
      </div>
    </SettingsDetailShell>
  );
}
