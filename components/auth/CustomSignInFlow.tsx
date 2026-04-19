"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useSignIn } from "@clerk/nextjs";

import styles from "./auth-theme.module.css";
import { cn } from "@/lib/utils";

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

type MfaCodeStrategy = "email_code" | "phone_code";

function getTaskNavigationTarget(session: SessionWithTask): string | null {
  const task = session?.currentTask;
  if (!task) {
    return null;
  }

  return task.redirectUrl ?? task.url ?? task.path ?? null;
}

function getSupportedCodeStrategy(
  supportedFactors: Array<{ strategy?: string }>,
): MfaCodeStrategy | null {
  const available = supportedFactors.find(
    (factor) =>
      factor.strategy === "email_code" || factor.strategy === "phone_code",
  )?.strategy;

  return available === "phone_code" || available === "email_code"
    ? available
    : null;
}

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

export default function CustomSignInFlow() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { signIn, errors, fetchStatus } = useSignIn();
  const oauthAutoStartedRef = useRef(false);

  const [emailAddress, setEmailAddress] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [oauthLoadingProvider, setOauthLoadingProvider] =
    useState<OAuthProvider | null>(null);
  const [activeMfaStrategy, setActiveMfaStrategy] =
    useState<MfaCodeStrategy | null>(null);

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

  const needsClientTrust = signIn?.status === "needs_client_trust";
  const needsSecondFactor = signIn?.status === "needs_second_factor";
  const needsMfaVerification = needsClientTrust || needsSecondFactor;
  const preselectedOAuthProvider = useMemo(
    () => getOAuthProviderFromParam(searchParams.get("provider")),
    [searchParams],
  );

  const resolveMfaStrategy = () =>
    getSupportedCodeStrategy(
      (signIn?.supportedSecondFactors ?? []) as Array<{
        strategy?: string;
      }>,
    );

  const sendSecondFactorCode = async (strategy: MfaCodeStrategy) => {
    if (!signIn) {
      return;
    }

    if (strategy === "phone_code") {
      await signIn.mfa.sendPhoneCode();
      return;
    }

    await signIn.mfa.sendEmailCode();
  };

  const startOAuthSignIn = async (provider: OAuthProvider) => {
    if (!signIn) {
      return;
    }

    setStatusMessage("");
    setOauthLoadingProvider(provider);

    try {
      const { error } = await signIn.sso({
        strategy: OAUTH_STRATEGY_BY_PROVIDER[provider],
        redirectUrl: "/",
        redirectCallbackUrl: "/sign-in/sso-callback",
      });

      if (!error) {
        return;
      }

      console.error("Failed to start OAuth sign-in", error);
      setStatusMessage(
        `Unable to start ${provider === "google" ? "Google" : "GitHub"} sign-in. Please retry.`,
      );
      setOauthLoadingProvider(null);
    } catch (error) {
      console.error("Failed to start OAuth sign-in", error);
      setStatusMessage(
        `Unable to start ${provider === "google" ? "Google" : "GitHub"} sign-in. Please retry.`,
      );
      setOauthLoadingProvider(null);
    }
  };

  useEffect(() => {
    if (!signIn || !preselectedOAuthProvider || oauthAutoStartedRef.current) {
      return;
    }

    oauthAutoStartedRef.current = true;
    void signIn
      .sso({
        strategy: OAUTH_STRATEGY_BY_PROVIDER[preselectedOAuthProvider],
        redirectUrl: "/",
        redirectCallbackUrl: "/sign-in/sso-callback",
      })
      .then(({ error }) => {
        if (error) {
          console.error("Failed to auto-start OAuth sign-in", error);
        }
      })
      .catch((error: unknown) => {
        console.error("Failed to auto-start OAuth sign-in", error);
      });
  }, [preselectedOAuthProvider, signIn]);

  const finishSignIn = async () => {
    if (!signIn) {
      return;
    }

    await signIn.finalize({
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

  const handleSignIn = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatusMessage("");

    if (!signIn) {
      return;
    }

    const { error } = await signIn.password({
      emailAddress,
      password,
    });

    if (error) {
      return;
    }

    if (signIn.status === "complete") {
      await finishSignIn();
      return;
    }

    if (
      signIn.status === "needs_client_trust" ||
      signIn.status === "needs_second_factor"
    ) {
      const strategy = resolveMfaStrategy();

      if (!strategy) {
        setStatusMessage(
          "A supported second factor is required to continue sign-in.",
        );
        return;
      }

      setActiveMfaStrategy(strategy);

      try {
        await sendSecondFactorCode(strategy);
        setStatusMessage(
          strategy === "phone_code"
            ? "Verification code sent. Check your phone to continue."
            : "Verification code sent. Check your inbox to continue.",
        );
      } catch {
        setStatusMessage(
          "Unable to send a verification code right now. Please retry.",
        );
      }
      return;
    }

    setStatusMessage("Sign-in attempt is not complete yet.");
  };

  const handleVerifyCode = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatusMessage("");

    if (!signIn) {
      return;
    }

    const strategy = activeMfaStrategy ?? resolveMfaStrategy();
    if (!strategy) {
      setStatusMessage("No supported second factor is available.");
      return;
    }

    setActiveMfaStrategy(strategy);

    try {
      const result =
        strategy === "phone_code"
          ? await signIn.mfa.verifyPhoneCode({ code })
          : await signIn.mfa.verifyEmailCode({ code });

      if (result.error) {
        return;
      }
    } catch {
      setStatusMessage("Verification failed. Please try again.");
      return;
    }

    if (signIn.status === "complete") {
      await finishSignIn();
      return;
    }

    setStatusMessage("Verification failed. Please check the code and retry.");
  };

  const emailError = getFieldError(typedErrors, "identifier");
  const passwordError = getFieldError(typedErrors, "password");
  const codeError = getFieldError(typedErrors, "code");

  if (!signIn) {
    return (
      <div className="logic-auth-body text-sm text-(--logic-secondary)">
        Loading sign-in...
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {needsMfaVerification ? (
        <form className="space-y-4" onSubmit={handleVerifyCode}>
          <div className="space-y-2">
            <label
              htmlFor="verification-code"
              className={cn(styles.formLabel, "logic-auth-body")}
            >
              Verification code
            </label>
            <input
              id="verification-code"
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
            {isAnyAuthFlowLoading ? "Verifying..." : "Verify and continue"}
          </button>

          <div className="logic-auth-body flex flex-wrap items-center gap-2 text-xs text-(--logic-secondary)">
            <button
              type="button"
              onClick={async () => {
                const strategy = activeMfaStrategy ?? resolveMfaStrategy();

                if (!strategy) {
                  setStatusMessage("No supported second factor is available.");
                  return;
                }

                try {
                  await sendSecondFactorCode(strategy);
                  setStatusMessage(
                    strategy === "phone_code"
                      ? "Verification code sent. Check your phone to continue."
                      : "Verification code sent. Check your inbox to continue.",
                  );
                } catch {
                  setStatusMessage(
                    "Unable to resend verification code right now. Please retry.",
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
            <button
              type="button"
              onClick={async () => {
                try {
                  await signIn.reset();
                } catch {
                  // Keep local state reset even if the remote reset call fails.
                }
                setCode("");
                setStatusMessage("");
                setActiveMfaStrategy(null);
              }}
              disabled={isAnyAuthFlowLoading}
              className={cn(
                styles.formSecondaryButton,
                "logic-auth-body px-3 py-2 text-xs",
              )}
            >
              Start over
            </button>
          </div>
        </form>
      ) : (
        <form className="space-y-4" onSubmit={handleSignIn}>
          <div className="space-y-3">
            <p className={cn(styles.formLabel, "logic-auth-body")}>
              Continue with provider
            </p>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => {
                  void startOAuthSignIn("google");
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
                  void startOAuthSignIn("github");
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
              htmlFor="signin-email"
              className={cn(styles.formLabel, "logic-auth-body")}
            >
              Email address
            </label>
            <input
              id="signin-email"
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
            <div className="flex items-center justify-between">
              <label
                htmlFor="signin-password"
                className={cn(styles.formLabel, "logic-auth-body")}
              >
                Password
              </label>
              <Link
                href="/forgot-password"
                className={cn(
                  styles.supportLink,
                  "logic-auth-body text-[10px] transition-colors",
                )}
              >
                Forgot
              </Link>
            </div>
            <input
              id="signin-password"
              name="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              required
              className={cn(styles.formInput, "logic-auth-body")}
              placeholder="Enter your password"
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
            {isAnyAuthFlowLoading ? "Signing in..." : "Sign in"}
          </button>
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
        No account yet?{" "}
        <Link
          href="/sign-up"
          className={cn(
            styles.supportLink,
            "underline-offset-4 hover:underline",
          )}
        >
          Create account
        </Link>
      </p>
    </div>
  );
}
