import type { Metadata } from "next";
import { AuthenticateWithRedirectCallback } from "@clerk/nextjs";
import AuthShell from "@/components/auth/AuthShell";
import styles from "@/components/auth/auth-theme.module.css";

export const metadata: Metadata = {
  title: "Completing Sign In",
  description: "Completing your secure single sign-on callback for LOGIC.",
  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
};

export default function SsoCallbackPage() {
  return (
    <AuthShell
      mode="sign-in"
      title="Completing Sign In"
      subtitle="Finishing provider sign-in. Keep this tab open."
    >
      <div className={`${styles.callbackCard} logic-auth-body space-y-3`}>
        <p className="logic-mono text-[10px] uppercase tracking-[0.14em] text-(--logic-secondary)">
          Finalizing authentication
        </p>
        <p className="logic-auth-body text-sm text-(--logic-secondary)">
          You will be redirected automatically once this completes.
        </p>
        <div className="h-1.5 overflow-hidden bg-(--logic-border)">
          <div className="h-full w-1/3 animate-pulse bg-(--logic-accent)" />
        </div>
      </div>
      <AuthenticateWithRedirectCallback />
    </AuthShell>
  );
}
