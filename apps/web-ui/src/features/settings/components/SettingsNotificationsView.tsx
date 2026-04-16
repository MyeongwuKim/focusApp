import { useEffect, useRef, useState } from "react";
import { PermissionToggleButton } from "../../../components/ui/PermissionToggleButton";
import {
  getNativeExpoPushToken,
  getNotificationPermissionStatus,
  openAppPermissionSettings,
} from "../../../utils/notifications";
import { SettingsDetailShell } from "./SettingsDetailShell";
import { SegmentedToggle } from "../../../components/SegmentedToggle";
import { TimePickerBottomSheet } from "../../../components/TimePickerBottomSheet";
import {
  useNotificationSettingsMutation,
  useNotificationSettingsQuery,
  usePushDeviceTokenMutation,
} from "../../../queries";
import { toast } from "../../../stores";
import { getUserFacingErrorMessage } from "../../../utils/errorMessage";

type ReminderIntervalOption = "1" | "30" | "60" | "90" | "120";
type ActiveDayMode = "weekday" | "everyday";
type PreviewTone = "soft" | "balanced" | "firm";
type NotificationTypeKey = "restEnd" | "incomplete" | "focusStart";
type TimePickerTarget = "start" | "end";

type NotificationTypeState = Record<NotificationTypeKey, boolean>;

const PREVIEW_COPY: Record<PreviewTone, Record<NotificationTypeKey, string>> = {
  soft: {
    restEnd: "휴식이 끝났어요. 천천히 다시 집중해볼까요?",
    incomplete: "아직 진행하지 않은 작업이 있어요. 가볍게 시작해볼까요?",
    focusStart: "집중 시간이에요. 오늘 목표부터 차분히 시작해볼까요?",
  },
  balanced: {
    restEnd: "휴식이 끝났어요. 지금 다시 집중을 시작해보세요.",
    incomplete: "아직 진행 중인 작업이 남아 있어요. 지금 이어가면 흐름을 유지할 수 있어요.",
    focusStart: "집중 시작 시간입니다. 우선순위 작업부터 진행해보세요.",
  },
  firm: {
    restEnd: "휴식 종료. 지금 바로 작업으로 복귀해 주세요.",
    incomplete: "진행 중인 작업이 남아 있습니다. 지금 바로 시작해 주세요.",
    focusStart: "집중 시작 시간입니다. 즉시 핵심 작업을 시작해 주세요.",
  },
};

export function SettingsNotificationsView() {
  const { notificationSettingsQuery } = useNotificationSettingsQuery();
  const { updateNotificationSettingsMutation } = useNotificationSettingsMutation();
  const { registerPushDeviceTokenMutation } = usePushDeviceTokenMutation();

  const [isPermissionLoading, setIsPermissionLoading] = useState(true);
  const [isOn, setIsOn] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState("unknown");
  const [reminderInterval, setReminderInterval] = useState<ReminderIntervalOption>("60");
  const [activeStartTime, setActiveStartTime] = useState("09:00");
  const [activeEndTime, setActiveEndTime] = useState("23:00");
  const [timePickerTarget, setTimePickerTarget] = useState<TimePickerTarget | null>(null);
  const [activeDayMode, setActiveDayMode] = useState<ActiveDayMode>("weekday");
  const [previewTone, setPreviewTone] = useState<PreviewTone>("soft");
  const [notificationTypes, setNotificationTypes] = useState<NotificationTypeState>({
    restEnd: true,
    incomplete: true,
    focusStart: true,
  });
  const [hasHydratedFromServer, setHasHydratedFromServer] = useState(false);
  const lastSavedPayloadRef = useRef<string>("");
  const lastRegisteredPushTokenRef = useRef<string>("");
  const hasTriedPushTokenRegistrationRef = useRef(false);

  useEffect(() => {
    const settings = notificationSettingsQuery.data;
    if (!settings || hasHydratedFromServer) {
      return;
    }

    const normalizedInterval = [1, 30, 60, 90, 120].includes(settings.intervalMinutes)
      ? (String(settings.intervalMinutes) as ReminderIntervalOption)
      : "60";
    const normalizedDayMode = settings.dayMode === "everyday" ? "everyday" : "weekday";
    const normalizedTone = (
      settings.tone === "balanced" || settings.tone === "firm" ? settings.tone : "soft"
    ) as PreviewTone;

    setIsOn(settings.pushEnabled);
    setReminderInterval(normalizedInterval);
    setActiveStartTime(settings.activeStartTime || "09:00");
    setActiveEndTime(settings.activeEndTime || "23:00");
    setActiveDayMode(normalizedDayMode);
    setPreviewTone(normalizedTone);
    setNotificationTypes({
      restEnd: settings.typeRestEnd,
      incomplete: settings.typeIncomplete,
      focusStart: settings.typeFocusStart,
    });
    setPermissionStatus(settings.systemPermission ?? "unknown");

    lastSavedPayloadRef.current = JSON.stringify({
      pushEnabled: settings.pushEnabled,
      intervalMinutes: settings.intervalMinutes,
      activeStartTime: settings.activeStartTime,
      activeEndTime: settings.activeEndTime,
      dayMode: normalizedDayMode,
      typeRestEnd: settings.typeRestEnd,
      typeIncomplete: settings.typeIncomplete,
      typeFocusStart: settings.typeFocusStart,
      tone: normalizedTone,
      systemPermission: settings.systemPermission ?? "unknown",
    });
    setHasHydratedFromServer(true);
  }, [hasHydratedFromServer, notificationSettingsQuery.data]);

  useEffect(() => {
    if (!notificationSettingsQuery.isError || hasHydratedFromServer) {
      return;
    }

    toast.error("알림 설정을 불러오지 못해 기본값으로 표시 중이에요.", "불러오기 실패");
    lastSavedPayloadRef.current = "";
    setHasHydratedFromServer(true);
  }, [hasHydratedFromServer, notificationSettingsQuery.isError]);

  useEffect(() => {
    let cancelled = false;

    const refreshPermissionStatus = async () => {
      if (!cancelled) {
        setIsPermissionLoading(true);
      }
      const status = await getNotificationPermissionStatus();
      if (cancelled) {
        return;
      }

      setPermissionStatus(status.status || "unknown");
      if (!status.granted) {
        setIsOn(false);
      }
      setIsPermissionLoading(false);
    };

    void refreshPermissionStatus();

    const handleFocus = () => {
      void refreshPermissionStatus();
    };
    window.addEventListener("focus", handleFocus);

    return () => {
      cancelled = true;
      window.removeEventListener("focus", handleFocus);
    };
  }, []);

  useEffect(() => {
    if (!hasHydratedFromServer) {
      return;
    }

    const payload = {
      pushEnabled: isOn,
      intervalMinutes: Number(reminderInterval),
      activeStartTime,
      activeEndTime,
      dayMode: activeDayMode,
      typeRestEnd: notificationTypes.restEnd,
      typeIncomplete: notificationTypes.incomplete,
      typeFocusStart: notificationTypes.focusStart,
      tone: previewTone,
      systemPermission: permissionStatus,
    };

    const serialized = JSON.stringify(payload);
    if (serialized === lastSavedPayloadRef.current) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void updateNotificationSettingsMutation.mutateAsync(payload).then(
        () => {
          lastSavedPayloadRef.current = serialized;
        },
        (error: unknown) => {
          const message = getUserFacingErrorMessage(error, "알림 설정 저장 중 오류가 발생했어요.");
          toast.error(message, "저장 실패");
        }
      );
    }, 300);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [
    activeDayMode,
    activeEndTime,
    activeStartTime,
    hasHydratedFromServer,
    isOn,
    notificationTypes.focusStart,
    notificationTypes.incomplete,
    notificationTypes.restEnd,
    permissionStatus,
    previewTone,
    reminderInterval,
    updateNotificationSettingsMutation,
  ]);

  useEffect(() => {
    if (!hasHydratedFromServer || !isOn || permissionStatus !== "granted") {
      hasTriedPushTokenRegistrationRef.current = false;
      return;
    }
    if (hasTriedPushTokenRegistrationRef.current) {
      return;
    }
    hasTriedPushTokenRegistrationRef.current = true;

    void (async () => {
      const snapshot = await getNativeExpoPushToken();
      if (!snapshot.pushToken) {
        return;
      }
      if (snapshot.pushToken === lastRegisteredPushTokenRef.current) {
        return;
      }

      try {
        await registerPushDeviceTokenMutation.mutateAsync({
          pushToken: snapshot.pushToken,
          platform: snapshot.platform,
        });
        lastRegisteredPushTokenRef.current = snapshot.pushToken;
      } catch (error) {
        const message = getUserFacingErrorMessage(error, "푸쉬 토큰 등록 중 오류가 발생했어요.");
        toast.error(message, "토큰 등록 실패");
        hasTriedPushTokenRegistrationRef.current = false;
      }
    })();
  }, [
    hasHydratedFromServer,
    isOn,
    permissionStatus,
    registerPushDeviceTokenMutation.mutateAsync,
  ]);

  const handleToggle = () => {
    if (isOn) {
      setIsOn(false);
      return;
    }

    if (permissionStatus === "granted") {
      setIsOn(true);
      return;
    }

    openAppPermissionSettings();
  };

  const isLoading = isPermissionLoading || notificationSettingsQuery.isLoading || !hasHydratedFromServer;
  const disabledClassName = isOn ? "" : "opacity-45 pointer-events-none select-none";
  const previewCopy = PREVIEW_COPY[previewTone];

  const toggleNotificationType = (key: NotificationTypeKey) => {
    setNotificationTypes((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  return (
    <SettingsDetailShell title="리마인드 푸쉬알림 설정" description="">
      <div className="space-y-3 rounded-xl border border-base-300/80 bg-base-100/75 p-3">
        <div className="flex items-center justify-between gap-3 rounded-lg border border-base-300/70 bg-base-200/40 px-3 py-2">
          <p className="m-0 text-sm font-medium text-base-content/85">푸쉬알림</p>
          <PermissionToggleButton enabled={isOn} onClick={handleToggle} disabled={isLoading} />
        </div>

        <div className={`space-y-2 rounded-lg border border-base-300/60 bg-base-200/20 p-3 ${disabledClassName}`}>
          <p className="m-0 text-sm font-medium text-base-content/90">리마인드 간격</p>
          <div className="mt-2">
            <SegmentedToggle
              value={reminderInterval}
              options={[
                { value: "1", label: "1분" },
                { value: "30", label: "30분" },
                { value: "60", label: "60분" },
                { value: "90", label: "90분" },
                { value: "120", label: "120분" },
              ]}
              onChange={setReminderInterval}
            />
          </div>
        </div>

        <div className={`space-y-2 rounded-lg border border-base-300/60 bg-base-200/20 p-3 ${disabledClassName}`}>
          <p className="m-0 text-sm font-medium text-base-content/90">알림 활성화 시간대</p>
          <div className="mt-2 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
            <button
              type="button"
              className="input input-bordered input-sm flex h-9 min-h-9 w-full min-w-0 items-center justify-between bg-base-100 px-3 text-left text-sm font-medium"
              onClick={() => setTimePickerTarget("start")}
            >
              <span>{activeStartTime}</span>
              <span className="text-xs text-base-content/45">시작</span>
            </button>
            <span className="px-1 text-sm text-base-content/60">~</span>
            <button
              type="button"
              className="input input-bordered input-sm flex h-9 min-h-9 w-full min-w-0 items-center justify-between bg-base-100 px-3 text-left text-sm font-medium"
              onClick={() => setTimePickerTarget("end")}
            >
              <span>{activeEndTime}</span>
              <span className="text-xs text-base-content/45">종료</span>
            </button>
          </div>
        </div>

        <div className={`space-y-2 rounded-lg border border-base-300/60 bg-base-200/20 p-3 ${disabledClassName}`}>
          <p className="m-0 text-sm font-medium text-base-content/90">요일 선택</p>
          <div className="mt-2">
            <SegmentedToggle
              value={activeDayMode}
              options={[
                { value: "weekday", label: "평일만" },
                { value: "everyday", label: "매일" },
              ]}
              onChange={setActiveDayMode}
            />
          </div>
        </div>

        <div className={`space-y-2 rounded-lg border border-base-300/60 bg-base-200/20 p-3 ${disabledClassName}`}>
          <p className="m-0 text-sm font-medium text-base-content/90">알림 타입</p>
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <p className="m-0 text-sm text-base-content/80">휴식 종료 알림</p>
              <PermissionToggleButton enabled={notificationTypes.restEnd} onClick={() => toggleNotificationType("restEnd")} />
            </div>
            <div className="flex items-center justify-between gap-3">
              <p className="m-0 text-sm text-base-content/80">미완료 작업 리마인드</p>
              <PermissionToggleButton enabled={notificationTypes.incomplete} onClick={() => toggleNotificationType("incomplete")} />
            </div>
            <div className="flex items-center justify-between gap-3">
              <p className="m-0 text-sm text-base-content/80">집중 시작 리마인드</p>
              <PermissionToggleButton enabled={notificationTypes.focusStart} onClick={() => toggleNotificationType("focusStart")} />
            </div>
          </div>
        </div>

        <div className={`space-y-2 rounded-lg border border-base-300/60 bg-base-200/20 p-3 ${disabledClassName}`}>
          <p className="m-0 text-sm font-medium text-base-content/90">알림 톤 미리보기</p>
          <p className="m-0 text-xs text-base-content/60">원하는 분위기를 고르면 아래 문구가 바로 바뀌어요.</p>
          <div className="mt-2">
            <SegmentedToggle
              value={previewTone}
              options={[
                { value: "soft", label: "포근한 톤" },
                { value: "balanced", label: "기본 톤" },
                { value: "firm", label: "단호한 톤" },
              ]}
              onChange={setPreviewTone}
            />
          </div>
          <div className="mt-2 space-y-2">
            <div className="flex items-start gap-2">
              <span
                className={`mt-1 inline-flex shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
                  notificationTypes.restEnd
                    ? "border-cyan-300/60 bg-cyan-400/20 text-cyan-100"
                    : "border-base-300/60 bg-base-200/40 text-base-content/45"
                }`}
              >
                휴식 종료
              </span>
              <div
                className={`relative flex-1 rounded-xl border px-3 py-2 ${
                  notificationTypes.restEnd
                    ? "border-cyan-300/55 bg-cyan-500/10 text-base-content/90"
                    : "border-base-300/60 bg-base-200/30 text-base-content/40"
                }`}
              >
                <p
                  className={`m-0 text-xs leading-relaxed break-keep ${
                    notificationTypes.restEnd ? "" : "line-through"
                  }`}
                >
                  {previewCopy.restEnd}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2">
              <span
                className={`mt-1 inline-flex shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
                  notificationTypes.incomplete
                    ? "border-violet-300/60 bg-violet-400/20 text-violet-100"
                    : "border-base-300/60 bg-base-200/40 text-base-content/45"
                }`}
              >
                미완료 작업
              </span>
              <div
                className={`relative flex-1 rounded-xl border px-3 py-2 ${
                  notificationTypes.incomplete
                    ? "border-violet-300/55 bg-violet-500/10 text-base-content/90"
                    : "border-base-300/60 bg-base-200/30 text-base-content/40"
                }`}
              >
                <p
                  className={`m-0 text-xs leading-relaxed break-keep ${
                    notificationTypes.incomplete ? "" : "line-through"
                  }`}
                >
                  {previewCopy.incomplete}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2">
              <span
                className={`mt-1 inline-flex shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
                  notificationTypes.focusStart
                    ? "border-emerald-300/60 bg-emerald-400/20 text-emerald-100"
                    : "border-base-300/60 bg-base-200/40 text-base-content/45"
                }`}
              >
                집중 시작
              </span>
              <div
                className={`relative flex-1 rounded-xl border px-3 py-2 ${
                  notificationTypes.focusStart
                    ? "border-emerald-300/55 bg-emerald-500/10 text-base-content/90"
                    : "border-base-300/60 bg-base-200/30 text-base-content/40"
                }`}
              >
                <p
                  className={`m-0 text-xs leading-relaxed break-keep ${
                    notificationTypes.focusStart ? "" : "line-through"
                  }`}
                >
                  {previewCopy.focusStart}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className={`space-y-2 rounded-lg border border-base-300/60 bg-base-200/20 p-3 ${disabledClassName}`}>
          <div className="flex items-center justify-between gap-3">
            <p className="m-0 text-sm text-base-content/70">
              현재 설정: {reminderInterval}분 간격, {activeStartTime}~{activeEndTime},{" "}
              {activeDayMode === "weekday" ? "평일만" : "매일"}
            </p>
          </div>
        </div>
      </div>
      <TimePickerBottomSheet
        isOpen={timePickerTarget !== null}
        title={timePickerTarget === "start" ? "시작 시간 선택" : "종료 시간 선택"}
        initialValue={timePickerTarget === "start" ? activeStartTime : activeEndTime}
        onClose={() => setTimePickerTarget(null)}
        onApply={(next) => {
          if (timePickerTarget === "start") {
            setActiveStartTime(next);
            return;
          }
          setActiveEndTime(next);
        }}
      />
    </SettingsDetailShell>
  );
}
