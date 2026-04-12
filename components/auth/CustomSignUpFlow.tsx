"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth, useSignUp } from "@clerk/nextjs";

import { useCreateProjectMutation } from "@/lib/projects/queries";
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
  const { mutateAsync: createProjectFromPrompt } = useCreateProjectMutation();

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

        // Keep the user on this page while we provision the first project after session hydration.
        if (sessionStorage.getItem("initialPrompt")?.trim()) {
          return;
        }

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
    if (!signUp || !isSignedIn || postAuthHandledRef.current) {
      return;
    }

    postAuthHandledRef.current = true;

    const initialPrompt = sessionStorage.getItem("initialPrompt")?.trim();

    if (!initialPrompt) {
      router.replace("/");
      return;
    }

    void createProjectFromPrompt({ prompt: initialPrompt })
      .then((project) => {
        sessionStorage.removeItem("initialPrompt");

        if (project.projectId) {
          router.replace(`/projects/${project.projectId}`);
          return;
        }

        router.replace("/");
      })
      .catch((error: unknown) => {
        console.error("Failed to create post-sign-up project", error);
        setStatusMessage(
          "Account created, but project setup failed. You can create one from the dashboard.",
        );
        router.replace("/");
      });
  }, [createProjectFromPrompt, isSignedIn, router, signUp]);

  if (!signUp) {
    return <div className="text-zinc-400 text-sm">Loading sign-up...</div>;
  }

  if (isSignedIn || signUp.status === "complete") {
    return <div className="text-zinc-400 text-sm">Redirecting...</div>;
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
              className="text-[10px] uppercase tracking-[0.2em] text-zinc-400"
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
              className="h-11 w-full border border-white/15 bg-black px-3 text-sm text-white outline-none transition-colors placeholder:text-zinc-600 focus:border-white/35"
              placeholder="Enter the 6-digit code"
            />
            {codeError ? (
              <p className="text-xs text-red-300">{codeError}</p>
            ) : null}
          </div>

          <button
            type="submit"
            disabled={isAnyAuthFlowLoading}
            className={cn(
              "h-11 w-full border border-white bg-white text-[11px] font-semibold uppercase tracking-[0.18em] text-black transition-colors",
              "hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-60",
            )}
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
            className="border border-white/12 px-3 py-2 text-xs uppercase tracking-[0.14em] text-zinc-300 transition-colors hover:border-white/30 hover:text-white"
          >
            Resend code
          </button>
        </form>
      ) : (
        <form className="space-y-4" onSubmit={handleSignUp}>
          <div className="space-y-3">
            <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-400">
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
                  "h-11 border border-white/15 bg-black px-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-100 transition-colors",
                  "hover:border-white/35 hover:bg-zinc-900 disabled:cursor-not-allowed disabled:opacity-60",
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
                  "h-11 border border-white/15 bg-black px-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-100 transition-colors",
                  "hover:border-white/35 hover:bg-zinc-900 disabled:cursor-not-allowed disabled:opacity-60",
                )}
              >
                {oauthLoadingProvider === "github" ? "Connecting..." : "GitHub"}
              </button>
            </div>

            <div className="flex items-center gap-3 text-[10px] uppercase tracking-[0.16em] text-zinc-500">
              <span className="h-px flex-1 bg-white/15" />
              <span>Or continue with email</span>
              <span className="h-px flex-1 bg-white/15" />
            </div>
          </div>

          <div className="space-y-2">
            <label
              htmlFor="signup-email"
              className="text-[10px] uppercase tracking-[0.2em] text-zinc-400"
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
              className="h-11 w-full border border-white/15 bg-black px-3 text-sm text-white outline-none transition-colors placeholder:text-zinc-600 focus:border-white/35"
              placeholder="you@company.com"
            />
            {emailError ? (
              <p className="text-xs text-red-300">{emailError}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <label
              htmlFor="signup-password"
              className="text-[10px] uppercase tracking-[0.2em] text-zinc-400"
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
              className="h-11 w-full border border-white/15 bg-black px-3 text-sm text-white outline-none transition-colors placeholder:text-zinc-600 focus:border-white/35"
              placeholder="Create a secure password"
            />
            {passwordError ? (
              <p className="text-xs text-red-300">{passwordError}</p>
            ) : null}
          </div>

          <button
            type="submit"
            disabled={isAnyAuthFlowLoading}
            className={cn(
              "h-11 w-full border border-white bg-white text-[11px] font-semibold uppercase tracking-[0.18em] text-black transition-colors",
              "hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-60",
            )}
          >
            {isAnyAuthFlowLoading ? "Preparing..." : "Continue"}
          </button>

          <div id="clerk-captcha" className="pt-1" />
        </form>
      )}

      {statusMessage ? (
        <p className="border border-white/12 bg-black/50 px-3 py-2 text-xs text-zinc-300">
          {statusMessage}
        </p>
      ) : null}

      {globalMessages.length > 0 ? (
        <ul className="space-y-1 border border-red-500/40 bg-red-950/30 px-3 py-2 text-xs text-red-200">
          {globalMessages.map((message, index) => (
            <li key={`globalMessage-${index}`}>{message}</li>
          ))}
        </ul>
      ) : null}

      <p className="text-[11px] text-zinc-500">
        Already have an account?{" "}
        <Link
          href="/sign-in"
          className="uppercase tracking-[0.14em] text-zinc-100 underline-offset-4 hover:underline"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}
