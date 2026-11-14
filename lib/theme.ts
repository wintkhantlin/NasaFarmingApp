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
      default: "#f4f2ea", // surface (parchment)
      paper: "#fbfaf6", // surface-raised
    },
    text: {
      primary: "#1f1d17", // ink (soil)
      secondary: "#5a564a", // ink-muted
    },
    primary: {
      main: "#2e5e3a", // field green
      contrastText: "#fbfaf6", // on-field
    },
    success: {
      main: "#2e5e3a", // healthy
      contrastText: "#fbfaf6",
    },
    info: {
      main: "#1d5c91", // water
      contrastText: "#fbfaf6",
    },
    warning: {
      main: "#765709", // drought
      contrastText: "#fbfaf6",
    },
    error: {
      main: "#a33d17", // heat
      contrastText: "#fbfaf6",
    },
    surfaceSunken: "#e9e6da",
    line: "#d8d3c2",
    lineStrong: "#8c8676",
    fieldSoft: "#dfe8d8",
    water: "#1d5c91",
    waterSoft: "#dce8f2",
    heat: "#a33d17",
    heatSoft: "#f6e1d6",
    drought: "#765709",
    droughtSoft: "#f1e6c8",
    frost: "#4850a6",
    frostSoft: "#e3e4f5",
    healthy: "#2e5e3a",
    healthySoft: "#dfe8d8",
  },
  typography: {
    fontFamily: 'var(--font-sans), ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
    allVariants: {
      color: "#1f1d17",
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
      color: "#5a564a",
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
          backgroundColor: "#fbfaf6",
          border: "1px solid #d8d3c2",
          borderRadius: 10,
          boxShadow: "none",
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          backgroundColor: "#fbfaf6",
          borderRadius: 16,
          boxShadow: "0 8px 24px -12px rgb(31 29 23 / 0.35)",
        },
      },
    },
    MuiSkeleton: {
      styleOverrides: {
        root: {
          backgroundColor: "#e9e6da",
        },
      },
    },
  },
});
