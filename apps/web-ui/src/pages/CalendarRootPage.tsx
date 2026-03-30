import { useEffect, useState } from "react";
import { CalendarPage } from "../features/calendar/components/CalendarPage";
import { FooterBar } from "../features/calendar/components/FooterBar";
import { PageHeader } from "../components/PageHeader";
import { MAIN_ROUTE } from "../routes/route-config";
import { shiftMonth } from "../utils/calendar";
import { fetchKoreanHolidays, formatDateKey, type HolidaysByDate } from "../utils/holidays";
import { toast, useAppStore } from "../stores";
import { useAppNavigation } from "../providers/AppNavigationProvider";

type CalendarRootPageProps = {
  isOverlayActive: boolean;
};

export function CalendarRootPage({ isOverlayActive }: CalendarRootPageProps) {
  const { openMenu, goMain, goSettings, openTasksForDate } = useAppNavigation();
  const viewMonth = useAppStore((state) => state.viewMonth);
  const setViewMonth = useAppStore((state) => state.setViewMonth);
  const setSelectedDateKey = useAppStore((state) => state.setSelectedDateKey);
  const [holidaysByDate, setHolidaysByDate] = useState<HolidaysByDate>({});

  useEffect(() => {
    const prevMonth = shiftMonth(viewMonth, -1);
    const nextMonth = shiftMonth(viewMonth, 1);
    const targetYears = Array.from(
      new Set([viewMonth.getFullYear(), prevMonth.getFullYear(), nextMonth.getFullYear()])
    );

    let cancelled = false;

    const loadHolidays = async () => {
      try {
        const holidayMaps = await Promise.all(
          targetYears.map(async (year) => fetchKoreanHolidays(year))
        );
        if (cancelled) {
          return;
        }

        const merged = holidayMaps.reduce(
          (acc, holidayMap) => ({ ...acc, ...holidayMap }),
          {} as HolidaysByDate
        );
        setHolidaysByDate(merged);
      } catch (error) {
        toast.error("공휴일 데이터를 가져오지 못했어요.", "불러오기 실패");
        console.warn("Failed to load KR holidays", error);
      }
    };

    loadHolidays();

    return () => {
      cancelled = true;
    };
  }, [viewMonth]);

  const goToday = () => {
    const now = new Date();
    setViewMonth(new Date(now.getFullYear(), now.getMonth(), 1));
    setSelectedDateKey(formatDateKey(now));
  };

  return (
    <>
      <PageHeader
        route={MAIN_ROUTE}
        month={viewMonth}
        onMonthChange={setViewMonth}
        onOpenMenu={openMenu}
        onGoMain={goMain}
        onGoSettings={goSettings}
      />

      <CalendarPage
        month={viewMonth}
        onMonthChange={setViewMonth}
        holidaysByDate={holidaysByDate}
        isActive={!isOverlayActive}
        onOpenTasksForDate={openTasksForDate}
      />
      <FooterBar onGoToday={goToday} />
    </>
  );
}
