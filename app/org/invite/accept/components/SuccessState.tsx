import { CheckCircle2 } from "lucide-react";

interface SuccessStateProps {
  message: string;
  redirectUrl?: string;
}

export function SuccessState({
  message,
  redirectUrl = "/",
}: SuccessStateProps) {
  return (
    <div className="flex flex-col items-center gap-4 py-20 text-center">
      <CheckCircle2 className="h-12 w-12 text-green-500" />
      <h3 className="text-lg font-semibold">Success!</h3>
      <p className="text-muted-foreground">{message}</p>
      <p className="text-sm text-muted-foreground">
        Redirecting to {redirectUrl === "/" ? "home" : redirectUrl}...
      </p>
    </div>
  );
}
