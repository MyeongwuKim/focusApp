import { useLocation } from "react-router-dom";
import { RoutineManageView } from "../features/routine/components/RoutineManageView";

type RoutineRoutePageProps = {
  forcedPathname?: string;
};

export function RoutineRoutePage({ forcedPathname }: RoutineRoutePageProps) {
  const location = useLocation();
  const pathname = forcedPathname ?? location.pathname;

  return (
    <div className="min-h-0 h-full overflow-hidden px-0.5 pt-1 pb-0">
      <RoutineManageView forcedPathname={pathname} />
    </div>
  );
}
