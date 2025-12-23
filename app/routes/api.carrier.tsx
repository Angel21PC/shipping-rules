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
    console.log("Carrier Service Request:", {
      shopDomain,
      payload_subtotal: payload.rate?.subtotal_price,
      payload_currency: payload.rate?.currency,
      subtotal_number: Number(payload.rate?.subtotal_price),
      items_count: payload.rate?.items?.length
    });

    const rates = calculateCarrierRates(payload, rules);

    // TEMPORARY DEBUG: Add a rate showing the subtotal
    rates.push({
      service_name: `DEBUG: Subtotal ${payload.rate?.subtotal_price} ${payload.rate?.currency}`,
      service_code: "debug-rate",
      total_price: "0",
      currency: payload.rate?.currency ?? "EUR",
      phone_required: false
    });

    console.log("Calculated Rates:", {
      count: rates.length,
      rates: rates.map(r => ({ code: r.service_code, price: r.total_price }))
    });

    return Response.json({ rates });
  } catch (error) {
    console.error("Error generando tarifas personalizadas", error);
    return new Response("Error interno", { status: 500 });
  }
};
