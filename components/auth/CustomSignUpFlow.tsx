"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth, useSignUp } from "@clerk/nextjs";

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

export default function CustomSignUpFlow() {
  const router = useRouter();
  const { isSignedIn } = useAuth();
  const { signUp, errors, fetchStatus } = useSignUp();

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

  const isEmailVerificationStep =
    signUp.status === "missing_requirements" &&
    signUp.unverifiedFields.includes("email_address") &&
    signUp.missingFields.length === 0;

  const finishSignUp = async () => {
    await signUp.finalize({
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

  const handleSignUp = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatusMessage("");

    const { error } = await signUp.password({
      emailAddress,
      password,
    });

    if (error) {
      return;
    }

    await signUp.verifications.sendEmailCode();
    setStatusMessage("Verification code sent. Check your inbox to continue.");
  };

  const handleVerifyCode = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatusMessage("");

    await signUp.verifications.verifyEmailCode({
      code,
    });

    if (signUp.status === "complete") {
      await finishSignUp();
      return;
    }

    setStatusMessage("Verification is not complete yet. Please retry.");
  };

  if (isSignedIn || signUp.status === "complete") {
    return null;
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
            disabled={isLoading}
            className={cn(
              "h-11 w-full border border-white bg-white text-[11px] font-semibold uppercase tracking-[0.18em] text-black transition-colors",
              "hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-60",
            )}
          >
            {isLoading ? "Verifying..." : "Verify and create account"}
          </button>

          <button
            type="button"
            onClick={() => signUp.verifications.sendEmailCode()}
            className="border border-white/12 px-3 py-2 text-xs uppercase tracking-[0.14em] text-zinc-300 transition-colors hover:border-white/30 hover:text-white"
          >
            Resend code
          </button>
        </form>
      ) : (
        <form className="space-y-4" onSubmit={handleSignUp}>
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
            disabled={isLoading}
            className={cn(
              "h-11 w-full border border-white bg-white text-[11px] font-semibold uppercase tracking-[0.18em] text-black transition-colors",
              "hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-60",
            )}
          >
            {isLoading ? "Preparing..." : "Continue"}
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
          {globalMessages.map((message) => (
            <li key={message}>{message}</li>
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
