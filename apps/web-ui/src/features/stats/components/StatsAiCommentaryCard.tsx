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

  const resolveStyle = (title: string) => {
    if (title.startsWith("1) 한줄요약") || title.startsWith("한줄요약:")) {
      return "border-primary/45 bg-primary/8";
    }
    if (title.startsWith("2) 잘한점") || title.startsWith("잘한점:")) {
      return "border-success/45 bg-success/8";
    }
    if (title.startsWith("3) 미완료패턴") || title.startsWith("미완료패턴:")) {
      return "border-warning/45 bg-warning/8";
    }
    if (title.startsWith("4) 개선포인트") || title.startsWith("개선포인트:")) {
      return "border-error/45 bg-error/7";
    }
    if (title.startsWith("5) 다음한걸음") || title.startsWith("다음한걸음:")) {
      return "border-info/45 bg-info/8";
    }
    return "border-base-300/80 bg-base-100/60";
  };

  const sections: Array<{ title: string; body: string }> = [];
  let current: { title: string; body: string } | null = null;

  lines.forEach((line) => {
    const isHeading = /^(\d+\)\s*)?[^:]+:\s*$/.test(line);
    const inlineMatch = line.match(/^(\d+\)\s*[^:]+:)\s*(.+)$/);

    if (inlineMatch) {
      if (current) {
        sections.push(current);
      }
      current = { title: inlineMatch[1], body: inlineMatch[2] };
      return;
    }

    if (isHeading) {
      if (current) {
        sections.push(current);
      }
      current = { title: line, body: "" };
      return;
    }

    if (!current) {
      current = { title: "요약", body: line };
      return;
    }

    current.body = current.body ? `${current.body} ${line}` : line;
  });

  if (current) {
    sections.push(current);
  }

  return (
    <div className="mt-2 space-y-1.5">
      {sections.map((section, index) => (
        <article
          key={`${section.title}-${index}`}
          className={`rounded-md border-l-[3px] px-2.5 py-1.5 ${resolveStyle(section.title)}`}
        >
          <p className="m-0 text-sm font-semibold leading-6 text-base-content/85 break-words">
            {section.title}
          </p>
          {section.body ? (
            <p className="m-0 mt-0.5 text-sm leading-6 text-base-content/82 break-words">
              {section.body}
            </p>
          ) : null}
        </article>
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
    queryKey: ["stats-commentary", payload],
    queryFn: () => fetchStatsCommentary(payload),
    enabled: canUseCommentary && !isDataFetching && isVisible,
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
          <p className="text-sm text-base-content/70">
            이번 주 흐름은 나쁘지 않아요. 작은 목표 하나만 더 정해서 이어가봐요.
          </p>
          <p className="text-xs text-base-content/55">
            {(commentaryQuery.error as Error | null)?.message ?? "AI 코멘트 생성 중 오류"}
          </p>
        </div>
      ) : (
        <AiCommentaryResult text={commentaryQuery.data ?? ""} />
      )}
    </article>
  );
}
