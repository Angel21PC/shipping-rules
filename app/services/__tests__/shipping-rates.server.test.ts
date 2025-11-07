import { describe, expect, it } from "vitest";

import { calculateCarrierRates } from "../shipping-rates.server";
import type { ShippingRuleDTO } from "../../models/shipping-rule.server";
import type { CarrierRatePayload } from "../shipping-rates.server";

const baseRule: ShippingRuleDTO = {
  id: 1,
  shopDomain: "test-shop.myshopify.com",
  title: "Envio estándar",
  rateName: "Envío estándar",
  rateAmountCents: 500,
  minSubtotal: null,
  maxSubtotal: null,
  minWeight: null,
  maxWeight: null,
  destinationCountry: null,
  destinationProvince: null,
  destinationPostalCode: null,
  destinationPostalCodeStart: null,
  destinationPostalCodeEnd: null,
  carrierServiceCode: null,
  enabled: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const buildPayload = (
  overrides: Partial<CarrierRatePayload["rate"]> = {},
): CarrierRatePayload => {
  const { destination, ...rest } = overrides;
  const baseDestination = {
    country: "ES",
    province: "B",
    postal_code: "08012",
  };

  return {
    rate: {
      currency: "EUR",
      subtotal_price: "50.00",
      total_weight: 1500,
      destination: {
        ...baseDestination,
        ...(destination ?? {}),
      },
      items: [],
      ...rest,
    },
  };
};

describe("calculateCarrierRates", () => {
  it("devuelve la tarifa cuando se cumplen todas las condiciones", () => {
    const rules: ShippingRuleDTO[] = [
      {
        ...baseRule,
        minSubtotal: 10,
        maxSubtotal: 200,
        minWeight: 1,
        maxWeight: 5,
        destinationCountry: "ES",
      },
    ];

    const rates = calculateCarrierRates(buildPayload({}), rules);

    expect(rates).toHaveLength(1);
    expect(rates[0]).toMatchObject({
      service_name: "Envío estándar",
      total_price: "500",
      currency: "EUR",
    });
  });

  it("filtra reglas que no cumplen el peso mínimo", () => {
    const rules: ShippingRuleDTO[] = [
      {
        ...baseRule,
        minWeight: 2, // kg
        maxWeight: null,
      },
    ];

    const payload = buildPayload({ total_weight: 1500 }); // 1.5 kg
    const rates = calculateCarrierRates(payload, rules);

    expect(rates).toHaveLength(0);
  });

  it("acepta prefijos de código postal", () => {
    const rules: ShippingRuleDTO[] = [
      {
        ...baseRule,
        destinationPostalCode: "080",
      },
    ];

    const payload = buildPayload({ destination: { postal_code: "08025" } });
    const rates = calculateCarrierRates(payload, rules);

    expect(rates).toHaveLength(1);
  });

  it("filtra por un rango de códigos postales", () => {
    const rules: ShippingRuleDTO[] = [
      {
        ...baseRule,
        destinationPostalCodeStart: "28000",
        destinationPostalCodeEnd: "28999",
      },
    ];

    const payload = buildPayload({ destination: { postal_code: "28350" } });
    const rates = calculateCarrierRates(payload, rules);

    expect(rates).toHaveLength(1);
  });

  it("permite un único código postal cuando desde y hasta son iguales", () => {
    const rules: ShippingRuleDTO[] = [
      {
        ...baseRule,
        destinationPostalCodeStart: "08012",
        destinationPostalCodeEnd: "08012",
      },
    ];

    const payload = buildPayload({ destination: { postal_code: "08012" } });
    const rates = calculateCarrierRates(payload, rules);

    expect(rates).toHaveLength(1);
  });

  it("descarta reglas cuando el código postal cae fuera del rango", () => {
    const rules: ShippingRuleDTO[] = [
      {
        ...baseRule,
        destinationPostalCodeStart: "28000",
        destinationPostalCodeEnd: "28999",
      },
    ];

    const payload = buildPayload({ destination: { postal_code: "29500" } });
    const rates = calculateCarrierRates(payload, rules);

    expect(rates).toHaveLength(0);
  });

  it("normaliza el código postal y usa zip como alias", () => {
    const rules: ShippingRuleDTO[] = [
      {
        ...baseRule,
        destinationPostalCode: "03001",
      },
    ];

    const payload = buildPayload({
      destination: { postal_code: undefined, zip: " 03 001 " },
    });
    const rates = calculateCarrierRates(payload, rules);

    expect(rates).toHaveLength(1);
  });

  it("descarta reglas desactivadas", () => {
    const rules: ShippingRuleDTO[] = [
      {
        ...baseRule,
        enabled: false,
      },
    ];

    const rates = calculateCarrierRates(buildPayload({}), rules);

    expect(rates).toHaveLength(0);
  });
});
