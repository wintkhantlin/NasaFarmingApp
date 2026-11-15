/** @vitest-environment jsdom */
import { afterEach, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { TownshipPicker, type AreaSelection } from "@/components/geospatial-farmer/township-picker";
import { contextAtPoint, parseTownships, townshipBounds, type Townships } from "@/lib/geospatial-farmer/geospatial/townships";
import { createRepository } from "@/lib/store/repository";
import { memoryStorage } from "@/lib/store/storage";
const properties = { ST: "Example region", ST_PCODE: "ST1", DT: "Example district", DT_PCODE: "DT1", TS: "Example township", TS_PCODE: "TS1", TS_MMR: "မြို့နယ်" };
const rings = [[[95,20],[96,20],[96,21],[95,21],[95,20]]];
const data: Townships = { type: "FeatureCollection", features: [{ type: "Feature", properties, geometry: { type: "Polygon", coordinates: rings } }] };
afterEach(cleanup);
it("supports Polygon and MultiPolygon and preserves actual coordinates in persistence", async () => {
  expect(townshipBounds(data)).toEqual([95,20,96,21]);
  expect(contextAtPoint(data,[95.5,20.5])).toEqual(properties);
  expect(contextAtPoint(data,[94,20])).toBeUndefined();
  const multi: Townships = { ...data, features: [{ ...data.features[0], geometry: { type: "MultiPolygon", coordinates: [rings] } }] };
  expect(contextAtPoint(multi,[95.5,20.5])).toEqual(properties);
  expect(contextAtPoint({ ...data, features: [...data.features,...data.features] },[95.5,20.5])).toBeUndefined();
  const repo = createRepository(memoryStorage());
  const field = await repo.createField({ name: "Actual field", irrigation: "none", geometry: { type: "Point", coordinates: [95.2,20.3] }, administrativeContext: properties });
  expect((await repo.getField(field.id))?.administrativeContext).toEqual(properties);
  expect(field.centroid).toEqual([95.2,20.3]);
  expect(field.locationConfirmed).toBe(false);
});
it("requires 162 unique nonempty codes", () => {
  const full = { ...data, features: Array.from({length:162}, (_, i) => ({ ...data.features[0], properties: { ...properties, TS_PCODE: `T${i}` } })) };
  expect(parseTownships(full).features).toHaveLength(162);
  expect(() => parseTownships(data)).toThrow();
  expect(() => parseTownships({ ...full, features: full.features.map((f) => ({ ...f, properties })) })).toThrow();
  expect(() => parseTownships({ ...full, features: full.features.map((f) => ({ ...f, properties: {...f.properties, TS_PCODE: ""} })) })).toThrow();
});
it("cascades selections, shows Myanmar names and clears children", () => {
  function Harness() {
    const [selection, setSelection] = useState<AreaSelection>({region:"",district:"",township:""});
    return <TownshipPicker data={data} selection={selection} onChange={setSelection} error={null}/>;
  }
  render(<Harness/>);
  expect(screen.getByLabelText("District")).toBeDisabled();
  fireEvent.change(screen.getByLabelText("Region or state"),{ target:{value:"ST1"} });
  fireEvent.change(screen.getByLabelText("District"),{ target:{value:"DT1"} });
  fireEvent.change(screen.getByLabelText("Township"),{ target:{value:"TS1"} });
  expect(screen.getByRole("option",{name:"Example township / မြို့နယ်"})).toBeInTheDocument();
  expect(screen.getByLabelText("Township")).toHaveValue("TS1");
  fireEvent.change(screen.getByLabelText("Region or state"),{ target:{value:""} });
  expect(screen.getByLabelText("Township")).toHaveValue("");
  expect(screen.getByLabelText("Township")).toBeDisabled();
});

it("validates the full 162-township dataset when local file is present", async () => {
  const fs = await import("node:fs");
  const path = "/private/tmp/field-shift-townships-local.geojson";
  if (!fs.existsSync(path)) return;

  const raw = JSON.parse(fs.readFileSync(path, "utf-8"));
  const parsed = parseTownships(raw);
  expect(parsed.features).toHaveLength(162);

  const pcodes = new Set<string>();
  const stPcodes = new Set<string>();
  for (const feature of parsed.features) {
    const { TS_PCODE, ST_PCODE, TS, DT, ST } = feature.properties;
    expect(TS_PCODE).toBeTruthy();
    expect(pcodes.has(TS_PCODE)).toBe(false);
    pcodes.add(TS_PCODE);
    stPcodes.add(ST_PCODE);
    expect(TS).toBeTruthy();
    expect(DT).toBeTruthy();
    expect(ST).toBeTruthy();

    const geom = feature.geometry;
    expect(["Polygon", "MultiPolygon"]).toContain(geom.type);
    const polygons = geom.type === "Polygon" ? [geom.coordinates] : geom.coordinates;
    for (const poly of polygons) {
      for (const ring of poly) {
        expect(ring.length).toBeGreaterThanOrEqual(4);
        expect(ring[0]).toEqual(ring[ring.length - 1]);
        for (const [lon, lat] of ring) {
          expect(lon).toBeGreaterThanOrEqual(90);
          expect(lon).toBeLessThanOrEqual(105);
          expect(lat).toBeGreaterThanOrEqual(9);
          expect(lat).toBeLessThanOrEqual(28);
        }
      }
    }
  }

  expect(pcodes.size).toBe(162);
  expect(stPcodes.size).toBe(8);
});

it("handles study area boundaries API endpoint responses", async () => {
  const { GET } = await import("@/app/api/study-area/boundaries/route");
  const req = new Request("http://localhost/api/study-area/boundaries", {
    headers: { "accept-encoding": "gzip" },
  });
  const res = await GET(req);
  expect([200, 503]).toContain(res.status);
  if (res.status === 200) {
    expect(res.headers.get("content-type")).toBe("application/geo+json");
  }
});
