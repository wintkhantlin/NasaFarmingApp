import { buildEngineRequest, parseFarmerRequest } from "@/lib/rotation/farmer-request";
import { resolveEnvironment } from "@/lib/rotation/environment";
import { POST as runRecommendation } from "../route";

export async function POST(request: Request) {
  let input;
  try {
    input = parseFarmerRequest(await request.json());
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Please check the farm details." }, { status: 400 });
  }
  try {
    const environment = await resolveEnvironment(input);
    const engineRequest = buildEngineRequest(input, environment.snapshot);
    const engineResponse = await runRecommendation(new Request("http://localhost/api/rotation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(engineRequest),
    }));
    const recommendation = await engineResponse.json();
    if (!engineResponse.ok) return Response.json(recommendation, { status: engineResponse.status });
    return Response.json({ environment: { state: environment.state, note: environment.note }, recommendation });
  } catch (error) {
    console.error("Rotation exploration failed:", error);
    return Response.json({ error: error instanceof Error ? error.message : "Could not load environmental data." }, { status: 502 });
  }
}
