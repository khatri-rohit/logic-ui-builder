import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useInviteMemberMutation } from "@/lib/org/queries";
import { InviteFormProps } from "../types";
import { LoadingSpinner } from "./LoadingState";

export function InviteFormSection({
  maxSeats,
  seatCount,
  userRole,
}: InviteFormProps) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"ADMIN" | "MEMBER">("MEMBER");
  const [error, setError] = useState<string | null>(null);

  const { mutateAsync: invite, isPending } = useInviteMemberMutation();

  const isFull = seatCount >= maxSeats;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await invite({ email, role });
      setEmail("");
      toast.success(`Invitation sent to ${email}`);
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Failed to send invitation.";
      setError(msg);
    }
  };

  if (userRole === "MEMBER") return null;

  if (isFull) {
    return (
      <div className="rounded-lg border border-orange-200 bg-orange-50 p-4 dark:border-orange-900 dark:bg-orange-950/30">
        <p className="text-sm text-orange-700 dark:text-orange-400">
          Seat limit reached ({seatCount}/{maxSeats}). Remove a member or
          dissolve the org to invite new people.
        </p>
      </div>
    );
  }

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold">Invite Member</h2>
      <div className="rounded-lg border p-4">
        <form onSubmit={handleSubmit} className="flex gap-2 items-end">
          <div className="flex-1 space-y-1">
            <label htmlFor="invite-email" className="text-sm font-medium">
              Email address
            </label>
            <Input
              id="invite-email"
              type="email"
              placeholder="colleague@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="w-32 space-y-1">
            <label htmlFor="invite-role" className="text-sm font-medium">
              Role
            </label>
            <Select
              value={role}
              onValueChange={(v) => setRole(v as "ADMIN" | "MEMBER")}
            >
              <SelectTrigger id="invite-role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="MEMBER">Member</SelectItem>
                  <SelectItem value="ADMIN">Admin</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" disabled={isPending}>
            {isPending && <LoadingSpinner className="mr-2" />}
            Send Invite
          </Button>
          {error && (
            <p className="col-span-full text-sm text-destructive">{error}</p>
          )}
        </form>
      </div>
    </section>
  );
}
