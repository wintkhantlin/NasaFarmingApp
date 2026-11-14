import { createTheme } from "@mui/material/styles";

declare module "@mui/material/styles" {
  interface Palette {
    surfaceSunken: string;
    line: string;
    lineStrong: string;
    fieldSoft: string;
    water: string;
    waterSoft: string;
    heat: string;
    heatSoft: string;
    drought: string;
    droughtSoft: string;
    frost: string;
    frostSoft: string;
    healthy: string;
    healthySoft: string;
  }
  interface PaletteOptions {
    surfaceSunken?: string;
    line?: string;
    lineStrong?: string;
    fieldSoft?: string;
    water?: string;
    waterSoft?: string;
    heat?: string;
    heatSoft?: string;
    drought?: string;
    droughtSoft?: string;
    frost?: string;
    frostSoft?: string;
    healthy?: string;
    healthySoft?: string;
  }
}

/**
 * Field Almanac MUI theme.
 * Source of truth: DESIGN.md.
 * The Light-Only Rule: light mode only, no dark mode, no theme toggle.
 */
export const theme = createTheme({
  palette: {
    mode: "light",
    background: {
      default: "#f4f3ee", // surface (parchment)
      paper: "#ffffff", // surface-raised
    },
    text: {
      primary: "#1c1b18", // ink (soil)
      secondary: "#5a5850", // ink-muted
    },
    primary: {
      main: "#0e6b4f", // field green
      contrastText: "#ffffff", // on-field
    },
    success: {
      main: "#0e6b4f", // healthy
      contrastText: "#ffffff",
    },
    info: {
      main: "#1d5c91", // water
      contrastText: "#ffffff",
    },
    warning: {
      main: "#7a4a00", // drought
      contrastText: "#ffffff",
    },
    error: {
      main: "#9c3d12", // heat
      contrastText: "#ffffff",
    },
    surfaceSunken: "#eceae3",
    line: "#d9d6cc",
    lineStrong: "#8f8c82",
    fieldSoft: "#e3f2ec",
    water: "#1d5c91",
    waterSoft: "#dce8f2",
    heat: "#9c3d12",
    heatSoft: "#f8e3d8",
    drought: "#7a4a00",
    droughtSoft: "#fbefd5",
    frost: "#4850a6",
    frostSoft: "#e3e4f5",
    healthy: "#0e6b4f",
    healthySoft: "#e3f2ec",
  },
  typography: {
    fontFamily: 'var(--font-sans), system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
    allVariants: {
      color: "#1c1b18",
    },
    h1: {
      fontSize: "2.5rem",
      lineHeight: "2.75rem",
      fontWeight: 700,
      letterSpacing: "-0.02em",
    },
    h2: {
      fontSize: "1.5rem",
      lineHeight: "1.875rem",
      fontWeight: 650,
      letterSpacing: "-0.01em",
    },
    h3: {
      fontSize: "1.1875rem",
      lineHeight: "1.625rem",
      fontWeight: 600,
    },
    body1: {
      fontSize: "1rem",
      lineHeight: "1.5rem",
      fontWeight: 400,
    },
    body2: {
      fontSize: "0.875rem",
      lineHeight: "1.25rem",
      fontWeight: 400,
      color: "#5a5850",
    },
    button: {
      fontSize: "0.875rem",
      lineHeight: "1.125rem",
      fontWeight: 500,
      textTransform: "none",
    },
  },
  shape: {
    borderRadius: 10,
  },
  components: {
    MuiButtonBase: {
      defaultProps: {
        disableRipple: true,
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          minHeight: 44, // --spacing-tap
          minWidth: 44,
          borderRadius: 10,
          textTransform: "none",
          fontWeight: 500,
          boxShadow: "none",
          "&:hover": {
            boxShadow: "none",
          },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 999,
          fontWeight: 500,
          fontSize: "0.875rem",
          height: "auto",
          paddingTop: "4px",
          paddingBottom: "4px",
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: "none",
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundColor: "#ffffff",
          border: "1px solid #d9d6cc",
          borderRadius: 10,
          boxShadow: "none",
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          backgroundColor: "#ffffff",
          borderRadius: 16,
          boxShadow: "0 8px 24px -12px rgb(31 29 23 / 0.35)",
        },
      },
    },
    MuiSkeleton: {
      styleOverrides: {
        root: {
          backgroundColor: "#eceae3",
        },
      },
    },
  },
});
