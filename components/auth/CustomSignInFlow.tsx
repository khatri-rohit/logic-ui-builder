"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSignIn } from "@clerk/nextjs";

import { cn } from "@/lib/utils";

type ClerkErrorPayload = {
  global?: Array<{ message?: string }>;
  fields?: Record<string, { message?: string } | Array<{ message?: string }>>;
};

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

export default function CustomSignInFlow() {
  const router = useRouter();
  const { signIn, errors, fetchStatus } = useSignIn();

  const [emailAddress, setEmailAddress] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [statusMessage, setStatusMessage] = useState("");

  const isLoading = fetchStatus === "fetching";
  const typedErrors = errors as ClerkErrorPayload | undefined;
  const globalMessages = useMemo(
    () =>
      (typedErrors?.global ?? [])
        .map((errorItem) => errorItem.message)
        .filter(Boolean),
    [typedErrors],
  );

  const needsClientTrust = signIn.status === "needs_client_trust";

  const finishSignIn = async () => {
    await signIn.finalize({
      navigate: ({ session, decorateUrl }) => {
        if (session?.currentTask) {
          setStatusMessage("Additional session task required before redirect.");
          return;
        }

        const url = decorateUrl("/studio");
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

    if (signIn.status === "needs_client_trust") {
      const emailCodeFactor = signIn.supportedSecondFactors.find(
        (factor) => factor.strategy === "email_code",
      );

      if (!emailCodeFactor) {
        setStatusMessage(
          "Client trust is required, but email code is unavailable.",
        );
        return;
      }

      await signIn.mfa.sendEmailCode();
      setStatusMessage("Verification code sent. Check your inbox to continue.");
      return;
    }

    if (signIn.status === "needs_second_factor") {
      setStatusMessage("A second factor is required for this account.");
      return;
    }

    setStatusMessage("Sign-in attempt is not complete yet.");
  };

  const handleVerifyCode = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatusMessage("");

    await signIn.mfa.verifyEmailCode({ code });

    if (signIn.status === "complete") {
      await finishSignIn();
      return;
    }

    setStatusMessage("Verification failed. Please check the code and retry.");
  };

  const emailError = getFieldError(typedErrors, "identifier");
  const passwordError = getFieldError(typedErrors, "password");
  const codeError = getFieldError(typedErrors, "code");

  return (
    <div className="space-y-5">
      {needsClientTrust ? (
        <form className="space-y-4" onSubmit={handleVerifyCode}>
          <div className="space-y-2">
            <label
              htmlFor="verification-code"
              className="text-[10px] uppercase tracking-[0.2em] text-zinc-400"
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
              className="h-11 w-full border border-white/15 bg-black px-3 text-sm text-white outline-none transition-colors placeholder:text-zinc-600 focus:border-white/35"
              placeholder="Enter the 6-digit code"
            />
            {codeError ? (
              <p className="text-xs text-red-300">{codeError}</p>
            ) : null}
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className={cn(
              "h-11 w-full border border-white bg-white text-[11px] font-semibold uppercase tracking-[0.18em] text-black transition-colors",
              "hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-60",
            )}
          >
            {isLoading ? "Verifying..." : "Verify and continue"}
          </button>

          <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-400">
            <button
              type="button"
              onClick={() => signIn.mfa.sendEmailCode()}
              className="border border-white/12 px-3 py-2 uppercase tracking-[0.14em] transition-colors hover:border-white/30 hover:text-white"
            >
              Resend code
            </button>
            <button
              type="button"
              onClick={() => {
                signIn.reset();
                setCode("");
                setStatusMessage("");
              }}
              className="border border-white/12 px-3 py-2 uppercase tracking-[0.14em] transition-colors hover:border-white/30 hover:text-white"
            >
              Start over
            </button>
          </div>
        </form>
      ) : (
        <form className="space-y-4" onSubmit={handleSignIn}>
          <div className="space-y-2">
            <label
              htmlFor="signin-email"
              className="text-[10px] uppercase tracking-[0.2em] text-zinc-400"
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
              className="h-11 w-full border border-white/15 bg-black px-3 text-sm text-white outline-none transition-colors placeholder:text-zinc-600 focus:border-white/35"
              placeholder="you@company.com"
            />
            {emailError ? (
              <p className="text-xs text-red-300">{emailError}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label
                htmlFor="signin-password"
                className="text-[10px] uppercase tracking-[0.2em] text-zinc-400"
              >
                Password
              </label>
              <Link
                href="/forgot-password"
                className="text-[10px] uppercase tracking-[0.14em] text-zinc-500 transition-colors hover:text-zinc-200"
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
              className="h-11 w-full border border-white/15 bg-black px-3 text-sm text-white outline-none transition-colors placeholder:text-zinc-600 focus:border-white/35"
              placeholder="Enter your password"
            />
            {passwordError ? (
              <p className="text-xs text-red-300">{passwordError}</p>
            ) : null}
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className={cn(
              "h-11 w-full border border-white bg-white text-[11px] font-semibold uppercase tracking-[0.18em] text-black transition-colors",
              "hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-60",
            )}
          >
            {isLoading ? "Signing in..." : "Sign in"}
          </button>
        </form>
      )}

      {statusMessage ? (
        <p className="border border-white/12 bg-black/50 px-3 py-2 text-xs text-zinc-300">
          {statusMessage}
        </p>
      ) : null}

      {globalMessages.length > 0 ? (
        <ul className="space-y-1 border border-red-500/40 bg-red-950/30 px-3 py-2 text-xs text-red-200">
          {globalMessages.map((message) => (
            <li key={message}>{message}</li>
          ))}
        </ul>
      ) : null}

      <p className="text-[11px] text-zinc-500">
        No account yet?{" "}
        <Link
          href="/sign-up"
          className="uppercase tracking-[0.14em] text-zinc-100 underline-offset-4 hover:underline"
        >
          Create account
        </Link>
      </p>
    </div>
  );
}
