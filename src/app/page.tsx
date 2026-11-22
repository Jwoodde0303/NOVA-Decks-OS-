import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/request-context";
import { listUserCompanies } from "@/modules/core/context";

export default async function Home() {
  const user = await getSessionUser();
  if (!user) redirect("/sign-in");
  const companies = await listUserCompanies(user.id);
  if (companies.length === 1) redirect(`/c/${companies[0]!.slug}`);
  redirect("/workspaces");
}
