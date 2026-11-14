// @vitest-environment jsdom
import { describe, expect, test, vi, beforeEach } from "vitest";
import { createBackupPayload, downloadBlob, downloadCsv, downloadJson, generateWeatherCsv } from "../../lib/download";
import type { DailyWeather } from "../../lib/nasa/power";
import type { Field, Rotation } from "../../lib/types";

describe("download utilities", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  test("generateWeatherCsv creates standard CSV rows from DailyWeather", () => {
    const mockWeather: DailyWeather = {
      latitude: 20.15,
      longitude: 94.95,
      elevationM: 100,
      dates: ["2025-01-01", "2025-01-02"],
      series: {
        PRECTOTCORR: [0, 12.5],
        T2M_MAX: [30.2, 28.4],
        T2M_MIN: [18.1, 17.5],
        T2M: [24.1, 22.9],
        RH2M: [55.2, 60.1],
        WS2M: [2.1, 3.4],
        ALLSKY_SFC_SW_DWN: [19.2, 16.8],
        PS: [99.2, 99.1],
      },
      source: { dataset: "NASA POWER", resolution: "0.5", version: "2.0" },
      meta: {
        fillValue: -999,
        timeStandard: "UTC",
        sources: ["MERRA2"],
        units: {},
        apiVersion: "2.0",
        start: "2025-01-01",
        end: "2025-01-02",
      },
    };

    const csv = generateWeatherCsv("South Plot", mockWeather);
    expect(csv).toContain("Date,Rainfall_mm,Tmax_C,Tmin_C,Tmean_C,RelativeHumidity_Pct,WindSpeed_ms,SolarRadiation_MJ_m2_day,Pressure_kPa");
    expect(csv).toContain("2025-01-01,0.00,30.20,18.10,24.10,55.20,2.10,19.20,99.20");
    expect(csv).toContain("2025-01-02,12.50,28.40,17.50,22.90,60.10,3.40,16.80,99.10");
  });

  test("createBackupPayload generates compliant Backup object", () => {
    const mockFields: Field[] = [
      {
        id: "f1",
        name: "Plot 1",
        geometry: { type: "Point", coordinates: [94.95, 20.15] },
        areaHa: 2.5,
        centroid: [94.95, 20.15],
        samplePoints: [[94.95, 20.15]],
        irrigation: "none",
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
      },
    ];
    const mockRotations: Rotation[] = [];

    const payload = createBackupPayload(mockFields, mockRotations);
    expect(payload.app).toBe("nasa-farming-app");
    expect(payload.version).toBe(2);
    expect(payload.fields).toHaveLength(1);
    expect(payload.rotations).toHaveLength(0);
    expect(payload.exportedAt).toBeDefined();
  });

  test("downloadBlob safely creates an anchor and triggers click in DOM environment", () => {
    const createObjectURLMock = vi.fn().mockReturnValue("blob:http://localhost/1234");
    const revokeObjectURLMock = vi.fn();
    global.URL.createObjectURL = createObjectURLMock;
    global.URL.revokeObjectURL = revokeObjectURLMock;

    const clickMock = vi.fn();
    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation((tag) => {
      const el = originalCreateElement(tag);
      if (tag === "a") {
        el.click = clickMock;
      }
      return el;
    });

    const blob = new Blob(["hello"], { type: "text/plain" });
    downloadBlob("test.txt", blob);

    expect(createObjectURLMock).toHaveBeenCalledWith(blob);
    expect(clickMock).toHaveBeenCalled();

    // Verify downloadJson and downloadCsv call createObjectURL with appropriate blobs
    downloadJson("test.json", { a: 1 });
    expect(createObjectURLMock).toHaveBeenCalledTimes(2);

    downloadCsv("test.csv", "A,B\n1,2");
    expect(createObjectURLMock).toHaveBeenCalledTimes(3);
  });
});
