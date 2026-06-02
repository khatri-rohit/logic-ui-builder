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
  periodStart: string;
  periodEnd: string;
  scheduledPlanId: "FREE" | "STANDARD" | "PRO" | null;
  scheduledChangeAt: string | null;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: string | null;
  razorpaySubscriptionId: string | null;
  status:
    | "ACTIVE"
    | "AUTHENTICATED"
    | "CREATED"
    | "PENDING"
    | "CANCELLED"
    | "COMPLETED"
    | "EXPIRED"
    | "HALTED";
}

export const billingKeys = {
  all: ["billing"] as const,
  usage: () => [...billingKeys.all, "usage"] as const,
  details: () => [...billingKeys.all, "details"] as const,
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

export function useCheckoutMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (planId: "STANDARD" | "PRO") => {
      return requestApi<{
        subscriptionId: string;
        shortUrl: string | null;
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

export function useUpgradeMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (targetPlanId: "STANDARD" | "PRO") => {
      return requestApi<{
        planId: string;
        changed: boolean;
        message: string;
      }>("/api/billing/upgrade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetPlanId }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: billingKeys.all });
    },
  });
}

export function useScheduleDowngradeMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (targetPlanId: "STANDARD" | "PRO") => {
      return requestApi<{
        planId: string;
        scheduledPlanId?: string | null;
        scheduledChangeAt?: string | null;
        changed: boolean;
        message: string;
      }>("/api/billing/schedule-downgrade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetPlanId }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: billingKeys.all });
    },
  });
}

export function useUndoDowngradeMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      return requestApi<{
        planId: string;
        changed: boolean;
        message: string;
      }>("/api/billing/undo-downgrade", { method: "POST" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: billingKeys.all });
    },
  });
}

export function useCancelMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      return requestApi<{
        planId: string;
        changed: boolean;
        message: string;
      }>("/api/billing/cancel", { method: "POST" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: billingKeys.all });
    },
  });
}

export function useGetSubscriptionDetailsQuery() {
  return useQuery(
    queryOptions({
      queryKey: billingKeys.details(),
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
