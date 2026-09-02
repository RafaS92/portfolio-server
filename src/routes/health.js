import { Router } from "express";
import { checkReadiness as defaultReadinessCheck } from "../services/readiness.js";

export function createHealthRouter({
  checkReadiness = defaultReadinessCheck,
} = {}) {
  const router = Router();

  router.get("/healthz", (_req, res) => {
    res.setHeader("cache-control", "no-store");
    return res.status(200).json({ status: "ok" });
  });

  router.get("/readyz", async (_req, res) => {
    res.setHeader("cache-control", "no-store");
    const result = await checkReadiness();
    return res.status(result.ready ? 200 : 503).json({
      status: result.ready ? "ready" : "not_ready",
      services: result.services,
    });
  });

  return router;
}

export const healthRouter = createHealthRouter();
