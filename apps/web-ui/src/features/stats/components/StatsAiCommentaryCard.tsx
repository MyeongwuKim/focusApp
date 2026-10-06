import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FiChevronDown, FiCpu } from "react-icons/fi";
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
  const [isExpanded, setIsExpanded] = useState(false);

  const commentaryQuery = useQuery({
    queryKey: ["stats-commentary-v13", payload],
    queryFn: () => fetchStatsCommentary(payload),
    enabled: canUseCommentary && !isDataFetching && isExpanded,
    meta: { skipGlobalErrorToast: true },
    staleTime: 60 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 0,
  });

  return (
    <article className="stats-ai-note" data-expanded={isExpanded || undefined}>
      <button
        type="button"
        className="stats-ai-note__toggle"
        onClick={() => setIsExpanded((current) => !current)}
        aria-expanded={isExpanded}
      >
        <span className="stats-ai-note__icon"><FiCpu size={16} /></span>
        <span>
          <strong>이번 기록에서 발견한 점</strong>
          <small>{canUseCommentary ? "AI 한마디 펼쳐보기" : "하루 이상 기록하면 볼 수 있어요"}</small>
        </span>
        <FiChevronDown className="stats-ai-note__chevron" size={17} aria-hidden="true" />
      </button>

      {isExpanded ? (
        <div className="stats-ai-note__body">
          {!canUseCommentary ? (
            <p className="m-0 text-sm text-base-content/70">기록이 쌓이면 이곳에서 짧게 정리해드려요.</p>
          ) : isDataFetching || commentaryQuery.isLoading ? (
            <AiCommentaryLoading />
          ) : commentaryQuery.isError ? (
            <div className="space-y-1">
              <p className="m-0 text-sm text-base-content/70">AI 메시지를 가져오지 못했어요.</p>
              <p className="m-0 text-xs text-base-content/55">잠시 후 다시 펼쳐 확인해 주세요.</p>
            </div>
          ) : (
            <AiCommentaryResult text={commentaryQuery.data ?? ""} />
          )}
        </div>
      ) : null}
    </article>
  );
}
