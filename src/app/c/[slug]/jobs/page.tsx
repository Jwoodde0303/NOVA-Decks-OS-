import Link from "next/link";
import { requireCompanyContext } from "@/lib/request-context";
import { listJobs } from "@/modules/crm/service";
import { SERVICE_LABEL } from "@/modules/crm/labels";
import { Chip, DateText, Empty, PageHeader } from "@/components/ui";

export default async function JobsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ctx = await requireCompanyContext(slug);
  const rows = await listJobs(ctx);
  const base = `/c/${slug}`;
  return (
    <>
      <PageHeader eyebrow="Production" title="Jobs">Won opportunities converted into jobs. Scheduling and change orders come later.</PageHeader>
      <div className="card overflow-hidden">
        {rows.length === 0 ? (
          <div className="p-4">
            <Empty>No jobs yet. Mark an opportunity Won and convert it.</Empty>
          </div>
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                <th>Job #</th>
                <th>Title</th>
                <th>Customer</th>
                <th>Service</th>
                <th>Status</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.job.id}>
                  <td className="num">
                    <Link href={`${base}/jobs/${r.job.id}`} className="text-slate hover:underline">
                      {r.job.jobNumber}
                    </Link>
                  </td>
                  <td className="font-medium">
                    <Link href={`${base}/jobs/${r.job.id}`} className="hover:underline">
                      {r.job.title}
                    </Link>
                  </td>
                  <td>{r.customerName}</td>
                  <td>{SERVICE_LABEL[r.job.serviceType]}</td>
                  <td>
                    <Chip tone={r.job.status === "active" ? "moss" : "ink"}>{r.job.status}</Chip>
                  </td>
                  <td>
                    <DateText value={r.job.createdAt} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
