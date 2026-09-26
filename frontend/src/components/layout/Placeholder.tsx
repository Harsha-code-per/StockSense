import { PageHeader } from './PageHeader';
export function Placeholder({ title }: { title: string }) {
  return (
    <>
      <PageHeader title={title} />
      <div className="rounded-xl border bg-card p-10 text-sm text-muted-foreground">
        This workspace is being prepared. Please check back soon.
      </div>
    </>
  );
}
