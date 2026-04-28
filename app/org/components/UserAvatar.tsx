interface UserAvatarProps {
  name: string;
  className?: string;
}

export function UserAvatar({ name, className }: UserAvatarProps) {
  return (
    <div
      className={`flex h-8 w-8 items-center justify-center rounded-full bg-muted text-sm font-medium ${className || ""}`}
    >
      {(name.trim().charAt(0) || "?").toUpperCase()}
    </div>
  );
}
