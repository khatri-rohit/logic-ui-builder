const CLERK_SANS_STACK =
  "var(--font-sans), var(--font-geist-sans), Inter, 'Segoe UI', sans-serif";

const CLERK_MONO_STACK =
  "'JetBrains Mono', var(--font-geist-mono), ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";

const PROFILE_PAGE_PADDING = "16px 18px 18px";
const PROFILE_SECTION_ROW_PADDING = "14px 16px";

const baseVariables = {
  colorBackground: "#111111",
  colorForeground: "#e6e6e6",
  colorPrimary: "#ffffff",
  colorPrimaryForeground: "#000000",
  colorDanger: "#ba1a1a",
  colorBorder: "#232323",
  colorNeutral: "#f1f1f1",
  colorMuted: "#171717",
  colorMutedForeground: "#808080",
  colorInput: "#151515",
  colorInputForeground: "#f4f4f4",
  colorModalBackdrop: "rgba(6, 6, 6, 0.84)",
  colorRing: "#8a8a8a",
  borderRadius: "2px",
  fontFamily: CLERK_SANS_STACK,
  fontFamilyButtons: CLERK_MONO_STACK,
};

export const clerkUserButtonAppearance = {
  variables: baseVariables,
  elements: {
    userButtonTrigger: {
      border: "1px solid #2a2a2a",
      borderRadius: "2px",
      backgroundColor: "#111111",
      padding: "3px",
      transition: "background-color 120ms ease, border-color 120ms ease",
      boxShadow: "none",
      "&:hover": {
        backgroundColor: "#1a1a1a",
        borderColor: "#3a3a3a",
      },
      "&:focus-visible": {
        outline: "1px solid #7f7f7f",
        outlineOffset: "1px",
      },
    },
    userButtonTrigger__open: {
      backgroundColor: "#1a1a1a",
      borderColor: "#4a4a4a",
    },
    userButtonAvatarBox: {
      width: "30px",
      height: "30px",
      borderRadius: "2px",
      border: "1px solid #313131",
      overflow: "hidden",
    },
    userButtonAvatarImage: {
      borderRadius: "2px",
      objectFit: "cover",
    },
    userButtonPopoverCard: {
      backgroundColor: "#111111",
      border: "1px solid #272727",
      borderRadius: "2px",
      boxShadow:
        "0 0 0 1px rgba(255,255,255,0.04), 0 16px 34px -22px rgba(0,0,0,0.95)",
      overflow: "hidden",
      minWidth: "236px",
    },
    userButtonPopoverMain: {
      padding: "4px",
      gap: "4px",
    },
    userButtonPopoverActions: {
      gap: "4px",
    },
    userButtonPopoverActionButton: {
      borderRadius: "2px",
      border: "1px solid #202020",
      backgroundColor: "#151515",
      color: "#f2f2f2",
      fontFamily: CLERK_MONO_STACK,
      fontSize: "11px",
      letterSpacing: "0.14em",
      textTransform: "uppercase",
      transition: "background-color 120ms ease, border-color 120ms ease",
      boxShadow: "none",
      "&:hover": {
        backgroundColor: "#202020",
        borderColor: "#303030",
      },
      "&:focus-visible": {
        outline: "1px solid #818181",
        outlineOffset: "1px",
      },
    },
    userButtonPopoverActionButton__manageAccount: {
      backgroundColor: "#1a1a1a",
      borderColor: "#3a3a3a",
    },
    userButtonPopoverActionButtonIcon: {
      color: "#d9d9d9",
    },
    userButtonPopoverCustomItemButton: {
      borderRadius: "2px",
      border: "1px solid #202020",
      backgroundColor: "#151515",
      color: "#f2f2f2",
      fontFamily: CLERK_MONO_STACK,
      fontSize: "11px",
      letterSpacing: "0.14em",
      textTransform: "uppercase",
      justifyContent: "flex-start",
      transition: "background-color 120ms ease, border-color 120ms ease",
      boxShadow: "none",
      "&:hover": {
        backgroundColor: "#202020",
        borderColor: "#303030",
      },
      "&:focus-visible": {
        outline: "1px solid #818181",
        outlineOffset: "1px",
      },
    },
    userButtonPopoverCustomItemButtonIconBox: {
      minWidth: "16px",
      minHeight: "16px",
      alignItems: "center",
      justifyContent: "center",
    },
    userButtonPopoverActionItemButtonIcon: {
      color: "#d9d9d9",
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      width: "16px",
      height: "16px",
      flexShrink: 0,
      fontSize: "12px",
      lineHeight: 1,
      fontWeight: 700,
      "&:empty::before": {
        content: '"👑"',
        display: "block",
      },
    },
    userButtonPopoverFooter: {
      borderTop: "1px solid #232323",
      backgroundColor: "#111111",
      padding: "8px 10px",
    },
    userButtonPopoverFooterPagesLink: {
      color: "#8b8b8b",
      fontFamily: CLERK_MONO_STACK,
      fontSize: "10px",
      letterSpacing: "0.12em",
      textTransform: "uppercase",
      "&:hover": {
        color: "#f2f2f2",
      },
    },
  },
};

export const clerkUserProfileAppearance = {
  variables: baseVariables,
  elements: {
    modalBackdrop: {
      backgroundColor: "rgba(7, 7, 7, 0.84)",
      backdropFilter: "blur(2px)",
    },
    modalContent: {
      backgroundColor: "transparent",
      border: "none",
      boxShadow: "none",
      padding: "0",
    },
    card: {
      backgroundColor: "#111111",
      border: "1px solid #252525",
      borderRadius: "2px",
      boxShadow:
        "0 0 0 1px rgba(255,255,255,0.03), 0 20px 40px -26px rgba(0,0,0,0.98)",
      overflow: "hidden",
    },
    header: {
      borderBottom: "1px solid #212121",
      backgroundColor: "#111111",
      padding: "14px 16px",
    },
    headerTitle: {
      color: "#f5f5f5",
      fontFamily: CLERK_MONO_STACK,
      fontSize: "11px",
      letterSpacing: "0.18em",
      textTransform: "uppercase",
      fontWeight: 700,
    },
    headerSubtitle: {
      color: "#888888",
      fontSize: "12px",
    },
    navbar: {
      borderRight: "1px solid #212121",
      backgroundColor: "#101010",
      padding: "10px",
      gap: "6px",
    },
    navbarButtons: {
      padding: "2px",
      gap: "6px",
    },
    navbarButton: {
      borderRadius: "2px",
      border: "1px solid transparent",
      backgroundColor: "transparent",
      color: "#b5b5b5",
      fontFamily: CLERK_MONO_STACK,
      textTransform: "uppercase",
      letterSpacing: "0.14em",
      fontSize: "10px",
      padding: "10px 12px",
      transition:
        "color 120ms ease, background-color 120ms ease, border-color 120ms ease",
      "&:hover": {
        backgroundColor: "#1a1a1a",
        color: "#efefef",
      },
    },
    navbarButton__active: {
      borderColor: "#333333",
      backgroundColor: "#1a1a1a",
      color: "#ffffff",
    },
    navbarButtonIcon: {
      color: "#979797",
    },
    navbarButtonIcon__active: {
      color: "#ffffff",
    },
    navbarButtonText: {
      fontFamily: CLERK_MONO_STACK,
    },
    page: {
      backgroundColor: "#111111",
      color: "#e9e9e9",
    },
    pageScrollBox: {
      padding: PROFILE_PAGE_PADDING,
    },
    profilePage: {
      padding: "0",
    },
    profileSection: {
      border: "1px solid #252525",
      borderRadius: "2px",
      backgroundColor: "#121212",
      boxShadow: "none",
      overflow: "hidden",
    },
    profileSectionHeader: {
      padding: PROFILE_SECTION_ROW_PADDING,
    },
    profileSectionContent: {
      padding: "0 16px 14px",
    },
    profileSectionItemList: {
      padding: "0",
      margin: "0",
    },
    profileSectionItem: {
      padding: PROFILE_SECTION_ROW_PADDING,
      gap: "12px",
    },
    profileSectionButtonGroup: {
      padding: "10px 16px 14px",
      gap: "8px",
    },
    profileSectionTitleText: {
      color: "#f1f1f1",
      fontFamily: CLERK_MONO_STACK,
      fontSize: "10px",
      letterSpacing: "0.15em",
      textTransform: "uppercase",
      fontWeight: 700,
    },
    profileSectionSubtitleText: {
      color: "#8a8a8a",
      fontSize: "12px",
    },
    formFieldLabel: {
      color: "#d7d7d7",
      fontFamily: CLERK_MONO_STACK,
      fontSize: "10px",
      letterSpacing: "0.12em",
      textTransform: "uppercase",
    },
    formFieldInput: {
      border: "1px solid #2b2b2b",
      borderRadius: "2px",
      backgroundColor: "#141414",
      color: "#f4f4f4",
      boxShadow: "none",
      "&:focus": {
        borderColor: "#4a4a4a",
      },
    },
    formButtonPrimary: {
      borderRadius: "2px",
      border: "1px solid #ffffff",
      backgroundColor: "#ffffff",
      color: "#000000",
      fontFamily: CLERK_MONO_STACK,
      fontSize: "11px",
      letterSpacing: "0.16em",
      textTransform: "uppercase",
      boxShadow: "none",
      "&:hover": {
        backgroundColor: "#111111",
        color: "#ffffff",
      },
    },
    formButtonReset: {
      borderRadius: "2px",
      border: "1px solid #2b2b2b",
      backgroundColor: "#141414",
      color: "#d7d7d7",
      fontFamily: CLERK_MONO_STACK,
      fontSize: "10px",
      letterSpacing: "0.13em",
      textTransform: "uppercase",
      boxShadow: "none",
      "&:hover": {
        backgroundColor: "#1d1d1d",
        color: "#f2f2f2",
      },
    },
    badge: {
      borderRadius: "2px",
      border: "1px solid #303030",
      backgroundColor: "#181818",
      color: "#f0f0f0",
      fontFamily: CLERK_MONO_STACK,
      fontSize: "10px",
      letterSpacing: "0.13em",
      textTransform: "uppercase",
    },
    modalCloseButton: {
      borderRadius: "2px",
      border: "1px solid #2a2a2a",
      backgroundColor: "#111111",
      color: "#dddddd",
      "&:hover": {
        backgroundColor: "#1b1b1b",
      },
    },
  },
};

export const clerkAppearance = {
  cssLayerName: "clerk",
  theme: "simple" as const,
  options: {
    shimmer: false,
  },
  variables: baseVariables,
  userButton: clerkUserButtonAppearance,
  userProfile: clerkUserProfileAppearance,
};
