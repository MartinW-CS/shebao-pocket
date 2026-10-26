export function GET() {
  return Response.json({ app: 'shebao-pocket', localLauncher: 1 }, {
    headers: { 'Cache-Control': 'no-store' },
  });
}
