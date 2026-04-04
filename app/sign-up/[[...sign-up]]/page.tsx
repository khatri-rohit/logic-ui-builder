import AuthShell from "@/components/auth/AuthShell";
import CustomSignUpFlow from "@/components/auth/CustomSignUpFlow";

export default function Page() {
  return (
    <AuthShell
      mode="sign-up"
      title="Create Account"
      subtitle="Provision a secure workspace to generate, iterate, and ship production-grade UI architecture."
    >
      <CustomSignUpFlow />
    </AuthShell>
  );
}
