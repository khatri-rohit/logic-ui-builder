"use client";

import { useEffect, useState } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  useOrgQuery,
  useRemoveMemberMutation,
  useRevokeInviteMutation,
} from "@/lib/org/queries";
import { OrgPageClientProps } from "./types";
import { LoadingState } from "./components/LoadingState";
import { ErrorState } from "./components/ErrorState";
import { OrgHeader } from "./components/OrgHeader";
import { MembersSection } from "./components/MembersSection";
import { InvitationsSection } from "./components/InvitationsSection";
import { InviteFormSection } from "./components/InviteFormSection";
import { SettingsSection } from "./components/SettingsSection";
import { CreateOrgForm } from "./components/CreateOrgForm";
import { toast } from "sonner";
import { useUsageQuery } from "@/lib/billing/queries";
import { useRouter } from "next/navigation";

export default function OrgPageClient({ currentUserId }: OrgPageClientProps) {
  const { data: org, isLoading, error } = useOrgQuery();
  const { data: usage } = useUsageQuery();
  const router = useRouter();

  const { mutateAsync: removeMember } = useRemoveMemberMutation();
  const { mutateAsync: revokeInvite } = useRevokeInviteMutation();

  const [removingId, setRemovingId] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const handleRemoveMember = async (memberId: string) => {
    setRemovingId(memberId);
    try {
      await removeMember(memberId);
      toast.success("Member removed.");
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : "Failed to remove member.",
      );
    } finally {
      setRemovingId(null);
    }
  };

  const handleRevokeInvite = async (inviteId: string) => {
    setRevokingId(inviteId);
    try {
      await revokeInvite(inviteId);
      toast.success("Invitation revoked.");
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : "Failed to revoke invite.",
      );
    } finally {
      setRevokingId(null);
    }
  };

  useEffect(() => {
    if (usage) {
      const { planId } = usage || {};
      if (!planId) {
        router.push("/billing/upgrade");
      } else if (planId === "FREE") {
        router.push("/billing/upgrade");
      }
    }
  }, [router, usage]);

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <LoadingState message="Loading organization..." />
      </div>
    );
  }

  if (error || !org) {
    return (
      <ErrorState
        title="No Organization Found"
        message="You are not part of any organisation yet."
        action={<CreateOrgForm />}
      />
    );
  }

  const canManage = org.userRole === "ADMIN" || org.userRole === "OWNER";

  return (
    <TooltipProvider>
      <div className="space-y-8 p-10">
        <OrgHeader
          name={org.name}
          slug={org.slug}
          seatCount={org.seatCount}
          maxSeats={org.maxSeats}
        />

        <MembersSection
          org={org}
          currentUserId={currentUserId}
          onRemoveMember={handleRemoveMember}
          removingId={removingId}
        />

        <InvitationsSection
          invitations={org.invitations}
          canManage={canManage}
          onRevokeInvite={handleRevokeInvite}
          revokingId={revokingId}
        />

        {canManage && (
          <InviteFormSection
            maxSeats={org.maxSeats}
            seatCount={org.seatCount}
            userRole={org.userRole}
          />
        )}

        <SettingsSection orgName={org.name} userRole={org.userRole} />
      </div>
    </TooltipProvider>
  );
}
