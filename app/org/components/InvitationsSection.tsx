import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { X } from "lucide-react";
import { OrgInvitation } from "../types";
import { RoleBadge } from "./RoleBadge";
import { LoadingSpinner } from "./LoadingState";

interface InvitationsSectionProps {
  invitations: OrgInvitation[];
  canManage: boolean;
  onRevokeInvite: (inviteId: string) => void;
  revokingId: string | null;
}

export function InvitationsSection({
  invitations,
  canManage,
  onRevokeInvite,
  revokingId,
}: InvitationsSectionProps) {
  if (invitations.length === 0) return null;

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold">Pending Invitations</h2>
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Expires</TableHead>
              {canManage && <TableHead className="w-20">Revoke</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {invitations.map((invite) => (
              <TableRow key={invite.id}>
                <TableCell className="font-medium">{invite.email}</TableCell>
                <TableCell>
                  <RoleBadge role={invite.role} showIcon={false} />
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {new Date(invite.expiresAt).toLocaleDateString()}
                </TableCell>
                {canManage && (
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onRevokeInvite(invite.id)}
                      disabled={revokingId === invite.id}
                      aria-label={`Revoke invitation for ${invite.email}`}
                      title="Revoke invitation"
                    >
                      {revokingId === invite.id ? (
                        <LoadingSpinner />
                      ) : (
                        <X className="h-4 w-4" />
                      )}
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}
