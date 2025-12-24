import crypto from "node:crypto";

import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";

import { listShippingRules } from "../models/shipping-rule.server";
import {
  calculateCarrierRates,
  type CarrierRatePayload,
} from "../services/shipping-rates.server";

const SHOP_HEADER = "x-shopify-shop-domain";
const HMAC_HEADER = "x-shopify-hmac-sha256";

const unauthorizedResponse = () =>
  new Response("No autorizado", { status: 401 });

export const loader = async (_args: LoaderFunctionArgs) => {
  return new Response(null, { status: 405 });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  if (request.method !== "POST") {
    return new Response(null, { status: 405 });
  }

  const shopDomain =
    request.headers.get(SHOP_HEADER)?.toLowerCase() ??
    request.headers.get(SHOP_HEADER.toUpperCase())?.toLowerCase();
  const hmac =
    request.headers.get(HMAC_HEADER) ??
    request.headers.get(HMAC_HEADER.toUpperCase());

  if (!shopDomain || !hmac || !process.env.SHOPIFY_API_SECRET) {
    return unauthorizedResponse();
  }

  const rawBody = await request.text();

  const generatedHmac = crypto
    .createHmac("sha256", process.env.SHOPIFY_API_SECRET)
    .update(rawBody, "utf8")
    .digest("base64");

  const providedHmacBuffer = Buffer.from(hmac, "utf8");
  const generatedHmacBuffer = Buffer.from(generatedHmac, "utf8");

  if (
    providedHmacBuffer.length !== generatedHmacBuffer.length ||
    !crypto.timingSafeEqual(providedHmacBuffer, generatedHmacBuffer)
  ) {
    return unauthorizedResponse();
  }

  let payload: CarrierRatePayload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new Response("JSON no válido", { status: 400 });
  }

  try {
    const rules = await listShippingRules(shopDomain);

    // Debug logging
    console.error("[CARRIER-DEBUG] Carrier Service Request:", JSON.stringify({
      payload
    }, null, 2));

    const rates = calculateCarrierRates(payload, rules);



    console.error("[CARRIER-DEBUG] Calculated Rates:", JSON.stringify({
      count: rates.length,
      rates: rates.map(r => ({ code: r.service_code, price: r.total_price }))
    }, null, 2));

    return Response.json({ rates });
  } catch (error) {
    console.error("Error generando tarifas personalizadas", error);
    return new Response("Error interno", { status: 500 });
  }
};
