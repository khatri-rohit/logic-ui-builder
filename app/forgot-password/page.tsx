import AuthShell from "@/components/auth/AuthShell";
import CustomForgotPasswordFlow from "@/components/auth/CustomForgotPasswordFlow";

export default function Page() {
  return (
    <AuthShell
      mode="sign-in"
      title="Reset Password"
      subtitle="Recover access to your workspace by verifying your email and setting a new password."
    >
      <CustomForgotPasswordFlow />
    </AuthShell>
  );
}
