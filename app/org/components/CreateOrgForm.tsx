import { FormEvent, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCreateOrgMutation } from "@/lib/org/queries";
import { LoadingSpinner } from "./LoadingState";
import logger from "@/lib/logger";

export function CreateOrgForm() {
  const [name, setName] = useState("");
  const { mutateAsync: createOrg, isPending } = useCreateOrgMutation();

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (trimmedName.length < 2) {
      toast.error("Organisation name must be at least 2 characters.");
      return;
    }
    try {
      await createOrg(trimmedName);
      toast.success("Organisation created!");
    } catch (err: unknown) {
      logger.error("Failed to create organisation", { error: err });
      toast.error(err instanceof Error ? err.message : "Failed to create org.");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex items-end gap-2">
      <div className="space-y-1">
        <label htmlFor="org-name" className="text-sm font-medium">
          Organisation name
        </label>
        <Input
          id="org-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Acme Design Co."
          className="w-64"
          required
          minLength={2}
        />
      </div>
      <Button type="submit" disabled={isPending}>
        {isPending && <LoadingSpinner className="mr-2" />}
        Create Organisation
      </Button>
    </form>
  );
}
