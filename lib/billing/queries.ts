import {
  queryOptions,
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { requestApi } from "@/lib/api/http";

export interface UserUsage {
  planId: "FREE" | "STANDARD" | "PRO";
  planDisplayName: string;
  generationsUsed: number;
  generationLimit: number; // -1 = unlimited
  generationsRemaining: number; // -1 = unlimited
  projectsCreated: number;
  projectLimit: number;
  projectsRemaining: number;
  frameRegenerationEnabled: boolean;
  allowedModels: string[];
  periodStart: string;
  periodEnd: string;
  scheduledPlanId: "FREE" | "STANDARD" | "PRO" | null;
  scheduledChangeAt: string | null;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: string | null;
  razorpaySubscriptionId: string | null;
}

export const billingKeys = {
  all: ["billing"] as const,
  usage: () => [...billingKeys.all, "usage"] as const,
};

export function useUsageQuery() {
  return useQuery(
    queryOptions({
      queryKey: billingKeys.usage(),
      queryFn: () => requestApi<UserUsage>("/api/usage"),
      staleTime: 60 * 1000,
      refetchOnWindowFocus: true,
    }),
  );
}

export function useCreateSubscriptionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (planId: "FREE" | "STANDARD" | "PRO") => {
      return requestApi<{
        subscriptionId: string;
        shortUrl: string;
        razorpayKeyId: string;
      }>("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: billingKeys.all });
    },
  });
}

export function useUpdateSubscriptionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (planId: "STANDARD" | "PRO") => {
      return requestApi<{
        planId: string;
        status: string;
        shortUrl: string | null;
      }>("/api/billing/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: billingKeys.all });
    },
  });
}

export function useCancelSubscriptionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () =>
      requestApi("/api/billing/cancel", { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: billingKeys.all });
    },
  });
}

export function useGetSubscriptionDetailsQuery() {
  return useQuery(
    queryOptions({
      queryKey: ["details"] as const,
      queryFn: () => getCurrentSubscription(),
      staleTime: 60 * 1000,
      refetchOnWindowFocus: true,
    }),
  );
}

export function getCurrentSubscription() {
  return requestApi<{
    planId: string | null;
    status: string | null;
    cancelAtPeriodEnd: boolean;
  }>("/api/billing");
}

// -- Helpers for plan change logic (used in route handler and can be reused in frontend if needed for UI logic)
export function useChangePlanMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (targetPlanId: "FREE" | "STANDARD" | "PRO") =>
      requestApi<{
        planId: string;
        scheduledPlanId?: string | null;
        scheduledChangeAt?: string | null;
        changed: boolean;
        message: string;
      }>("/api/billing/change-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetPlanId }),
      }),
    onSuccess: () => {
      // Invalidate usage so the header badge and plan status update
      queryClient.invalidateQueries({ queryKey: billingKeys.all });
    },
  });
}

export function useUndoPlanChangeMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      requestApi("/api/billing/undo-change", { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: billingKeys.all });
    },
  });
}

// Also extend useCreateSubscriptionMutation to accept the plan for FREE → paid flows:
export function useSubscribeMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (planId: "STANDARD" | "PRO") =>
      requestApi<{
        subscriptionId: string;
        shortUrl: string;
        razorpayKeyId: string;
      }>("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: billingKeys.all });
    },
  });
}
