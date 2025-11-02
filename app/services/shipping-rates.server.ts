import type { ShippingRuleDTO } from "../models/shipping-rule.server";

export interface CarrierRateItem {
  grams?: number | null;
  quantity?: number | null;
}

export interface CarrierRateAddress {
  country?: string | null;
  province?: string | null;
  postal_code?: string | null;
}

export interface CarrierRatePayload {
  rate: {
    destination?: CarrierRateAddress | null;
    shipping_address?: CarrierRateAddress | null;
    items?: CarrierRateItem[];
    currency?: string;
    subtotal_price?: string;
    total_weight?: number | null;
  };
}

export interface CarrierRate {
  service_name: string;
  service_code: string;
  total_price: string;
  currency: string;
  phone_required: boolean;
}

interface EvaluationContext {
  subtotal: number;
  weightKg: number;
  currency: string;
  destinationCountry: string | null;
  destinationProvince: string | null;
  destinationPostalCode: string | null;
}

const gramsToKg = (grams: number) => grams / 1000;

export const buildEvaluationContext = (
  payload: CarrierRatePayload,
): EvaluationContext => {
  const destination =
    payload.rate.destination ?? payload.rate.shipping_address ?? {};

  const subtotal = payload.rate.subtotal_price
    ? Number(payload.rate.subtotal_price)
    : 0;

  const hasValidTotalWeight =
    typeof payload.rate.total_weight === "number" &&
    !Number.isNaN(payload.rate.total_weight);

  const totalWeightGrams = hasValidTotalWeight
    ? payload.rate.total_weight!
    : (payload.rate.items ?? []).reduce((total, item) => {
        const itemGrams = item.grams ?? 0;
        const quantity = item.quantity ?? 1;
        if (Number.isNaN(itemGrams) || Number.isNaN(quantity)) {
          return total;
        }
        return total + itemGrams * quantity;
      }, 0);

  return {
    subtotal,
    weightKg: gramsToKg(totalWeightGrams),
    currency: payload.rate.currency ?? "USD",
    destinationCountry: destination.country?.toUpperCase() ?? null,
    destinationProvince: destination.province?.toUpperCase() ?? null,
    destinationPostalCode: destination.postal_code?.toUpperCase() ?? null,
  };
};

const matchesRule = (
  rule: ShippingRuleDTO,
  context: EvaluationContext,
): boolean => {
  if (!rule.enabled) {
    return false;
  }

  if (rule.minSubtotal !== null && context.subtotal < rule.minSubtotal) {
    return false;
  }

  if (rule.maxSubtotal !== null && context.subtotal > rule.maxSubtotal) {
    return false;
  }

  if (rule.minWeight !== null && context.weightKg < rule.minWeight) {
    return false;
  }

  if (rule.maxWeight !== null && context.weightKg > rule.maxWeight) {
    return false;
  }

  if (
    rule.destinationCountry &&
    rule.destinationCountry !== context.destinationCountry
  ) {
    return false;
  }

  if (
    rule.destinationProvince &&
    rule.destinationProvince !== context.destinationProvince
  ) {
    return false;
  }

  if (rule.destinationPostalCode) {
    if (!context.destinationPostalCode) {
      return false;
    }

    if (!context.destinationPostalCode.startsWith(rule.destinationPostalCode)) {
      return false;
    }
  }

  return true;
};

export const calculateCarrierRates = (
  payload: CarrierRatePayload,
  rules: ShippingRuleDTO[],
): CarrierRate[] => {
  const context = buildEvaluationContext(payload);

  return rules
    .filter((rule) => matchesRule(rule, context))
    .map((rule) => ({
      service_name: rule.rateName,
      service_code: rule.carrierServiceCode ?? `custom-${rule.id}`,
      total_price: rule.rateAmountCents.toString(),
      currency: context.currency,
      phone_required: false,
    }));
};
