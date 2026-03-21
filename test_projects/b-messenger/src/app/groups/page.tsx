import { getGroups } from "@/app/actions/groups";
import GroupsClient from "@/components/groups/GroupsClient";
import { Toaster } from "sonner";

export default async function GroupsPage() {
  const { data } = await getGroups();

  return (
    <div className="container-narrow py-6 md:py-10">
      <Toaster richColors position="top-right" />
      <GroupsClient initialGroups={data ?? []} />
    </div>
  );
}
