import type { ShippingRule } from "@prisma/client";
import { Prisma } from "@prisma/client";

import prisma from "../db.server";

export type ShippingRuleInput = {
  title: string;
  minSubtotal?: number | null;
  maxSubtotal?: number | null;
  minWeight?: number | null;
  maxWeight?: number | null;
  destinationCountry?: string | null;
  destinationProvince?: string | null;
  destinationPostalCode?: string | null;
  destinationPostalCodeStart?: string | null;
  destinationPostalCodeEnd?: string | null;
  combinable?: boolean;
  validFrom?: Date | string | null;
  validUntil?: Date | string | null;
  rateName: string;
  rateAmountCents: number;
  carrierServiceCode?: string | null;
  enabled?: boolean;
};

const decimalOrNull = (value?: number | null) => {
  if (value === null || value === undefined) {
    return null;
  }

  return new Prisma.Decimal(value);
};

export const serializeShippingRule = (rule: ShippingRule) => ({
  ...rule,
  minSubtotal: rule.minSubtotal?.toNumber() ?? null,
  maxSubtotal: rule.maxSubtotal?.toNumber() ?? null,
  minWeight: rule.minWeight?.toNumber() ?? null,
  maxWeight: rule.maxWeight?.toNumber() ?? null,
});

export type ShippingRuleDTO = ReturnType<typeof serializeShippingRule>;

export async function listShippingRules(shopDomain: string) {
  const rules = await prisma.shippingRule.findMany({
    where: { shopDomain },
    orderBy: { createdAt: "asc" },
  });

  return rules.map(serializeShippingRule);
}

export async function getShippingRule(id: number, shopDomain: string) {
  const rule = await prisma.shippingRule.findFirst({
    where: { id, shopDomain },
  });

  return rule ? serializeShippingRule(rule) : null;
}

export async function createShippingRule(
  shopDomain: string,
  input: ShippingRuleInput,
) {
  const rule = await prisma.shippingRule.create({
    data: {
      shopDomain,
      title: input.title,
      minSubtotal: decimalOrNull(input.minSubtotal ?? null),
      maxSubtotal: decimalOrNull(input.maxSubtotal ?? null),
      minWeight: decimalOrNull(input.minWeight ?? null),
      maxWeight: decimalOrNull(input.maxWeight ?? null),
      destinationCountry: input.destinationCountry ?? null,
      destinationProvince: input.destinationProvince ?? null,
      destinationPostalCode: input.destinationPostalCode ?? null,
      destinationPostalCodeStart: input.destinationPostalCodeStart ?? null,
      destinationPostalCodeEnd: input.destinationPostalCodeEnd ?? null,
      validFrom: input.validFrom ?? null,
      validUntil: input.validUntil ?? null,
      rateName: input.rateName,
      rateAmountCents: input.rateAmountCents,
      carrierServiceCode: input.carrierServiceCode ?? null,
      combinable: input.combinable ?? false,
      enabled: input.enabled ?? true,
    },
  });

  return serializeShippingRule(rule);
}

export async function updateShippingRule(
  id: number,
  shopDomain: string,
  input: ShippingRuleInput,
) {
  const existing = await prisma.shippingRule.findFirst({
    where: { id, shopDomain },
  });

  if (!existing) {
    return null;
  }

  const rule = await prisma.shippingRule.update({
    where: { id },
    data: {
      shopDomain,
      title: input.title,
      minSubtotal: decimalOrNull(input.minSubtotal ?? null),
      maxSubtotal: decimalOrNull(input.maxSubtotal ?? null),
      minWeight: decimalOrNull(input.minWeight ?? null),
      maxWeight: decimalOrNull(input.maxWeight ?? null),
      destinationCountry: input.destinationCountry ?? null,
      destinationProvince: input.destinationProvince ?? null,
      destinationPostalCode: input.destinationPostalCode ?? null,
      destinationPostalCodeStart: input.destinationPostalCodeStart ?? null,
      destinationPostalCodeEnd: input.destinationPostalCodeEnd ?? null,
      validFrom: input.validFrom ?? null,
      validUntil: input.validUntil ?? null,
      rateName: input.rateName,
      rateAmountCents: input.rateAmountCents,
      carrierServiceCode: input.carrierServiceCode ?? null,
      combinable: input.combinable ?? false,
      enabled: input.enabled ?? true,
    },
  });

  return serializeShippingRule(rule);
}

export async function deleteShippingRule(id: number, shopDomain: string) {
  const deleted = await prisma.shippingRule.deleteMany({
    where: { id, shopDomain },
  });

  return deleted.count > 0;
}

const toIdArray = (ids: number[]) => ids.filter((id) => Number.isInteger(id));

export async function bulkSetRuleEnabled(
  ids: number[],
  shopDomain: string,
  enabled: boolean,
) {
  const validIds = toIdArray(ids);
  if (!validIds.length) {
    return 0;
  }

  const result = await prisma.shippingRule.updateMany({
    where: { id: { in: validIds }, shopDomain },
    data: { enabled },
  });

  return result.count;
}

export async function bulkSetRuleCombinable(
  ids: number[],
  shopDomain: string,
  combinable: boolean,
) {
  const validIds = toIdArray(ids);
  if (!validIds.length) {
    return 0;
  }

  const result = await prisma.shippingRule.updateMany({
    where: { id: { in: validIds }, shopDomain },
    data: { combinable },
  });

  return result.count;
}

export async function bulkDeleteRules(ids: number[], shopDomain: string) {
  const validIds = toIdArray(ids);
  if (!validIds.length) {
    return 0;
  }

  const result = await prisma.shippingRule.deleteMany({
    where: { id: { in: validIds }, shopDomain },
  });

  return result.count;
}
