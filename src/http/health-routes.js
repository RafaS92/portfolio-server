import { Router } from "express";

export function createHealthRouter({ readinessCheck }) {
  const router = Router();

  router.get("/healthz", (_req, res) => {
    res.setHeader("cache-control", "no-store");
    return res.status(200).json({ status: "ok" });
  });

  router.get("/readyz", async (_req, res) => {
    res.setHeader("cache-control", "no-store");
    const result = await readinessCheck();
    return res.status(result.ready ? 200 : 503).json({
      status: result.ready ? "ready" : "not_ready",
      services: result.services,
    });
  });

  return router;
}
