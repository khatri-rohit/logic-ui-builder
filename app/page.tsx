"use client";

import Dashboard from "@/components/dashboard/Dashboard";
import LandingPage from "@/components/landing/LandingPage";

export default function Home() {
  const isAuthenticated = true; // Replace with actual authentication logic

  if (isAuthenticated) {
    return <Dashboard />; // Replace with actual Dashboard component
  }

  return <LandingPage />;
}
