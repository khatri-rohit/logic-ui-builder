import prisma from "@/lib/prisma";
import crypto from "crypto";

export const ORG_MAX_SEATS_PRO = 5;
export const ORG_INVITE_TTL_DAYS = 7;

// ---------------------------------------------------------------------------
// Slug generation
// ---------------------------------------------------------------------------
export function generateOrgSlug(name: string): string {
  const slug = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 48);
  return slug || `org-${crypto.randomBytes(4).toString("hex")}`;
}

const MAX_SLUG_ATTEMPTS = 25;
export async function ensureUniqueSlug(baseSlug: string): Promise<string> {
  for (let attempt = 0; attempt < MAX_SLUG_ATTEMPTS; attempt++) {
    const slug = attempt === 0 ? baseSlug : `${baseSlug}-${attempt}`;
    const existing = await prisma.organisation.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (!existing) return slug;
  }
  // Final fallback: append a short random suffix to defeat collisions / races.
  return `${baseSlug}-${crypto.randomBytes(3).toString("hex")}`;
}

// ---------------------------------------------------------------------------
// Seat counting
// ---------------------------------------------------------------------------
export async function getActiveSeatCount(
  organisationId: string,
): Promise<number> {
  return prisma.orgMembership.count({
    where: { organisationId, status: "ACTIVE" },
  });
}

export async function hasAvailableSeat(
  organisationId: string,
  maxSeats: number,
): Promise<boolean> {
  const count = await getActiveSeatCount(organisationId);
  return count < maxSeats;
}

// ---------------------------------------------------------------------------
// Org creation
// ---------------------------------------------------------------------------
export async function createOrganisation({
  ownerId,
  name,
}: {
  ownerId: string;
  name: string;
}) {
  const baseSlug = generateOrgSlug(name);
  const slug = await ensureUniqueSlug(baseSlug);

  return prisma.$transaction(async (tx) => {
    const org = await tx.organisation.create({
      data: { name, slug, ownerId, maxSeats: ORG_MAX_SEATS_PRO },
    });

    // Owner is always the first ACTIVE OWNER-role member
    await tx.orgMembership.create({
      data: {
        organisationId: org.id,
        userId: ownerId,
        role: "OWNER",
        status: "ACTIVE",
      },
    });

    return org;
  });
}

// ---------------------------------------------------------------------------
// Invitation lifecycle
// ---------------------------------------------------------------------------
export async function createInvitation({
  organisationId,
  email,
  role,
  invitedBy,
}: {
  organisationId: string;
  email: string;
  role: "ADMIN" | "MEMBER";
  invitedBy: string;
}) {
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(
    Date.now() + ORG_INVITE_TTL_DAYS * 24 * 60 * 60 * 1000,
  );

  // Upsert: if a PENDING invite exists for this email, replace it
  const existing = await prisma.orgInvitation.findUnique({
    where: { organisationId_email: { organisationId, email } },
    select: { id: true, status: true },
  });

  if (existing && existing.status === "PENDING") {
    return prisma.orgInvitation.update({
      where: { id: existing.id },
      data: { token, expiresAt, role, invitedBy, status: "PENDING" },
    });
  }

  return prisma.orgInvitation.create({
    data: {
      organisationId,
      email,
      role,
      status: "PENDING",
      token,
      invitedBy,
      expiresAt,
    },
  });
}

export async function acceptInvitation(token: string, acceptingUserId: string) {
  const invitation = await prisma.orgInvitation.findUnique({
    where: { token },
    include: {
      organisation: { select: { id: true, maxSeats: true } },
    },
  });

  if (!invitation)
    throw new OrgError("INVITE_NOT_FOUND", "Invitation not found.", 404);
  if (invitation.status !== "PENDING")
    throw new OrgError(
      "INVITE_ALREADY_USED",
      "This invitation has already been used.",
      409,
    );
  if (invitation.expiresAt < new Date()) {
    await prisma.orgInvitation
      .update({ where: { id: invitation.id }, data: { status: "EXPIRED" } })
      .catch(() => {
        // best-effort marking; the user-visible error below is what matters
      });
    throw new OrgError("INVITE_EXPIRED", "This invitation has expired.", 410);
  }

  // Check accepting user's email matches invite email (or allow any logged-in user — design choice)
  // We enforce email match to prevent invite hijacking
  const acceptingUser = await prisma.user.findUnique({
    where: { id: acceptingUserId },
    select: { email: true },
  });
  if (acceptingUser?.email.toLowerCase() !== invitation.email.toLowerCase()) {
    throw new OrgError(
      "EMAIL_MISMATCH",
      "This invitation was sent to a different email address.",
      403,
    );
  }

  return prisma.$transaction(
    async (tx) => {
      // Acquire a row-level lock on the organisation to serialise seat checks
      await tx.$executeRaw`
    SELECT id FROM "Organisation"
    WHERE id = ${invitation.organisationId}
    FOR UPDATE
  `;

      const activeCount = await tx.orgMembership.count({
        where: { organisationId: invitation.organisationId, status: "ACTIVE" },
      });

      const existing = await tx.orgMembership.findUnique({
        where: {
          organisationId_userId: {
            organisationId: invitation.organisationId,
            userId: acceptingUserId,
          },
        },
        select: { status: true },
      });

      const consumesSeat = !existing || existing.status !== "ACTIVE";
      if (consumesSeat && activeCount >= invitation.organisation.maxSeats) {
        throw new OrgError(
          "SEAT_LIMIT_REACHED",
          "This organisation has no available seats.",
          402,
        );
      }

      await tx.orgInvitation.update({
        where: { id: invitation.id },
        data: { status: "ACCEPTED", acceptedAt: new Date() },
      });

      return tx.orgMembership.upsert({
        where: {
          organisationId_userId: {
            organisationId: invitation.organisationId,
            userId: acceptingUserId,
          },
        },
        create: {
          organisationId: invitation.organisationId,
          userId: acceptingUserId,
          role: invitation.role,
          status: "ACTIVE",
          invitedBy: invitation.invitedBy,
        },
        update: { role: invitation.role, status: "ACTIVE" },
      });
    },
    {
      isolationLevel: "Serializable",
    },
  );
}

export async function revokeInvitation(
  invitationId: string,
  requestingUserId: string,
) {
  const invitation = await prisma.orgInvitation.findUnique({
    where: { id: invitationId },
    include: { organisation: { select: { ownerId: true } } },
  });

  if (!invitation)
    throw new OrgError("INVITE_NOT_FOUND", "Invitation not found.", 404);
  if (invitation.status !== "PENDING")
    throw new OrgError(
      "INVITE_NOT_PENDING",
      "Only PENDING invitations can be revoked.",
      409,
    );

  // Only org owner or the original inviter can revoke
  const canRevoke =
    invitation.organisation.ownerId === requestingUserId ||
    invitation.invitedBy === requestingUserId;

  if (!canRevoke)
    throw new OrgError(
      "FORBIDDEN",
      "You do not have permission to revoke this invitation.",
      403,
    );

  return prisma.orgInvitation.update({
    where: { id: invitationId },
    data: { status: "REVOKED" },
  });
}

// ---------------------------------------------------------------------------
// Member management
// ---------------------------------------------------------------------------
export async function removeMember(
  organisationId: string,
  targetUserId: string,
  requestingUserId: string,
) {
  const requestingMembership = await prisma.orgMembership.findUnique({
    where: {
      organisationId_userId: { organisationId, userId: requestingUserId },
    },
    select: { role: true },
  });

  if (!requestingMembership)
    throw new OrgError(
      "FORBIDDEN",
      "You are not a member of this organisation.",
      403,
    );
  if (requestingMembership.role === "MEMBER")
    throw new OrgError(
      "FORBIDDEN",
      "Members cannot remove other members.",
      403,
    );
  if (targetUserId === requestingUserId)
    throw new OrgError(
      "CANNOT_REMOVE_SELF",
      "Use the leave endpoint to remove yourself.",
      400,
    );

  // Owners cannot be removed — only dissolution removes the owner
  const targetMembership = await prisma.orgMembership.findUnique({
    where: { organisationId_userId: { organisationId, userId: targetUserId } },
    select: { role: true },
  });
  if (targetMembership?.role === "OWNER")
    throw new OrgError(
      "CANNOT_REMOVE_OWNER",
      "The organisation owner cannot be removed.",
      400,
    );

  // Hard delete — membership record is removed, not just suspended
  return prisma.orgMembership.delete({
    where: { organisationId_userId: { organisationId, userId: targetUserId } },
  });
}

export async function leaveOrganisation(
  organisationId: string,
  userId: string,
) {
  const membership = await prisma.orgMembership.findUnique({
    where: { organisationId_userId: { organisationId, userId } },
    select: { role: true },
  });

  if (!membership)
    throw new OrgError(
      "NOT_A_MEMBER",
      "You are not a member of this organisation.",
      404,
    );
  if (membership.role === "OWNER")
    throw new OrgError(
      "OWNER_CANNOT_LEAVE",
      "Owners cannot leave — dissolve the organisation instead.",
      400,
    );

  return prisma.orgMembership.delete({
    where: { organisationId_userId: { organisationId, userId } },
  });
}

export async function dissolveOrganisation(
  organisationId: string,
  requestingUserId: string,
) {
  const org = await prisma.organisation.findUnique({
    where: { id: organisationId },
    select: { ownerId: true },
  });

  if (!org) throw new OrgError("ORG_NOT_FOUND", "Organisation not found.", 404);
  if (org.ownerId !== requestingUserId)
    throw new OrgError(
      "FORBIDDEN",
      "Only the owner can dissolve the organisation.",
      403,
    );

  // Cascade deletes memberships and invitations via FK ON DELETE CASCADE
  return prisma.organisation.delete({ where: { id: organisationId } });
}

// ---------------------------------------------------------------------------
// Error class
// ---------------------------------------------------------------------------
export class OrgError extends Error {
  public readonly code: string;
  public readonly status: number;
  constructor(code: string, message: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
    this.name = "OrgError";
  }
}

export function isOrgError(error: unknown): error is OrgError {
  return error instanceof OrgError;
}
