import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FiCpu } from "react-icons/fi";
import type { StatsCommentaryPayload } from "../../../api/statsCommentaryApi";
import { fetchStatsCommentary } from "../../../api/statsCommentaryApi";

function AiCommentaryLoading() {
  return (
    <div className="mt-2 flex items-center gap-2 rounded-lg border border-base-300/70 bg-base-100/60 px-3 py-2">
      <span className="ai-bot-wiggle inline-flex h-8 w-8 items-center justify-center rounded-full bg-info/15 text-info">
        <FiCpu size={16} />
      </span>
      <p className="m-0 text-sm text-base-content/75">
        로봇이 한마디를 생각 중이에요
        <span className="ml-1 inline-flex">
          {[0, 1, 2].map((index) => (
            <span
              key={index}
              className="inline-block animate-bounce"
              style={{ animationDelay: `${index * 140}ms`, animationDuration: "1s" }}
            >
              .
            </span>
          ))}
        </span>
      </p>
    </div>
  );
}

function AiCommentaryResult({ text }: { text: string }) {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const labels = ["요약", "잘한점", "아쉬운점", "플래너조언"] as const;
  const sections = lines.map((line, index) => {
    const inlineMatch = line.match(/^([^:]+):\s*(.+)$/);
    if (inlineMatch) {
      return { title: inlineMatch[1].trim(), body: inlineMatch[2].trim() };
    }
    return { title: labels[index] ?? "요약", body: line };
  });

  return (
    <div className="mt-2 rounded-lg border border-info/30 bg-base-100/75 px-3 py-2.5">
      {sections.map((section, index) => (
        <div key={`${section.title}-${index}`} className={index === 0 ? "" : "mt-1.5"}>
          <p className="m-0 text-sm font-semibold leading-6 text-base-content/88 break-words">
            {section.title}
          </p>
          <p className="m-0 mt-0.5 text-sm leading-6 text-base-content/80 break-words">{section.body}</p>
        </div>
      ))}
    </div>
  );
}

type StatsAiCommentaryCardProps = {
  payload: StatsCommentaryPayload;
  isDataFetching: boolean;
  canUseCommentary: boolean;
};

export function StatsAiCommentaryCard({
  payload,
  isDataFetching,
  canUseCommentary,
}: StatsAiCommentaryCardProps) {
  const sectionRef = useRef<HTMLElement | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const target = sectionRef.current;
    if (!target || isVisible) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.some((entry) => entry.isIntersecting);
        if (visible) {
          setIsVisible(true);
        }
      },
      { root: null, threshold: 0.15 }
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [isVisible]);

  const commentaryQuery = useQuery({
    queryKey: ["stats-commentary-v5", payload],
    queryFn: () => fetchStatsCommentary(payload),
    enabled: canUseCommentary && !isDataFetching && isVisible,
    meta: { skipGlobalErrorToast: true },
    staleTime: 60 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 0,
  });

  return (
    <article ref={sectionRef} className="rounded-xl border border-base-300/80 bg-base-200/40 p-3">
      <h3 className="text-sm font-semibold text-base-content/85">AI 한마디</h3>
      {!canUseCommentary ? (
        <div className="mt-2 flex items-center gap-2 rounded-lg border border-base-300/70 bg-base-100/60 px-3 py-2">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-info/15 text-info">
            <FiCpu size={16} />
          </span>
          <p className="m-0 text-sm text-base-content/75">하루 이상 기록해야 AI 한마디를 볼 수 있어요.</p>
        </div>
      ) : !isVisible ? (
        <p className="mt-2 text-sm text-base-content/60">이 영역에 오면 코멘트를 불러와요.</p>
      ) : commentaryQuery.isLoading ? (
        <AiCommentaryLoading />
      ) : commentaryQuery.isError ? (
        <div className="mt-2 space-y-1">
          <p className="text-sm text-base-content/70">AI 메시지를 가져오는데 실패했습니다.</p>
          <p className="text-xs text-base-content/55">잠시 후 다시 시도해 주세요.</p>
        </div>
      ) : (
        <AiCommentaryResult text={commentaryQuery.data ?? ""} />
      )}
    </article>
  );
}
