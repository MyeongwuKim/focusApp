import { useState } from "react";
import { FiChevronRight, FiUserX } from "react-icons/fi";
import { deleteAccount } from "../../../api/authApi";
import { useAppNavigation } from "../../../providers/AppNavigationProvider";
import { confirm, toast } from "../../../stores";
import { getUserFacingErrorMessage } from "../../../utils/errorMessage";
import { SettingsDetailShell } from "./SettingsDetailShell";

export function SettingsAccountView() {
  const { goPage } = useAppNavigation();
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeleteAccount = async () => {
    if (isDeleting) {
      return;
    }

    const accepted = await confirm({
      title: "계정을 삭제할까요?",
      message: "삭제하면 할일, 메모, 통계, 알림 설정이 함께 삭제되고 복구할 수 없어요.",
      buttons: [
        { label: "취소", value: "cancel", tone: "neutral" },
        { label: "삭제", value: "delete", tone: "danger" },
      ],
    });
    if (accepted !== "delete") {
      return;
    }

    setIsDeleting(true);
    try {
      await deleteAccount();
      toast.positive("계정 및 데이터가 삭제되었어요.", "삭제 완료");
      goPage("/login", { replace: true });
    } catch (error) {
      const message = getUserFacingErrorMessage(error, "계정 삭제 중 오류가 발생했어요.");
      toast.error(message, "삭제 실패");
    } finally {
      setIsDeleting(false);
    }
  };

  const deleteCard = (
    <button
      type="button"
      className="flex w-full items-center gap-3 rounded-xl border border-base-300/80 bg-base-100/75 px-3 py-3.5 text-left"
      disabled={isDeleting}
      onClick={() => {
        void handleDeleteAccount();
      }}
    >
      <span className="grid h-8 w-8 place-items-center rounded-lg bg-error/15 text-error">
        <FiUserX size={16} />
      </span>
      <span className="min-w-0 flex-1 space-y-0.5">
        <span className="block text-sm font-semibold leading-tight text-error">
          {isDeleting ? "계정 및 데이터 삭제 중..." : "계정 및 데이터 삭제"}
        </span>
        <span className="block text-xs leading-tight text-base-content/60">
          삭제 시 계정 데이터가 함께 삭제되며 복구할 수 없어요.
        </span>
      </span>
      <FiChevronRight size={18} className="text-base-content/45" />
    </button>
  );

  return <SettingsDetailShell description="계정 정보를 설정합니다.">{deleteCard}</SettingsDetailShell>;
}
