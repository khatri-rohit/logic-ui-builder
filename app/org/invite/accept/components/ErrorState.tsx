import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ReactNode } from "react";

interface ErrorStateProps {
  title?: string;
  message: string;
  action?: ReactNode;
}

export function ErrorState({
  title = "Invitation Error",
  message,
  action,
}: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center gap-4 py-20 text-center">
      <AlertTriangle className="h-12 w-12 text-destructive" />
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="text-muted-foreground max-w-md">{message}</p>
      {action}
    </div>
  );
}

interface InvalidTokenStateProps {
  onGoHome?: () => void;
}

export function InvalidTokenState({ onGoHome }: InvalidTokenStateProps) {
  return (
    <ErrorState
      title="Invalid Invitation"
      message="This invitation link is invalid or has expired."
      action={
        onGoHome ? (
          <Button onClick={onGoHome} variant="outline">
            Go to Dashboard
          </Button>
        ) : undefined
      }
    />
  );
}
