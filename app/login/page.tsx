import type { Metadata } from "next";
import AuthCard from "@/components/auth/AuthCard";
import LoginForm from "@/components/auth/LoginForm";

export const metadata: Metadata = {
  title: "Sign In",
};

const bullets = [
  "Continuous 24/7 monitoring",
  "Real-time threat alerts",
  "Security scoring & reports",
  "SSL certificate monitoring",
];

export default function LoginPage() {
  return (
    <AuthCard
      title="Welcome back"
      subtitle="Sign in to your CyberShield account."
      footerText="Don't have an account?"
      footerLinkText="Create one free"
      footerLinkHref="/signup"
      panelHeadline="Welcome Back"
      panelDescription="Access your security monitoring dashboard and stay ahead of threats."
      panelBullets={bullets}
    >
      <LoginForm />
    </AuthCard>
  );
}
