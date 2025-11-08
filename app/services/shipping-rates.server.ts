import type { ShippingRuleDTO } from "../models/shipping-rule.server";

export interface CarrierRateItem {
  grams?: number | null;
  quantity?: number | null;
}

export interface CarrierRateAddress {
  country?: string | null;
  province?: string | null;
  province_code?: string | null;
  postal_code?: string | null;
  zip?: string | null;
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
  destinationPostalCodeNumber: number | null;
}

const gramsToKg = (grams: number) => grams / 1000;

const normalizePostalCode = (value?: string | null) => {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  return trimmed.replace(/\s+/g, "").toUpperCase();
};

const postalCodeToNumber = (value: string | null) => {
  if (!value) {
    return null;
  }

  if (!/^\d+$/.test(value)) {
    return null;
  }

  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
};

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

  const normalizedPostalCode =
    normalizePostalCode(destination.postal_code) ??
    normalizePostalCode(destination.zip) ??
    null;

  return {
    subtotal,
    weightKg: gramsToKg(totalWeightGrams),
    currency: payload.rate.currency ?? "USD",
    destinationCountry: destination.country?.toUpperCase() ?? null,
    destinationProvince:
      destination.province_code?.toUpperCase() ??
      destination.province?.toUpperCase() ??
      null,
    destinationPostalCode: normalizedPostalCode,
    destinationPostalCodeNumber: postalCodeToNumber(normalizedPostalCode),
  };
};

const matchesRule = (
  rule: ShippingRuleDTO,
  context: EvaluationContext,
  evaluationTime: Date,
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

  if (rule.validFrom && evaluationTime < rule.validFrom) {
    return false;
  }

  if (rule.validUntil && evaluationTime > rule.validUntil) {
    return false;
  }

  if (
    (rule.destinationPostalCodeStart && !rule.destinationPostalCodeEnd) ||
    (!rule.destinationPostalCodeStart && rule.destinationPostalCodeEnd)
  ) {
    return false;
  }

  if (rule.destinationPostalCodeStart && rule.destinationPostalCodeEnd) {
    const rangeStart = postalCodeToNumber(rule.destinationPostalCodeStart);
    const rangeEnd = postalCodeToNumber(rule.destinationPostalCodeEnd);

    if (
      rangeStart === null ||
      rangeEnd === null ||
      context.destinationPostalCodeNumber === null
    ) {
      return false;
    }

    if (
      context.destinationPostalCodeNumber < rangeStart ||
      context.destinationPostalCodeNumber > rangeEnd
    ) {
      return false;
    }
  } else if (rule.destinationPostalCode) {
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
  const evaluationTime = new Date();

  const matchingRules = rules.filter((rule) =>
    matchesRule(rule, context, evaluationTime),
  );

  const nonCombinableRule = matchingRules.find((rule) => !rule.combinable);
  const applicableRules = nonCombinableRule
    ? [nonCombinableRule]
    : matchingRules;

  return applicableRules.map((rule) => ({
    service_name: rule.rateName,
    service_code: rule.carrierServiceCode ?? `custom-${rule.id}`,
    total_price: rule.rateAmountCents.toString(),
    currency: context.currency,
    phone_required: false,
  }));
};
