"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth, useSignUp } from "@clerk/nextjs";

import styles from "./auth-theme.module.css";
import { cn } from "@/lib/utils";
import logger from "@/lib/logger";

type ClerkFieldError = { message?: string };

type ClerkErrorPayload = {
  global?: ClerkFieldError[];
  fields?: Record<string, ClerkFieldError | ClerkFieldError[] | undefined>;
};

type PendingSessionTask = {
  key?: string;
  type?: string;
  path?: string;
  url?: string;
  redirectUrl?: string;
};

type SessionWithTask = {
  currentTask?: PendingSessionTask | null;
} | null;

function getFieldError(
  errors: ClerkErrorPayload | undefined,
  fieldName: string,
) {
  const fieldError = errors?.fields?.[fieldName];

  if (!fieldError) {
    return "";
  }

  if (Array.isArray(fieldError)) {
    return fieldError
      .map((errorItem) => errorItem.message)
      .filter(Boolean)
      .join(" ");
  }

  return fieldError.message ?? "";
}

function getTaskNavigationTarget(session: SessionWithTask): string | null {
  const task = session?.currentTask;
  if (!task) {
    return null;
  }

  return task.redirectUrl ?? task.url ?? task.path ?? null;
}

type OAuthProvider = "google" | "github";

const OAUTH_STRATEGY_BY_PROVIDER: Record<
  OAuthProvider,
  "oauth_google" | "oauth_github"
> = {
  google: "oauth_google",
  github: "oauth_github",
};

function getOAuthProviderFromParam(value: string | null): OAuthProvider | null {
  if (value === "google" || value === "github") {
    return value;
  }

  return null;
}

export default function CustomSignUpFlow() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isSignedIn } = useAuth();
  const { signUp, errors, fetchStatus } = useSignUp();
  const oauthAutoStartedRef = useRef(false);
  const postAuthHandledRef = useRef(false);

  const [emailAddress, setEmailAddress] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [oauthLoadingProvider, setOauthLoadingProvider] =
    useState<OAuthProvider | null>(null);

  const isLoading = fetchStatus === "fetching";
  const isAnyAuthFlowLoading = isLoading || oauthLoadingProvider !== null;
  const typedErrors = errors as unknown as ClerkErrorPayload | undefined;
  const globalMessages = useMemo(
    () =>
      (typedErrors?.global ?? [])
        .map((errorItem) => errorItem.message)
        .filter(Boolean),
    [typedErrors],
  );

  const isEmailVerificationStep =
    signUp?.status === "missing_requirements" &&
    (signUp?.unverifiedFields ?? []).includes("email_address") &&
    (signUp?.missingFields ?? []).length === 0;
  const preselectedOAuthProvider = useMemo(
    () => getOAuthProviderFromParam(searchParams.get("provider")),
    [searchParams],
  );

  const startOAuthSignUp = async (provider: OAuthProvider) => {
    setStatusMessage("");
    setOauthLoadingProvider(provider);

    try {
      const { error } = await signUp.sso({
        strategy: OAUTH_STRATEGY_BY_PROVIDER[provider],
        redirectUrl: "/",
        redirectCallbackUrl: "/sign-in/sso-callback",
      });

      if (!error) {
        return;
      }

      console.error("Failed to start OAuth sign-up", error);
      setStatusMessage(
        `Unable to start ${provider === "google" ? "Google" : "GitHub"} sign-up. Please retry.`,
      );
      setOauthLoadingProvider(null);
    } catch (error) {
      console.error("Failed to start OAuth sign-up", error);
      setStatusMessage(
        `Unable to start ${provider === "google" ? "Google" : "GitHub"} sign-up. Please retry.`,
      );
      setOauthLoadingProvider(null);
    }
  };

  useEffect(() => {
    if (
      !signUp ||
      !preselectedOAuthProvider ||
      oauthAutoStartedRef.current ||
      isEmailVerificationStep
    ) {
      return;
    }

    oauthAutoStartedRef.current = true;
    void signUp
      .sso({
        strategy: OAUTH_STRATEGY_BY_PROVIDER[preselectedOAuthProvider],
        redirectUrl: "/",
        redirectCallbackUrl: "/sign-in/sso-callback",
      })
      .then(({ error }) => {
        if (error) {
          console.error("Failed to auto-start OAuth sign-up", error);
        }
      })
      .catch((error: unknown) => {
        console.error("Failed to auto-start OAuth sign-up", error);
      });
  }, [isEmailVerificationStep, preselectedOAuthProvider, signUp]);

  const finishSignUp = async () => {
    await signUp.finalize({
      navigate: ({ session, decorateUrl }) => {
        const target =
          getTaskNavigationTarget(session as SessionWithTask) ?? "/";
        const url = decorateUrl(target);

        if (url.startsWith("http")) {
          window.location.href = url;
          return;
        }

        router.push(url);
      },
    });
  };

  const handleSignUp = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatusMessage("");

    if (!signUp) {
      return;
    }

    const { error } = await signUp.password({
      emailAddress,
      password,
    });

    if (error) {
      return;
    }

    try {
      await signUp.verifications.sendEmailCode();
      setStatusMessage("Verification code sent. Check your inbox to continue.");
    } catch (sendError) {
      console.error("Failed to send sign-up verification code", sendError);
      setStatusMessage("Failed to send verification code. Please try again.");
    }
  };

  const handleVerifyCode = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatusMessage("");

    if (!signUp) {
      return;
    }

    try {
      const result = await signUp.verifications.verifyEmailCode({
        code,
      });

      if (result.error) {
        return;
      }
    } catch {
      setStatusMessage("Verification failed. Please try again.");
      return;
    }

    if (signUp.status === "complete") {
      await finishSignUp();
      return;
    }

    setStatusMessage("Verification is not complete yet. Please retry.");
  };

  useEffect(() => {
    if (!signUp || !isSignedIn || postAuthHandledRef.current) return;
    postAuthHandledRef.current = true;

    const pendingPlanId = sessionStorage.getItem("pendingPlanId") as
      | "STANDARD"
      | "PRO"
      | null;
    const inviteToken =
      new URLSearchParams(window.location.search).get("invite_token") ||
      sessionStorage.getItem("pendingInviteToken");

    // Priority: invite > plan > prompt > dashboard
    if (inviteToken) {
      void fetch("/api/org/invite/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: inviteToken }),
      })
        .then(() => sessionStorage.removeItem("pendingInviteToken"))
        .catch(() => {})
        .finally(() => router.replace("/"));
      return;
    }

    if (pendingPlanId) {
      sessionStorage.removeItem("pendingPlanId");
      void fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: pendingPlanId }),
      })
        .then((res) => res.json() as Promise<{ data?: { shortUrl?: string } }>)
        .then((data) => {
          if (data.data?.shortUrl) {
            window.location.href = data.data.shortUrl; // Razorpay hosted checkout
          } else {
            router.replace("/");
          }
        })
        .catch(() => router.replace("/"));
      return;
    }

    router.replace("/");
  }, [isSignedIn, router, signUp]);

  if (!signUp) {
    return (
      <div className="logic-auth-body text-sm text-(--logic-secondary)">
        Loading sign-up...
      </div>
    );
  }

  if (isSignedIn || signUp.status === "complete") {
    return (
      <div className="logic-auth-body text-sm text-(--logic-secondary)">
        Redirecting...
      </div>
    );
  }

  const emailError = getFieldError(typedErrors, "emailAddress");
  const passwordError = getFieldError(typedErrors, "password");
  const codeError = getFieldError(typedErrors, "code");

  return (
    <div className="space-y-5">
      {isEmailVerificationStep ? (
        <form className="space-y-4" onSubmit={handleVerifyCode}>
          <div className="space-y-2">
            <label
              htmlFor="signup-code"
              className={cn(styles.formLabel, "logic-auth-body")}
            >
              Email verification code
            </label>
            <input
              id="signup-code"
              name="code"
              type="text"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              autoComplete="one-time-code"
              required
              className={cn(styles.formInput, "logic-auth-body")}
              placeholder="Enter the 6-digit code"
            />
            {codeError ? (
              <p className="logic-auth-body text-xs text-[#8f1515]">
                {codeError}
              </p>
            ) : null}
          </div>

          <button
            type="submit"
            disabled={isAnyAuthFlowLoading}
            className={cn(styles.formPrimaryButton, "logic-auth-body")}
          >
            {isAnyAuthFlowLoading
              ? "Verifying..."
              : "Verify and create account"}
          </button>

          <button
            type="button"
            onClick={async () => {
              try {
                await signUp.verifications.sendEmailCode();
                setStatusMessage(
                  "Verification code sent. Check your inbox to continue.",
                );
              } catch {
                setStatusMessage(
                  "Unable to resend code right now. Please retry.",
                );
              }
            }}
            disabled={isAnyAuthFlowLoading}
            className={cn(
              styles.formSecondaryButton,
              "logic-auth-body px-3 py-2 text-xs",
            )}
          >
            Resend code
          </button>
        </form>
      ) : (
        <form className="space-y-4" onSubmit={handleSignUp}>
          <div className="space-y-3">
            <p className={cn(styles.formLabel, "logic-auth-body")}>
              Continue with provider
            </p>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => {
                  void startOAuthSignUp("google");
                }}
                disabled={isAnyAuthFlowLoading}
                className={cn(
                  styles.formSecondaryButton,
                  "logic-auth-body h-11 w-full px-3 text-[11px]",
                )}
              >
                {oauthLoadingProvider === "google" ? "Connecting..." : "Google"}
              </button>

              <button
                type="button"
                onClick={() => {
                  void startOAuthSignUp("github");
                }}
                disabled={isAnyAuthFlowLoading}
                className={cn(
                  styles.formSecondaryButton,
                  "logic-auth-body h-11 w-full px-3 text-[11px]",
                )}
              >
                {oauthLoadingProvider === "github" ? "Connecting..." : "GitHub"}
              </button>
            </div>

            <div className="flex items-center gap-3">
              <span className={styles.formDividerLine} />
              <span className={cn(styles.formDividerText, "logic-auth-body")}>
                Or continue with email
              </span>
              <span className={styles.formDividerLine} />
            </div>
          </div>

          <div className="space-y-2">
            <label
              htmlFor="signup-email"
              className={cn(styles.formLabel, "logic-auth-body")}
            >
              Email address
            </label>
            <input
              id="signup-email"
              name="email"
              type="email"
              value={emailAddress}
              onChange={(event) => setEmailAddress(event.target.value)}
              autoComplete="email"
              required
              className={cn(styles.formInput, "logic-auth-body")}
              placeholder="you@company.com"
            />
            {emailError ? (
              <p className="logic-auth-body text-xs text-[#8f1515]">
                {emailError}
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <label
              htmlFor="signup-password"
              className={cn(styles.formLabel, "logic-auth-body")}
            >
              Password
            </label>
            <input
              id="signup-password"
              name="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="new-password"
              required
              className={cn(styles.formInput, "logic-auth-body")}
              placeholder="Create a secure password"
            />
            {passwordError ? (
              <p className="logic-auth-body text-xs text-[#8f1515]">
                {passwordError}
              </p>
            ) : null}
          </div>

          <button
            type="submit"
            disabled={isAnyAuthFlowLoading}
            className={cn(styles.formPrimaryButton, "logic-auth-body")}
          >
            {isAnyAuthFlowLoading ? "Preparing..." : "Continue"}
          </button>

          <div id="clerk-captcha" className="pt-1" />
        </form>
      )}

      {statusMessage ? (
        <p className={cn(styles.statusMessage, "logic-auth-body")}>
          {statusMessage}
        </p>
      ) : null}

      {globalMessages.length > 0 ? (
        <ul className={cn(styles.errorList, "logic-auth-body space-y-1")}>
          {globalMessages.map((message, index) => (
            <li key={`globalMessage-${index}`}>{message}</li>
          ))}
        </ul>
      ) : null}

      <p className={cn(styles.supportText, "logic-auth-body")}>
        Already have an account?{" "}
        <Link
          href="/sign-in"
          className={cn(
            styles.supportLink,
            "underline-offset-4 hover:underline",
          )}
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}
