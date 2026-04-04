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

type ResetStep = "request" | "verify" | "password";

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

export default function CustomForgotPasswordFlow() {
  const router = useRouter();
  const { signIn, errors, fetchStatus } = useSignIn();

  const [emailAddress, setEmailAddress] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [step, setStep] = useState<ResetStep>("request");
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

  const finishReset = async () => {
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

  const handleSendResetCode = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatusMessage("");

    const createAttempt = await signIn.create({
      identifier: emailAddress,
    });

    if (createAttempt.error) {
      return;
    }

    const sendCode = await signIn.resetPasswordEmailCode.sendCode();
    if (sendCode.error) {
      return;
    }

    setStep("verify");
    setStatusMessage(
      "Reset code sent. Check your email for the verification code.",
    );
  };

  const handleVerifyCode = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatusMessage("");

    const verifyResult = await signIn.resetPasswordEmailCode.verifyCode({
      code,
    });

    if (verifyResult.error) {
      return;
    }

    if (signIn.status === "needs_new_password") {
      setStep("password");
      setStatusMessage("Code verified. Set a new password to complete reset.");
      return;
    }

    setStatusMessage("Verification is not complete yet. Please retry.");
  };

  const handleSubmitNewPassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatusMessage("");

    const submitResult = await signIn.resetPasswordEmailCode.submitPassword({
      password: newPassword,
    });

    if (submitResult.error) {
      return;
    }

    if (signIn.status === "complete") {
      await finishReset();
      return;
    }

    setStatusMessage("Password update is not complete yet. Please retry.");
  };

  const handleStartOver = async () => {
    await signIn.reset();
    setStep("request");
    setCode("");
    setNewPassword("");
    setStatusMessage("");
  };

  const identifierError = getFieldError(typedErrors, "identifier");
  const codeError = getFieldError(typedErrors, "code");
  const passwordError = getFieldError(typedErrors, "password");

  return (
    <div className="space-y-5">
      {step === "request" ? (
        <form className="space-y-4" onSubmit={handleSendResetCode}>
          <div className="space-y-2">
            <label
              htmlFor="reset-email"
              className="text-[10px] uppercase tracking-[0.2em] text-zinc-400"
            >
              Account email
            </label>
            <input
              id="reset-email"
              name="email"
              type="email"
              value={emailAddress}
              onChange={(event) => setEmailAddress(event.target.value)}
              autoComplete="email"
              required
              className="h-11 w-full border border-white/15 bg-black px-3 text-sm text-white outline-none transition-colors placeholder:text-zinc-600 focus:border-white/35"
              placeholder="you@company.com"
            />
            {identifierError ? (
              <p className="text-xs text-red-300">{identifierError}</p>
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
            {isLoading ? "Sending..." : "Send reset code"}
          </button>
        </form>
      ) : null}

      {step === "verify" ? (
        <form className="space-y-4" onSubmit={handleVerifyCode}>
          <div className="space-y-2">
            <label
              htmlFor="reset-code"
              className="text-[10px] uppercase tracking-[0.2em] text-zinc-400"
            >
              Verification code
            </label>
            <input
              id="reset-code"
              name="code"
              type="text"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              autoComplete="one-time-code"
              required
              className="h-11 w-full border border-white/15 bg-black px-3 text-sm text-white outline-none transition-colors placeholder:text-zinc-600 focus:border-white/35"
              placeholder="Enter the code from email"
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
            {isLoading ? "Verifying..." : "Verify code"}
          </button>

          <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-400">
            <button
              type="button"
              onClick={() => signIn.resetPasswordEmailCode.sendCode()}
              className="border border-white/12 px-3 py-2 uppercase tracking-[0.14em] transition-colors hover:border-white/30 hover:text-white"
            >
              Resend code
            </button>
            <button
              type="button"
              onClick={handleStartOver}
              className="border border-white/12 px-3 py-2 uppercase tracking-[0.14em] transition-colors hover:border-white/30 hover:text-white"
            >
              Start over
            </button>
          </div>
        </form>
      ) : null}

      {step === "password" ? (
        <form className="space-y-4" onSubmit={handleSubmitNewPassword}>
          <div className="space-y-2">
            <label
              htmlFor="new-password"
              className="text-[10px] uppercase tracking-[0.2em] text-zinc-400"
            >
              New password
            </label>
            <input
              id="new-password"
              name="password"
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              autoComplete="new-password"
              required
              className="h-11 w-full border border-white/15 bg-black px-3 text-sm text-white outline-none transition-colors placeholder:text-zinc-600 focus:border-white/35"
              placeholder="Create your new password"
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
            {isLoading ? "Updating..." : "Set new password"}
          </button>
        </form>
      ) : null}

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
        Remembered your password?{" "}
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
