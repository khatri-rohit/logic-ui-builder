"use client";

import { AuthenticateWithRedirectCallback } from "@clerk/nextjs";
import AuthShell from "@/components/auth/AuthShell";
import styles from "@/components/auth/auth-theme.module.css";

export default function SsoCallbackPage() {
  return (
    <AuthShell
      mode="sign-in"
      title="Completing Sign In"
      subtitle="Validating your provider response and restoring your workspace session."
    >
      <div className={`${styles.callbackCard} logic-auth-body space-y-3`}>
        <p
          className={`${styles.labelText} logic-auth-body text-[10px] text-(--logic-secondary)`}
        >
          Finalizing authentication
        </p>
        <p className="logic-auth-body text-sm text-(--logic-on-surface-variant)">
          Do not close this tab. You will be redirected automatically once the
          secure callback handshake completes.
        </p>
        <div className="h-1.5 overflow-hidden rounded-full bg-[rgba(169,180,185,0.35)]">
          <div className="h-full w-1/3 animate-pulse rounded-full bg-(--logic-primary-fixed)" />
        </div>
      </div>
      <AuthenticateWithRedirectCallback />
    </AuthShell>
  );
}
