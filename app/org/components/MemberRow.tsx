import { Button } from "@/components/ui/button";
import { TableCell, TableRow } from "@/components/ui/table";
import { Trash2 } from "lucide-react";
import { MemberRowProps } from "../types";
import { RoleBadge } from "./RoleBadge";
import { UserAvatar } from "./UserAvatar";
import { LoadingSpinner } from "./LoadingState";

export function MemberRow({
  membership,
  currentUserId,
  userRole,
  onRemove,
  isRemoving,
}: MemberRowProps) {
  const isSelf = membership.user.id === currentUserId;
  const canRemove =
    (userRole === "OWNER" || userRole === "ADMIN") &&
    membership.role !== "OWNER" &&
    !isSelf;

  return (
    <TableRow>
      <TableCell>
        <div className="flex items-center gap-3">
          <UserAvatar name={membership.user.name} />
          <div>
            <p className="font-medium">
              {membership.user.name}
              {isSelf && (
                <span className="ml-2 text-xs text-muted-foreground">
                  (you)
                </span>
              )}
            </p>
            <p className="text-xs text-muted-foreground">
              {membership.user.email}
            </p>
          </div>
        </div>
      </TableCell>
      <TableCell>
        <RoleBadge role={membership.role} />
      </TableCell>
      <TableCell className="text-xs text-muted-foreground">
        {new Date(membership.joinedAt).toLocaleDateString()}
      </TableCell>
      <TableCell className="text-right">
        {canRemove && (
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive"
            onClick={() => onRemove(membership.id)}
            disabled={isRemoving}
            aria-label={`Remove ${membership.user.name} from organisation`}
            title="Remove member"
          >
            {isRemoving ? <LoadingSpinner /> : <Trash2 className="h-4 w-4" />}
            <span className="sr-only">Remove member</span>
          </Button>
        )}
      </TableCell>
    </TableRow>
  );
}
