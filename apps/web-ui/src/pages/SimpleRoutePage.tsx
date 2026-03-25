type SimpleRoutePageProps = {
  title: string;
};

export function SimpleRoutePage({ title }: SimpleRoutePageProps) {
  return (
    <section className="rounded-2xl border border-base-300 bg-base-200/50 p-4">
      <h2 className="m-0 text-base font-semibold text-base-content">{title}</h2>
      <p className="mt-2 text-sm text-base-content/70">{title} 화면입니다.</p>
    </section>
  );
}
