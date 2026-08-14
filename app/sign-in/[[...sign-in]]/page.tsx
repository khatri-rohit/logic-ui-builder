import type { Metadata } from "next";
import AuthShell from "@/components/auth/AuthShell";
import CustomSignInFlow from "@/components/auth/CustomSignInFlow";

export const metadata: Metadata = {
  title: "Sign In",
  description: "Sign in to LOGIC and continue building production-ready UI.",
  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
};

export default function Page() {
  return (
    <AuthShell
      mode="sign-in"
      title="Sign In"
      subtitle="Continue generating interfaces and editing your design sessions."
    >
      <CustomSignInFlow />
    </AuthShell>
  );
}
