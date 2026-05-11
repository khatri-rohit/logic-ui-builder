import type { ComponentType } from "react";
export interface OrgMember {
  id: string;
  user: {
    id: string;
    name: string;
    email: string;
  };
  role: "OWNER" | "ADMIN" | "MEMBER";
  joinedAt: string;
}

export interface OrgInvitation {
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
  userRole: "OWNER" | "ADMIN" | "MEMBER";
  seatCount: number;
  maxSeats: number;
  memberships: OrgMember[];
  invitations: OrgInvitation[];
}

export interface RoleConfig {
  label: string;
  icon: ComponentType<{ className?: string }>;
  badgeClass: string;
}

export interface ProgressBarProps {
  current: number;
  max: number;
}

export interface MemberRowProps {
  membership: OrgMember;
  currentUserId: string;
  userRole: OrgDetail["userRole"];
  canManageActions: boolean;
  onRemove: (memberId: string) => void;
  isRemoving: boolean;
}

export interface InviteFormProps {
  maxSeats: number;
  seatCount: number;
  userRole: OrgDetail["userRole"];
}

export interface OrgPageClientProps {
  currentUserId: string;
}
