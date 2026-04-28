"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { toast } from "sonner";
import { InvitationStatus } from "../types";
import { LoadingState } from "./LoadingState";
import { ErrorState } from "./ErrorState";
import { SuccessState } from "./SuccessState";
import { InvitationCard } from "./InvitationCard";
import logger from "@/lib/logger";

export function InviteAcceptContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isSignedIn } = useAuth();
  const token = searchParams.get("token") ?? "";

  const [status, setStatus] = useState<InvitationStatus["status"]>("idle");
  const [message, setMessage] = useState("");
  const [invitationData, setInvitationData] = useState({
    orgName: "",
    invitedBy: "",
    role: "MEMBER",
  });

  const fetchInvitationDetails = async () => {
    try {
      const res = await fetch(`/api/org/invite/details?token=${token}`);
      if (res.ok) {
        const data = await res.json();
        setInvitationData({
          orgName: data.orgName || "Organization",
          invitedBy: data.invitedBy || "",
          role: data.role || "MEMBER",
        });
      }
    } catch (error) {
      // Silently fail - we'll show generic invitation if details can't be fetched
      logger.error("Failed to fetch invitation details:", error);
    }
  };

  const handleAccept = async () => {
    setStatus("accepting");
    try {
      const res = await fetch("/api/org/invite/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });

      const data = await res.json();

      if (res.ok && !data.error) {
        setStatus("success");
        setMessage(data.message || "Invitation accepted successfully!");
        toast.success("Successfully joined the organization!");

        // Redirect after 2 seconds
        setTimeout(() => {
          router.push("/org");
          router.refresh();
        }, 2000);
      } else {
        setStatus("error");
        setMessage(data.message || "Failed to accept invitation.");
        toast.error(data.message || "Failed to accept invitation");
      }
    } catch (error) {
      logger.error("Error accepting invitation:", error);
      setStatus("error");
      setMessage("Something went wrong. Please try again.");
      toast.error("Network error. Please try again.");
    }
  };

  const handleDecline = () => {
    router.push("/");
  };

  // Fetch invitation details on mount
  useEffect(() => {
    if (isSignedIn && token && status === "idle") {
      fetchInvitationDetails();
    }
  }, [isSignedIn, token, status]);

  // If not signed in, redirect to sign-up with the token preserved
  useEffect(() => {
    if (isSignedIn === false && token) {
      router.push(`/sign-up?invite_token=${token}`);
    }
  }, [isSignedIn, router, token]);

  if (!token) {
    return (
      <ErrorState
        title="Invalid Invitation"
        message="This invitation link is invalid or has expired."
        action={
          <button
            onClick={() => router.push("/dashboard")}
            className="text-primary hover:underline"
          >
            Go to Dashboard
          </button>
        }
      />
    );
  }

  if (isSignedIn === null) {
    return <LoadingState message="Checking authentication..." />;
  }

  if (!isSignedIn) {
    return <LoadingState message="Redirecting to sign in..." />;
  }

  if (status === "accepting") {
    return <LoadingState message="Accepting invitation..." />;
  }

  if (status === "success") {
    return <SuccessState message={message} />;
  }

  if (status === "error") {
    return (
      <ErrorState
        title="Acceptance Failed"
        message={message}
        action={
          <button
            onClick={() => setStatus("idle")}
            className="text-primary hover:underline"
          >
            Try Again
          </button>
        }
      />
    );
  }

  return (
    <InvitationCard
      orgName={invitationData.orgName}
      invitedBy={invitationData.invitedBy}
      role={invitationData.role}
      onAccept={handleAccept}
      onDecline={handleDecline}
      isLoading={status !== "idle"}
    />
  );
}
