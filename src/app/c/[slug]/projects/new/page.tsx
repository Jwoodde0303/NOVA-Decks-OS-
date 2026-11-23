import { requireCompanyContext } from "@/lib/request-context";
import { ActionForm } from "@/components/ActionForm";
import { ProjectFields } from "@/components/ProjectForm";
import { PageHeader } from "@/components/ui";
import { createProjectAction } from "../../actions";

export default async function NewProjectPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  await requireCompanyContext(slug);
  return (
    <>
      <PageHeader eyebrow="Projects" title="New project">Link the job from your CRM so estimates and plansets land in the right place.</PageHeader>
      <div className="max-w-[820px]">
        <ActionForm action={createProjectAction.bind(null, slug)} submitLabel="Create project">
          <ProjectFields />
        </ActionForm>
      </div>
    </>
  );
}
