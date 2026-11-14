import { beforeEach, describe, expect, test } from "vitest";
import { advance, geometryHash, periodFor } from "../../lib/server/remote-sensing";
import { memoryCache } from "../../lib/server/cache";
import { resetAppeearsToken } from "../../lib/nasa/appeears/client";
import { imergBackfill } from "../../lib/server/imerg-backfill";

const field = { id: "field-1234567890", geometry: { type: "Point" as const, coordinates: [94.95, 20.15] as [number, number] }, centroid: [94.95, 20.15] as [number, number] };
const env = { EARTHDATA_USERNAME: "u", EARTHDATA_PASSWORD: "p" };

/** A tiny AppEEARS: login, task, status, bundle, file. Records the calls it saw. */
function fakeAppeears(opts: { status?: string; csv?: string } = {}) {
  const calls: string[] = [];
  const bodies: unknown[] = [];
  const f = (async (url: string, init?: RequestInit) => {
    const u = String(url);
    calls.push(`${init?.method ?? "GET"} ${u.replace("https://appeears.earthdatacloud.nasa.gov/api", "")}`);
    const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { "content-type": "application/json" } });
    if (u.endsWith("/login")) return json({ token: "tok", expiration: new Date(Date.now() + 3_600_000).toISOString() });
    if (u.endsWith("/task") && init?.method === "POST") {
      bodies.push(JSON.parse(String(init.body)));
      return json({ task_id: "t1", status: "pending" });
    }
    if (u.endsWith("/task/t1")) return json({ status: opts.status ?? "done" });
    if (u.endsWith("/bundle/t1")) return json({ files: [{ file_id: "f1", file_name: "t1-SPL4SMGP-008-results.csv" }] });
    if (u.endsWith("/bundle/t1/f1")) return new Response(opts.csv ?? "");
    return json({}, 404);
  }) as unknown as typeof fetch;
  return { f, calls, bodies };
}

beforeEach(() => resetAppeearsToken());

describe("AppEEARS job state machine", () => {
  test("without credentials every source says unconfigured and no request is made", async () => {
    const fake = fakeAppeears();
    const s = await advance("smap", field, { fetch: fake.f, env: {}, cache: memoryCache() });
    expect(s.status).toBe("unconfigured");
    expect(s.data).toBeUndefined();
    expect(fake.calls).toHaveLength(0);
  });

  test("login, submit a point task, then read the SMAP CSV when the task is done", async () => {
    const csv = [
      "ID,Latitude,Longitude,Date,SPL4SMGP_008_Geophysical_Data_sm_surface,SPL4SMGP_008_Geophysical_Data_sm_rootzone,SPL4SMGP_008_Geophysical_Data_sm_rootzone_pctl",
      "a,20.15,94.95,2025-06-01,0.2,0.3,40",
      "a,20.15,94.95,2025-06-02,-9999,-9999,-9999",
    ].join("\n");
    const fake = fakeAppeears({ csv });
    const cache = memoryCache();
    const ctx = { fetch: fake.f, env, cache };

    const first = await advance("smap", field, ctx);
    expect(first.status).toBe("pending");
    expect(first.taskId).toBe("t1");
    const task = fake.bodies[0] as { task_type: string; params: { dates: Array<{ endDate: string }>; layers: Array<{ layer: string }> } };
    expect(task.task_type).toBe("point");
    expect(task.params.dates[0].endDate).toBe("12-31-2025"); // stops before the 2026 notice
    expect(task.params.layers.map((l) => l.layer)).toContain("Geophysical_Data_sm_rootzone");

    const second = await advance("smap", field, ctx);
    expect(second.status).toBe("ok");
    const days = (second.data as { days: Array<{ date: string; rootzone: number | null }> }).days;
    expect(days[0].rootzone).toBeCloseTo(0.3);
    expect(days[1].rootzone).toBeNull();
    // the job is not submitted twice
    expect(fake.calls.filter((c) => c.startsWith("POST /task"))).toHaveLength(1);
    // and the finished result is served from the cache without another call
    const before = fake.calls.length;
    const third = await advance("smap", field, ctx);
    expect(third.status).toBe("ok");
    expect(fake.calls.length).toBe(before);
  });

  test("a task that is still running stays pending", async () => {
    const fake = fakeAppeears({ status: "processing" });
    const ctx = { fetch: fake.f, env, cache: memoryCache() };
    await advance("smap", field, ctx);
    const again = await advance("smap", field, ctx);
    expect(again.status).toBe("pending");
    expect(again.data).toBeUndefined();
  });

  test("the same geometry hashes the same, and periods match the handoff", () => {
    expect(geometryHash(field.geometry)).toBe(geometryHash({ type: "Point", coordinates: [94.95, 20.15] }));
    expect(geometryHash(field.geometry)).not.toBe(geometryHash({ type: "Point", coordinates: [94.96, 20.15] }));
    expect(periodFor("smap").end).toBe("2025-12-31");
    expect(periodFor("srtm")).toEqual({ start: "2000-02-11", end: "2000-02-21" });
  });
});

describe("IMERG backfill", () => {
  test("without a token it reports unconfigured and fetches nothing", async () => {
    let calls = 0;
    const f = (async () => {
      calls++;
      return new Response("{}");
    }) as unknown as typeof fetch;
    const r = await imergBackfill(20.15, 94.95, { start: "2025-01-01", end: "2025-01-03" }, { fetch: f, env: {}, cache: memoryCache() });
    expect(r.status).toBe("unconfigured");
    expect(r.days).toHaveLength(0);
    expect(calls).toBe(0);
  });

  test("it fetches a bounded batch per call and reports progress", async () => {
    const entries = ["2025-01-01", "2025-01-02", "2025-01-03"].map((d) => ({
      id: d,
      producer_granule_id: `3B-DAY.${d}.nc4`,
      time_start: `${d}T00:00:00.000Z`,
      links: [{ rel: "http://esipfed.org/ns/fedsearch/1.1/service#", href: `https://opendap.earthdata.nasa.gov/granule-${d}` }],
    }));
    let opendapCalls = 0;
    const f = (async (url: string) => {
      const u = String(url);
      if (u.includes("cmr.earthdata.nasa.gov")) return new Response(JSON.stringify({ feed: { entry: entries } }));
      opendapCalls++;
      return new Response("precipitation[0][1][1]\n2.5\nprecipitation_cnt[0][1][1]\n48\nrandomError[0][1][1]\n0.4\nrandomError_cnt[0][1][1]\n48");
    }) as unknown as typeof fetch;
    const cache = memoryCache();
    const e = { EARTHDATA_TOKEN: "t" };
    const first = await imergBackfill(20.15, 94.95, { start: "2025-01-01", end: "2025-01-03" }, { fetch: f, env: e, cache, batch: 2 });
    expect(first.status).toBe("pending");
    expect(first.covered).toBe(2);
    expect(opendapCalls).toBe(2);
    const second = await imergBackfill(20.15, 94.95, { start: "2025-01-01", end: "2025-01-03" }, { fetch: f, env: e, cache, batch: 2 });
    expect(second.status).toBe("ok");
    expect(second.covered).toBe(3);
    expect(opendapCalls).toBe(3); // earlier days were not fetched again
    expect(second.days[0].precipMm).toBe(2.5);
  });

  test("days NASA has not published (Final V07 ends in September 2025) do not keep the job pending forever", async () => {
    // CMR lists granules for three of the four requested days; the fourth does not exist in the archive.
    const entries = ["2025-09-28", "2025-09-29", "2025-09-30"].map((d) => ({
      id: d,
      producer_granule_id: `3B-DAY.${d}.nc4`,
      time_start: `${d}T00:00:00.000Z`,
      links: [{ rel: "http://esipfed.org/ns/fedsearch/1.1/service#", href: `https://opendap.earthdata.nasa.gov/granule-${d}` }],
    }));
    const f = (async (url: string) => {
      if (String(url).includes("cmr.earthdata.nasa.gov")) return new Response(JSON.stringify({ feed: { entry: entries } }));
      return new Response("precipitation[0][1][1]\n2.5\nprecipitation_cnt[0][1][1]\n48\nrandomError[0][1][1]\n0.4\nrandomError_cnt[0][1][1]\n48");
    }) as unknown as typeof fetch;
    const r = await imergBackfill(20.15, 94.95, { start: "2025-09-28", end: "2025-10-01" }, { fetch: f, env: { EARTHDATA_TOKEN: "t" }, cache: memoryCache() });
    expect(r.covered).toBe(3);
    expect(r.expected).toBe(4); // the shortfall stays visible: 3 of 4 days, never padded
    expect(r.status).toBe("ok");
  });
});
