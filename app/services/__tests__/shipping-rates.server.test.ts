import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

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
  combinable: false,
  validFrom: null,
  validUntil: null,
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

  it("aplica reglas dentro del rango de fechas", () => {
    const rules: ShippingRuleDTO[] = [
      {
        ...baseRule,
        validFrom: new Date("2025-01-01T00:00:00Z"),
        validUntil: new Date("2025-01-31T23:59:59Z"),
      },
    ];

    const rates = calculateCarrierRates(buildPayload({}), rules);

    expect(rates).toHaveLength(1);
  });

  it("descarta reglas que aún no han comenzado", () => {
    const rules: ShippingRuleDTO[] = [
      {
        ...baseRule,
        validFrom: new Date("2025-02-01T00:00:00Z"),
      },
    ];

    const rates = calculateCarrierRates(buildPayload({}), rules);

    expect(rates).toHaveLength(0);
  });

  it("descarta reglas caducadas", () => {
    const rules: ShippingRuleDTO[] = [
      {
        ...baseRule,
        validUntil: new Date("2024-12-31T23:59:59Z"),
      },
    ];

    const rates = calculateCarrierRates(buildPayload({}), rules);

    expect(rates).toHaveLength(0);
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

  it("devuelve múltiples reglas cuando todas son combinables", () => {
    const rules: ShippingRuleDTO[] = [
      {
        ...baseRule,
        id: 1,
        title: "Combinable 1",
        rateName: "C1",
        combinable: true,
      },
      {
        ...baseRule,
        id: 2,
        title: "Combinable 2",
        rateName: "C2",
        combinable: true,
      },
    ];

    const rates = calculateCarrierRates(buildPayload({}), rules);

    expect(rates).toHaveLength(2);
    expect(rates.map((rate) => rate.service_name)).toEqual(["C1", "C2"]);
  });

  it("prioriza la primera regla no combinable", () => {
    const rules: ShippingRuleDTO[] = [
      {
        ...baseRule,
        id: 1,
        title: "Exclusiva",
        rateName: "Exclusiva",
        combinable: false,
      },
      {
        ...baseRule,
        id: 2,
        title: "Combinable",
        rateName: "Combinable",
        combinable: true,
      },
    ];

    const rates = calculateCarrierRates(buildPayload({}), rules);

    expect(rates).toHaveLength(1);
    expect(rates[0].service_name).toBe("Exclusiva");
  });
});
const FIXED_NOW = new Date("2025-01-15T00:00:00Z");

beforeAll(() => {
  vi.useFakeTimers();
  vi.setSystemTime(FIXED_NOW);
});

afterAll(() => {
  vi.useRealTimers();
});
