"use client";

import { CacheProvider } from "@emotion/react";
import createCache from "@emotion/cache";
import { ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import GlobalStyles from "@mui/material/GlobalStyles";
import { useServerInsertedHTML } from "next/navigation";
import { useState, useEffect, type ReactNode } from "react";
import { useLocaleStore } from "@/lib/store/locale-store";
import { theme } from "@/lib/theme";

/** Same statement as the top of globals.css. It must be the first style emitted, so it goes out as the first global style. */
const LAYER_ORDER = "@layer theme, base, mui, components, utilities;";

export function Providers({ children }: { children: ReactNode }) {
  useEffect(() => { useLocaleStore.getState().hydrate(); }, []);
  const [{ cache, flush }] = useState(() => {
    const cache = createCache({ key: "mui", prepend: true });
    cache.compat = true;
    const prevInsert = cache.insert;
    let inserted: string[] = [];
    cache.insert = (...args) => {
      const serialized = args[1];
      // MUI styles go in the `mui` cascade layer, below Tailwind's `components` and `utilities` layers
      // (order set in globals.css), so a className on an MUI control can still override it.
      if (!/^@layer\s+[^{]*$/.test(serialized.styles)) serialized.styles = `@layer mui {${serialized.styles}}`;
      if (cache.inserted[serialized.name] === undefined) {
        inserted.push(serialized.name);
      }
      return prevInsert(...args);
    };
    const flush = () => {
      const prevInserted = inserted;
      inserted = [];
      return prevInserted;
    };
    return { cache, flush };
  });

  useServerInsertedHTML(() => {
    const names = flush();
    if (names.length === 0) {
      return null;
    }
    let styles = LAYER_ORDER;
    for (const name of names) {
      styles += cache.inserted[name];
    }
    return (
      <style
        key={cache.key}
        data-emotion={`${cache.key} ${names.join(" ")}`}
        dangerouslySetInnerHTML={{
          __html: styles,
        }}
      />
    );
  });

  return (
    <CacheProvider value={cache}>
      <ThemeProvider theme={theme}>
        {/* First global style, before CssBaseline: fixes the layer order so MUI sits above Tailwind's preflight and below its utilities. */}
        <GlobalStyles styles={LAYER_ORDER} />
        <CssBaseline enableColorScheme={false} />
        {children}
      </ThemeProvider>
    </CacheProvider>
  );
}
