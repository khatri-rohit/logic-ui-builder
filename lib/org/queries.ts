import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { requestApi } from "@/lib/api/http";

export interface OrgMember {
  id: string;
  role: "OWNER" | "ADMIN" | "MEMBER";
  user: { id: string; name: string; email: string };
  joinedAt: string;
}

export interface OrgInvite {
  id: string;
  email: string;
  role: "ADMIN" | "MEMBER";
  expiresAt: string;
  createdAt: string;
}

export interface OrgDetail {
  id: string;
  name: string;
  slug: string;
  maxSeats: number;
  seatCount: number;
  userRole: "OWNER" | "ADMIN" | "MEMBER";
  memberships: OrgMember[];
  invitations: OrgInvite[];
}

export const orgKeys = {
  all: ["org"] as const,
  detail: () => [...orgKeys.all, "detail"] as const,
};

export function useOrgQuery() {
  return useQuery(
    queryOptions({
      queryKey: orgKeys.detail(),
      queryFn: () => requestApi<OrgDetail | null>("/api/org"),
      staleTime: 30 * 1000,
      refetchOnWindowFocus: true,
    }),
  );
}

export function useCreateOrgMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) =>
      requestApi<OrgDetail>("/api/org", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: orgKeys.all }),
  });
}

export function useInviteMemberMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      email,
      role,
    }: {
      email: string;
      role: "ADMIN" | "MEMBER";
    }) =>
      requestApi("/api/org/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: orgKeys.all }),
  });
}

export function useRemoveMemberMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (memberId: string) =>
      requestApi(`/api/org/members/${memberId}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: orgKeys.all }),
  });
}

export function useLeaveOrgMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => requestApi("/api/org/leave", { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: orgKeys.all });
      qc.invalidateQueries({ queryKey: ["billing"] });
    },
  });
}

export function useRevokeInviteMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (inviteId: string) =>
      requestApi(`/api/org/invite/${inviteId}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: orgKeys.all }),
  });
}
