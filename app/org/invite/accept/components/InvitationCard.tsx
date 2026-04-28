import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Users, ShieldCheck, Crown } from "lucide-react";
import { cn } from "@/lib/utils";

interface InvitationCardProps {
  orgName?: string;
  invitedBy?: string;
  role?: string;
  onAccept: () => void;
  onDecline?: () => void;
  isLoading?: boolean;
}

const ROLE_CONFIG = {
  OWNER: {
    label: "Owner",
    icon: Crown,
    description: "Full access to manage the organization",
  },
  ADMIN: {
    label: "Admin",
    icon: ShieldCheck,
    description: "Manage members and settings",
  },
  MEMBER: {
    label: "Member",
    icon: Users,
    description: "Access organization resources",
  },
};

export function InvitationCard({
  orgName = "Organization",
  invitedBy,
  role = "MEMBER",
  onAccept,
  onDecline,
  isLoading = false,
}: InvitationCardProps) {
  const roleKey: keyof typeof ROLE_CONFIG =
    role === "OWNER" || role === "ADMIN" || role === "MEMBER" ? role : "MEMBER";
  const roleConfig = ROLE_CONFIG[roleKey];
  const Icon = roleConfig.icon;
  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
          <Icon className="h-8 w-8 text-primary" />
        </div>
        <CardTitle>You&apos;re Invited!</CardTitle>
        <CardDescription>
          {invitedBy
            ? `${invitedBy} has invited you to join`
            : "You've been invited to join"}{" "}
          <span className="font-semibold">{orgName}</span>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Your Role</span>
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium",
                roleKey === "OWNER" &&
                  "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
                roleKey === "ADMIN" &&
                  "bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-400",
                roleKey === "MEMBER" &&
                  "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
              )}
            >
              <Icon className="h-3 w-3" />
              {roleConfig.label}
            </span>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            {roleConfig.description}
          </p>
        </div>
        <div className="rounded-lg bg-muted p-4">
          <p className="text-sm text-muted-foreground">
            By accepting this invitation, you&apos;ll gain access to the
            organization&apos;s projects, team members, and shared resources.
          </p>
        </div>
      </CardContent>
      <CardFooter className="flex gap-3">
        {onDecline && (
          <Button
            variant="outline"
            className="flex-1"
            onClick={onDecline}
            disabled={isLoading}
          >
            Decline
          </Button>
        )}
        <Button className="flex-1" onClick={onAccept} disabled={isLoading}>
          {isLoading ? "Accepting..." : "Accept Invitation"}
        </Button>
      </CardFooter>
    </Card>
  );
}
