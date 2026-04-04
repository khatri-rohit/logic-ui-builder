import AuthShell from "@/components/auth/AuthShell";
import CustomSignInFlow from "@/components/auth/CustomSignInFlow";

export default function Page() {
  return (
    <AuthShell
      mode="sign-in"
      title="Sign In"
      subtitle="Authenticate to continue generating interfaces and editing your active design sessions."
    >
      <CustomSignInFlow />
    </AuthShell>
  );
}
