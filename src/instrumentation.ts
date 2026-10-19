export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  // No correr durante `next build`
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  const { startup } = await import("./lib/startup");
  await startup();
}
