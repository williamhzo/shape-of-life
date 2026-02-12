import { readRoundLivePayload } from "@/lib/round-live";

export async function GET(): Promise<Response> {
  try {
    const payload = readRoundLivePayload(process.env.INDEXER_READ_MODEL_PATH);

    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";

    return new Response(
      JSON.stringify({
        status: "unavailable",
        error: `read model unavailable: ${message}`,
      }),
      {
        status: 503,
        headers: {
          "content-type": "application/json; charset=utf-8",
          "cache-control": "no-store",
        },
      },
    );
  }
}
