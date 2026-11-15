import { describe, expect, it } from "vitest";
import { getManifest, getOfflineWeather, getOfflineSoil } from "../../lib/server/offline-dataset";

describe("Offline Dataset Pre-downloaded Fallback for Vercel & Offline Environments", () => {
  it("loads the predownload manifest cleanly with all hubs and cells", async () => {
    const manifest = await getManifest();
    expect(manifest).not.toBeNull();
    expect(manifest?.weatherCells.length).toBeGreaterThanOrEqual(22);
    expect(manifest?.soilProfiles.length).toBeGreaterThanOrEqual(25);
    expect(manifest?.regions).toContain("ayeyarwady");
    expect(manifest?.regions).toContain("magway");
  });

  it("finds the nearest predownloaded NASA POWER weather cell for Pathein coordinates", async () => {
    // Pathein, Ayeyarwady: ~16.78, 94.73
    const weather = await getOfflineWeather(16.78, 94.73);
    expect(weather).not.toBeNull();
    expect(weather?.dates.length).toBeGreaterThan(1000);
    expect(weather?.latitude).toBeCloseTo(17.0, 0.5);
    expect(weather?.longitude).toBeCloseTo(95.0, 0.5);
    expect(weather?.meta.sources).toContain("Heartland Offline Pre-downloaded Archive");
  });

  it("finds the nearest predownloaded NASA POWER weather cell for Magway coordinates", async () => {
    // Magway City: ~20.15, 94.95
    const weather = await getOfflineWeather(20.15, 94.95);
    expect(weather).not.toBeNull();
    expect(weather?.dates.length).toBeGreaterThan(1000);
    expect(weather?.meta.sources).toContain("Heartland Offline Pre-downloaded Archive");
  });

  it("returns null when coordinates are far outside Myanmar agricultural bounds", async () => {
    // Somewhere in the Atlantic Ocean: 0, 0
    const weather = await getOfflineWeather(0, 0);
    expect(weather).toBeNull();

    const soil = await getOfflineSoil(0, 0);
    expect(soil).toBeNull();
  });

  it("finds valid predownloaded SoilGrids profile for an agricultural region", async () => {
    // Minbu / Magway region: ~20.18, 94.87
    const soil = await getOfflineSoil(20.18, 94.87);
    expect(soil).not.toBeNull();
    expect(typeof soil?.ph).toBe("number");
    expect(soil?.source.dataset).toContain("Pre-downloaded Archive");
  });
});
