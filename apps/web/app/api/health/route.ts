export async function GET(): Promise<Response> {
  return new Response(
    JSON.stringify({
      service: "shape-of-life-web",
      status: "ok",
      now: new Date().toISOString(),
    }),
    {
      status: 200,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store",
      },
    },
  );
}
