import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertTriangle, UserMinus, Trash2 } from "lucide-react";
import { useLeaveOrgMutation } from "@/lib/org/queries";
import { LoadingSpinner } from "./LoadingState";

interface LeaveOrgButtonProps {
  disabled: boolean;
}

function LeaveOrgButton({ disabled }: LeaveOrgButtonProps) {
  const [confirm, setConfirm] = useState(false);
  const { mutateAsync: leave, isPending } = useLeaveOrgMutation();

  const handleLeave = async () => {
    if (!confirm) {
      setConfirm(true);
      return;
    }
    try {
      await leave();
      toast.success("You have left the organisation.");
      window.location.href = "/dashboard";
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to leave.");
      setConfirm(false);
    }
  };

  return (
    <div className="space-y-2">
      {confirm ? (
        <div className="flex items-center gap-2">
          <span className="text-sm">Are you sure?</span>
          <Button
            size="sm"
            variant="destructive"
            onClick={handleLeave}
            disabled={isPending}
          >
            {isPending ? <LoadingSpinner className="mr-1" /> : null}
            Yes, leave
          </Button>
          <Button size="sm" variant="outline" onClick={() => setConfirm(false)}>
            Cancel
          </Button>
        </div>
      ) : (
        <Button
          variant="outline"
          onClick={() => handleLeave()}
          disabled={disabled}
        >
          <UserMinus className="h-4 w-4 mr-2" />
          Leave Organisation
        </Button>
      )}
    </div>
  );
}

interface DissolveOrgButtonProps {
  orgName: string;
}

function DissolveOrgButton({ orgName }: DissolveOrgButtonProps) {
  const [confirmName, setConfirmName] = useState("");
  const [isDissolving, setIsDissolving] = useState(false);

  const handleDissolve = async () => {
    if (confirmName !== orgName) return;
    setIsDissolving(true);
    try {
      const res = await fetch("/api/org", { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);
      toast.success("Organisation dissolved.");
      window.location.href = "/dashboard";
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : "Failed to dissolve org.",
      );
      setIsDissolving(false);
    }
  };

  return (
    <div className="space-y-3 rounded-lg border border-destructive/20 bg-destructive/5 p-4">
      <div className="flex items-center gap-2 text-destructive">
        <AlertTriangle className="h-4 w-4" />
        <h4 className="font-semibold">Dissolve Organisation</h4>
      </div>
      <p className="text-sm text-muted-foreground">
        This will permanently delete the organisation and remove all members.
        This action <strong>cannot</strong> be undone.
      </p>
      <div className="space-y-2">
        <p className="text-sm">
          Type <code className="rounded bg-muted px-1 py-0.5">{orgName}</code>{" "}
          to confirm:
        </p>
        <Input
          value={confirmName}
          onChange={(e) => setConfirmName(e.target.value)}
          placeholder={orgName}
          className="max-w-xs"
        />
        <Button
          variant="destructive"
          onClick={handleDissolve}
          disabled={confirmName !== orgName || isDissolving}
        >
          {isDissolving ? (
            <LoadingSpinner className="mr-2" />
          ) : (
            <Trash2 className="h-4 w-4 mr-2" />
          )}
          Dissolve {orgName}
        </Button>
      </div>
    </div>
  );
}

interface SettingsSectionProps {
  orgName: string;
  userRole: "OWNER" | "ADMIN" | "MEMBER";
}

export function SettingsSection({ orgName, userRole }: SettingsSectionProps) {
  const isOwner = userRole === "OWNER";

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold">Settings</h2>
      <div className="rounded-lg border p-4 space-y-4">
        {/* Only show leave button to non-owners, but disable it. Owners must dissolve the org instead. */}
        {!isOwner && <LeaveOrgButton disabled={true} />}
        {isOwner && <DissolveOrgButton orgName={orgName} />}
      </div>
    </section>
  );
}
