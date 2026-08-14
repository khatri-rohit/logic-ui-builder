import type { Metadata } from "next";
import AuthShell from "@/components/auth/AuthShell";
import CustomSignUpFlow from "@/components/auth/CustomSignUpFlow";

export const metadata: Metadata = {
  title: "Create Account",
  description: "Create your LOGIC account and start generating production UI.",
  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
};

export default function Page() {
  return (
    <AuthShell
      mode="sign-up"
      title="Create Account"
      subtitle="Start free and generate production-ready UI from natural language."
    >
      <CustomSignUpFlow />
    </AuthShell>
  );
}
