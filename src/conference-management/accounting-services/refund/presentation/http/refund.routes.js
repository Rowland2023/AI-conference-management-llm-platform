import { Router } from "express";

export function createRefundRoutes(refundController) {
  if (typeof refundController?.createRefund !== "function") {
    throw new TypeError(
      "createRefundRoutes requires a controller with createRefund()"
    );
  }

  const router = Router();

  router.post("/", refundController.createRefund);

  return router;
}