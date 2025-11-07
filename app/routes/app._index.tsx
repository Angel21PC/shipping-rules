import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import {
  Form,
  redirect,
  useActionData,
  useFetcher,
  useLoaderData,
  useNavigation,
} from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import {
  Page,
  Layout,
  Card,
  Button,
  BlockStack,
  Text,
  Badge,
  InlineStack,
  Modal,
  FormLayout,
  TextField,
  Checkbox,
  Banner,
  EmptyState,
  Select,
  Tabs,
} from "@shopify/polaris";
import "@shopify/polaris/build/esm/styles.css";

import { authenticate } from "../shopify.server";
import {
  createShippingRule,
  deleteShippingRule,
  getShippingRule,
  listShippingRules,
  updateShippingRule,
  type ShippingRuleDTO,
} from "../models/shipping-rule.server";
import { ensureCarrierService } from "../services/carrier-service.server";

type LoaderData = {
  rules: ShippingRuleDTO[];
};

type ActionData = {
  errors?: Record<string, string>;
  formError?: string;
};

type RuleFormValues = {
  title: string;
  rateName: string;
  rateAmount: string;
  minSubtotal: string;
  maxSubtotal: string;
  minWeight: string;
  maxWeight: string;
  destinationCountry: string;
  destinationProvince: string;
  destinationPostalCodeStart: string;
  destinationPostalCodeEnd: string;
  carrierServiceCode: string;
  enabled: boolean;
};

type RuleFormTextFieldKey = Exclude<keyof RuleFormValues, "enabled">;

const COUNTRY_CODES = [
  "AF",
  "AX",
  "AL",
  "DZ",
  "AS",
  "AD",
  "AO",
  "AI",
  "AQ",
  "AG",
  "AR",
  "AM",
  "AW",
  "AU",
  "AT",
  "AZ",
  "BS",
  "BH",
  "BD",
  "BB",
  "BY",
  "BE",
  "BZ",
  "BJ",
  "BM",
  "BT",
  "BO",
  "BQ",
  "BA",
  "BW",
  "BV",
  "BR",
  "IO",
  "BN",
  "BG",
  "BF",
  "BI",
  "CV",
  "KH",
  "CM",
  "CA",
  "KY",
  "CF",
  "TD",
  "CL",
  "CN",
  "CX",
  "CC",
  "CO",
  "KM",
  "CG",
  "CD",
  "CK",
  "CR",
  "CI",
  "HR",
  "CU",
  "CW",
  "CY",
  "CZ",
  "DK",
  "DJ",
  "DM",
  "DO",
  "EC",
  "EG",
  "SV",
  "GQ",
  "ER",
  "EE",
  "SZ",
  "ET",
  "FK",
  "FO",
  "FJ",
  "FI",
  "FR",
  "GF",
  "PF",
  "TF",
  "GA",
  "GM",
  "GE",
  "DE",
  "GH",
  "GI",
  "GR",
  "GL",
  "GD",
  "GP",
  "GU",
  "GT",
  "GG",
  "GN",
  "GW",
  "GY",
  "HT",
  "HM",
  "VA",
  "HN",
  "HK",
  "HU",
  "IS",
  "IN",
  "ID",
  "IR",
  "IQ",
  "IE",
  "IM",
  "IL",
  "IT",
  "JM",
  "JP",
  "JE",
  "JO",
  "KZ",
  "KE",
  "KI",
  "KP",
  "KR",
  "KW",
  "KG",
  "LA",
  "LV",
  "LB",
  "LS",
  "LR",
  "LY",
  "LI",
  "LT",
  "LU",
  "MO",
  "MG",
  "MW",
  "MY",
  "MV",
  "ML",
  "MT",
  "MH",
  "MQ",
  "MR",
  "MU",
  "YT",
  "MX",
  "FM",
  "MD",
  "MC",
  "MN",
  "ME",
  "MS",
  "MA",
  "MZ",
  "MM",
  "NA",
  "NR",
  "NP",
  "NL",
  "NC",
  "NZ",
  "NI",
  "NE",
  "NG",
  "NU",
  "NF",
  "MK",
  "MP",
  "NO",
  "OM",
  "PK",
  "PW",
  "PS",
  "PA",
  "PG",
  "PY",
  "PE",
  "PH",
  "PN",
  "PL",
  "PT",
  "PR",
  "QA",
  "RE",
  "RO",
  "RU",
  "RW",
  "BL",
  "SH",
  "KN",
  "LC",
  "MF",
  "PM",
  "VC",
  "WS",
  "SM",
  "ST",
  "SA",
  "SN",
  "RS",
  "SC",
  "SL",
  "SG",
  "SX",
  "SK",
  "SI",
  "SB",
  "SO",
  "ZA",
  "GS",
  "SS",
  "ES",
  "LK",
  "SD",
  "SR",
  "SJ",
  "SE",
  "CH",
  "SY",
  "TW",
  "TJ",
  "TZ",
  "TH",
  "TL",
  "TG",
  "TK",
  "TO",
  "TT",
  "TN",
  "TR",
  "TM",
  "TC",
  "TV",
  "UG",
  "UA",
  "AE",
  "GB",
  "US",
  "UM",
  "UY",
  "UZ",
  "VU",
  "VE",
  "VN",
  "VG",
  "VI",
  "WF",
  "EH",
  "YE",
  "ZM",
  "ZW",
];

const buildCountryOptions = () => {
  let displayNames: Intl.DisplayNames | undefined;
  if (typeof Intl.DisplayNames === "function") {
    try {
      displayNames = new Intl.DisplayNames(["es"], { type: "region" });
    } catch {
      displayNames = undefined;
    }
  }

  return COUNTRY_CODES.map((code) => ({
    value: code,
    label: displayNames?.of(code) ?? code,
  })).sort((a, b) => a.label.localeCompare(b.label, "es"));
};

const getFormValuesFromRule = (
  rule: ShippingRuleDTO | null,
): RuleFormValues => ({
  title: rule?.title ?? "",
  rateName: rule?.rateName ?? "",
  rateAmount: rule
    ? (rule.rateAmountCents / 100).toFixed(2)
    : "",
  minSubtotal:
    rule?.minSubtotal !== null && rule?.minSubtotal !== undefined
      ? rule.minSubtotal.toString()
      : "",
  maxSubtotal:
    rule?.maxSubtotal !== null && rule?.maxSubtotal !== undefined
      ? rule.maxSubtotal.toString()
      : "",
  minWeight:
    rule?.minWeight !== null && rule?.minWeight !== undefined
      ? rule.minWeight.toString()
      : "",
  maxWeight:
    rule?.maxWeight !== null && rule?.maxWeight !== undefined
      ? rule.maxWeight.toString()
      : "",
  destinationCountry: rule?.destinationCountry ?? "",
  destinationProvince: rule?.destinationProvince ?? "",
  destinationPostalCodeStart: rule?.destinationPostalCodeStart ?? "",
  destinationPostalCodeEnd: rule?.destinationPostalCodeEnd ?? "",
  carrierServiceCode: rule?.carrierServiceCode ?? "",
  enabled: rule ? rule.enabled : true,
});

const parseDecimalField = (
  value: FormDataEntryValue | null,
  fieldName: string,
  errors: Record<string, string>,
) => {
  if (value === null) {
    return null;
  }

  const raw = value.toString().trim();

  if (!raw) {
    return null;
  }

  const normalized = raw.replace(",", ".");
  const parsed = Number(normalized);

  if (Number.isNaN(parsed)) {
    errors[fieldName] = "Introduce un número válido";
    return null;
  }

  return parsed;
};

const parseRateAmount = (
  value: FormDataEntryValue | null,
  errors: Record<string, string>,
) => {
  if (typeof value !== "string" || !value.trim()) {
    errors.rateAmount = "Introduce un importe";
    return null;
  }

  const normalized = value.trim().replace(",", ".");
  const parsed = Number(normalized);

  if (Number.isNaN(parsed) || parsed < 0) {
    errors.rateAmount = "Introduce un importe válido";
    return null;
  }

  return Math.round(parsed * 100);
};

const sanitizeString = (value: FormDataEntryValue | null) => {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();

  return trimmed ? trimmed : null;
};

const normalizePostalInput = (value: FormDataEntryValue | null) => {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  return trimmed.replace(/\s+/g, "").toUpperCase();
};

const parsePostalCodeRange = (
  formData: FormData,
  errors: Record<string, string>,
) => {
  const startValue = normalizePostalInput(
    formData.get("destinationPostalCodeStart"),
  );
  const endValue = normalizePostalInput(
    formData.get("destinationPostalCodeEnd"),
  );

  if (startValue === null && endValue === null) {
    return { start: null, end: null };
  }

  if (startValue === null || endValue === null) {
    const message = "Completa ambos campos para definir un rango";
    errors.destinationPostalCodeStart = message;
    errors.destinationPostalCodeEnd = message;
    return { start: null, end: null };
  }

  if (!/^\d+$/.test(startValue)) {
    errors.destinationPostalCodeStart =
      "Introduce solo números en el código postal";
  }

  if (!/^\d+$/.test(endValue)) {
    errors.destinationPostalCodeEnd =
      "Introduce solo números en el código postal";
  }

  if (errors.destinationPostalCodeStart || errors.destinationPostalCodeEnd) {
    return { start: null, end: null };
  }

  const startNumber = Number(startValue);
  const endNumber = Number(endValue);

  if (Number.isNaN(startNumber)) {
    errors.destinationPostalCodeStart = "Introduce un código válido";
  }

  if (Number.isNaN(endNumber)) {
    errors.destinationPostalCodeEnd = "Introduce un código válido";
  }

  if (errors.destinationPostalCodeStart || errors.destinationPostalCodeEnd) {
    return { start: null, end: null };
  }

  if (startNumber > endNumber) {
    const message =
      "El código postal 'desde' debe ser menor o igual que 'hasta'";
    errors.destinationPostalCodeStart = message;
    errors.destinationPostalCodeEnd = message;
    return { start: null, end: null };
  }

  return { start: startValue, end: endValue };
};

const buildRuleInput = (formData: FormData) => {
  const errors: Record<string, string> = {};

  const title = sanitizeString(formData.get("title"));
  if (!title) {
    errors.title = "Introduce un nombre para la regla";
  }

  const rateName = sanitizeString(formData.get("rateName"));
  if (!rateName) {
    errors.rateName = "Introduce el nombre de la tarifa que verá el cliente";
  }

  const rateAmountCents = parseRateAmount(formData.get("rateAmount"), errors);

  const minSubtotal = parseDecimalField(
    formData.get("minSubtotal"),
    "minSubtotal",
    errors,
  );
  const maxSubtotal = parseDecimalField(
    formData.get("maxSubtotal"),
    "maxSubtotal",
    errors,
  );
  const minWeight = parseDecimalField(
    formData.get("minWeight"),
    "minWeight",
    errors,
  );
  const maxWeight = parseDecimalField(
    formData.get("maxWeight"),
    "maxWeight",
    errors,
  );

  if (
    minSubtotal !== null &&
    maxSubtotal !== null &&
    minSubtotal > maxSubtotal
  ) {
    errors.maxSubtotal =
      "El subtotal máximo debe ser mayor o igual que el mínimo";
  }

  if (minWeight !== null && maxWeight !== null && minWeight > maxWeight) {
    errors.maxWeight = "El peso máximo debe ser mayor o igual que el mínimo";
  }

  const destinationCountry = sanitizeString(
    formData.get("destinationCountry"),
  )?.toUpperCase() ?? null;
  const destinationProvince = sanitizeString(
    formData.get("destinationProvince"),
  )?.toUpperCase() ?? null;
  const { start: destinationPostalCodeStart, end: destinationPostalCodeEnd } =
    parsePostalCodeRange(formData, errors);

  const carrierServiceCode =
    sanitizeString(formData.get("carrierServiceCode")) ?? null;

  const enabled = formData.get("enabled") === "on";

  return {
    data:
      !Object.keys(errors).length && rateAmountCents !== null && title && rateName
        ? {
            title,
            rateName,
            rateAmountCents,
            minSubtotal,
            maxSubtotal,
            minWeight,
            maxWeight,
            destinationCountry,
            destinationProvince,
            destinationPostalCode: null,
            destinationPostalCodeStart,
            destinationPostalCodeEnd,
            carrierServiceCode,
            enabled,
          }
        : null,
    errors,
  };
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  try {
    await ensureCarrierService(session);
  } catch (error) {
    console.error("No se pudo sincronizar el Carrier Service", error);
  }
  const shopDomain = session.shop.toLowerCase();
  const rules = await listShippingRules(shopDomain);

  const data: LoaderData = { rules };
  return data;
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shopDomain = session.shop.toLowerCase();

  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "create" || intent === "update") {
    const { data, errors } = buildRuleInput(formData);

    if (!data) {
      const payload: ActionData = { errors };
      return Response.json(payload, { status: 400 });
    }

    if (intent === "create") {
      await createShippingRule(shopDomain, data);
    } else {
      const id = Number(formData.get("id"));
      if (!Number.isInteger(id)) {
        const payload: ActionData = {
          formError: "Identificador de regla no válido",
        };
        return Response.json(payload, { status: 400 });
      }

      const updated = await updateShippingRule(id, shopDomain, data);
      if (!updated) {
        const payload: ActionData = {
          formError: "No se ha encontrado la regla a actualizar",
        };
        return Response.json(payload, { status: 404 });
      }
    }

    return redirect(request.url);
  }

  if (intent === "delete") {
    const id = Number(formData.get("id"));
    if (!Number.isInteger(id)) {
      const payload: ActionData = {
        formError: "Identificador de regla no válido",
      };
      return Response.json(payload, { status: 400 });
    }

    const deleted = await deleteShippingRule(id, shopDomain);
    if (!deleted) {
      const payload: ActionData = {
        formError: "No se ha encontrado la regla a eliminar",
      };
      return Response.json(payload, { status: 404 });
    }

    return redirect(request.url);
  }

  if (intent === "toggle") {
    const id = Number(formData.get("id"));
    const enabled = formData.get("enabled") === "true";

    if (!Number.isInteger(id)) {
      const payload: ActionData = {
        formError: "Identificador de regla no válido",
      };
      return Response.json(payload, { status: 400 });
    }

    const rule = await getShippingRule(id, shopDomain);
    if (!rule) {
      const payload: ActionData = { formError: "No se ha encontrado la regla" };
      return Response.json(payload, { status: 404 });
    }

    await updateShippingRule(id, shopDomain, {
      title: rule.title,
      rateName: rule.rateName,
      rateAmountCents: rule.rateAmountCents,
      minSubtotal: rule.minSubtotal,
      maxSubtotal: rule.maxSubtotal,
      minWeight: rule.minWeight,
      maxWeight: rule.maxWeight,
      destinationCountry: rule.destinationCountry,
      destinationProvince: rule.destinationProvince,
      destinationPostalCode: rule.destinationPostalCode,
      destinationPostalCodeStart: rule.destinationPostalCodeStart,
      destinationPostalCodeEnd: rule.destinationPostalCodeEnd,
      carrierServiceCode: rule.carrierServiceCode,
      enabled,
    });

    return redirect(request.url);
  }

  const payload: ActionData = { formError: "Acción no soportada" };
  return Response.json(payload, { status: 400 });
};

const formatAmount = (cents: number) =>
  (cents / 100).toLocaleString("es-ES", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const formatPostalRestriction = (rule: ShippingRuleDTO) => {
  if (rule.destinationPostalCodeStart && rule.destinationPostalCodeEnd) {
    if (rule.destinationPostalCodeStart === rule.destinationPostalCodeEnd) {
      return `CP: ${rule.destinationPostalCodeStart}`;
    }

    return `CP: ${rule.destinationPostalCodeStart} - ${rule.destinationPostalCodeEnd}`;
  }

  if (rule.destinationPostalCode) {
    return `CP (prefijo): ${rule.destinationPostalCode}`;
  }

  return null;
};

export default function ShippingRulesPage() {
  const { rules } = useLoaderData<typeof loader>();
  const actionData = useActionData<ActionData>();
  const navigation = useNavigation();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<ShippingRuleDTO | null>(null);
  const [formValues, setFormValues] = useState<RuleFormValues>(() =>
    getFormValuesFromRule(null),
  );
  const [selectedGroupIndex, setSelectedGroupIndex] = useState(0);
  const deleteFetcher = useFetcher<typeof action>();
  const toggleFetcher = useFetcher<typeof action>();
  const countryOptions = useMemo(
    () => [
      {
        label: "Selecciona un país",
        value: "",
      },
      ...buildCountryOptions(),
    ],
    [],
  );
  const countryLabelMap = useMemo(
    () => new Map(countryOptions.map(({ value, label }) => [value, label])),
    [countryOptions],
  );

  const handleTextFieldChange = useCallback(
    (field: RuleFormTextFieldKey) =>
      (value: string, _id: string) => {
        setFormValues((prev) => ({
          ...prev,
          [field]: value,
        }));
      },
    [],
  );

  const handleEnabledChange = useCallback(
    (newChecked: boolean, _id: string) => {
      setFormValues((prev) => ({
        ...prev,
        enabled: newChecked,
      }));
    },
    [],
  );

  const isSubmitting = navigation.state === "submitting";

  const handleOpenModal = (rule: ShippingRuleDTO | null) => {
    setEditingRule(rule);
    setFormValues(getFormValuesFromRule(rule));
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setEditingRule(null);
    setIsModalOpen(false);
    setFormValues(getFormValuesFromRule(null));
  };

  const hasErrors = Boolean(
    actionData?.formError || Object.keys(actionData?.errors ?? {}).length,
  );

  const legacyPostalPrefix =
    editingRule &&
    editingRule.destinationPostalCode &&
    !editingRule.destinationPostalCodeStart &&
    !editingRule.destinationPostalCodeEnd
      ? editingRule.destinationPostalCode
      : null;

  const postalRangeHelpText = legacyPostalPrefix
    ? `La regla usaba el prefijo ${legacyPostalPrefix}. Define ahora el rango (usa el mismo número en ambos campos para un único código).`
    : "Introduce el mismo número en ambos campos para un único código.";

  const groupedRules = useMemo(() => {
    const groups = new Map<
      string,
      { key: string; label: string; rules: ShippingRuleDTO[] }
    >();

    rules.forEach((rule) => {
      const code = rule.destinationCountry?.toUpperCase() ?? "";
      const key = code || "__none__";
      const label = code
        ? countryLabelMap.get(code) ?? code
        : "Sin país específico";

      if (!groups.has(key)) {
        groups.set(key, { key, label, rules: [] });
      }

      groups.get(key)!.rules.push(rule);
    });

    return Array.from(groups.values()).sort((a, b) =>
      a.label.localeCompare(b.label, "es"),
    );
  }, [rules, countryLabelMap]);

  useEffect(() => {
    setSelectedGroupIndex((current) => {
      if (!groupedRules.length) {
        return 0;
      }

      return current >= groupedRules.length ? groupedRules.length - 1 : current;
    });
  }, [groupedRules]);

  const tabs = useMemo(
    () =>
      groupedRules.map((group) => ({
        id: `country-${group.key}`,
        content: group.label,
        panelID: `country-panel-${group.key}`,
      })),
    [groupedRules],
  );

  const handleTabChange = useCallback((selectedIndex: number) => {
    setSelectedGroupIndex(selectedIndex);
  }, []);

  const selectedGroup = groupedRules[selectedGroupIndex] ?? null;

  const emptyStateMarkup = (
    <EmptyState
      heading="Crea tu primera regla de envío"
      action={{
        content: "Nueva regla",
        onAction: () => handleOpenModal(null),
      }}
      image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
    >
      <p>
        Personaliza los costes de envío para que se adapten a tu negocio.
      </p>
    </EmptyState>
  );

  const rulesMarkup = selectedGroup ? (
    <BlockStack gap="300">
      <Text as="h2" variant="headingMd">
        {selectedGroup.label}
      </Text>
      <BlockStack gap="400">
        {selectedGroup.rules.map((rule) => (
          <Card key={rule.id}>
            <BlockStack gap="400">
              <InlineStack align="space-between" blockAlign="center">
                <Text as="h3" variant="headingMd">
                  {rule.title}
                </Text>
                <Badge tone={rule.enabled ? "success" : "critical"}>
                  {rule.enabled ? "Activa" : "Inactiva"}
                </Badge>
              </InlineStack>
              <Text as="p">
                Tarifa mostrada: <strong>{rule.rateName}</strong> ·{" "}
                {formatAmount(rule.rateAmountCents)} (moneda tienda)
              </Text>
              <Text as="p">
                Condiciones:{" "}
                {[
                  rule.minSubtotal !== null || rule.maxSubtotal !== null
                    ? `Subtotal ${
                        rule.minSubtotal !== null
                          ? `≥ ${rule.minSubtotal.toLocaleString("es-ES", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}€`
                          : ""
                      }${
                        rule.minSubtotal !== null &&
                        rule.maxSubtotal !== null
                          ? " y "
                          : ""
                      }${
                        rule.maxSubtotal !== null
                          ? `≤ ${rule.maxSubtotal.toLocaleString("es-ES", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}€`
                          : ""
                      }`
                    : null,
                  rule.minWeight !== null || rule.maxWeight !== null
                    ? `Peso ${
                        rule.minWeight !== null
                          ? `≥ ${rule.minWeight} kg`
                          : ""
                      }${
                        rule.minWeight !== null &&
                        rule.maxWeight !== null
                          ? " y "
                          : ""
                      }${
                        rule.maxWeight !== null
                          ? `≤ ${rule.maxWeight} kg`
                          : ""
                      }`
                    : null,
                  rule.destinationCountry
                    ? `País: ${
                        countryLabelMap.get(
                          rule.destinationCountry.toUpperCase(),
                        ) ?? rule.destinationCountry
                      }`
                    : null,
                  rule.destinationProvince
                    ? `Provincia/Estado: ${rule.destinationProvince}`
                    : null,
                  formatPostalRestriction(rule),
                ]
                  .filter(Boolean)
                  .join(" · ") || "Sin restricciones"}
              </Text>
              <InlineStack gap="400">
                <Button onClick={() => handleOpenModal(rule)}>
                  Editar
                </Button>
                <toggleFetcher.Form method="post">
                  <input type="hidden" name="intent" value="toggle" />
                  <input type="hidden" name="id" value={rule.id} />
                  <input
                    type="hidden"
                    name="enabled"
                    value={String(!rule.enabled)}
                  />
                  <Button submit>
                    {rule.enabled ? "Desactivar" : "Activar"}
                  </Button>
                </toggleFetcher.Form>
                <deleteFetcher.Form
                  method="post"
                  onSubmit={(event) => {
                    if (
                      !window.confirm(
                        `¿Eliminar la regla "${rule.title}"?`,
                      )
                    ) {
                      event.preventDefault();
                    }
                  }}
                >
                  <input type="hidden" name="intent" value="delete" />
                  <input type="hidden" name="id" value={rule.id} />
                  <Button submit tone="critical">
                    Eliminar
                  </Button>
                </deleteFetcher.Form>
              </InlineStack>
            </BlockStack>
          </Card>
        ))}
      </BlockStack>
    </BlockStack>
  ) : null;

  return (
    <Page
      title="Reglas de envío"
      primaryAction={{
        content: "Nueva regla",
        onAction: () => handleOpenModal(null),
      }}
    >
      <Layout>
        <Layout.Section>
          {rules.length === 0 ? (
            emptyStateMarkup
          ) : (
            <BlockStack gap="400">
              {tabs.length > 1 ? (
                <Tabs
                  tabs={tabs}
                  selected={selectedGroupIndex}
                  onSelect={handleTabChange}
                />
              ) : null}
              {rulesMarkup
                ? (
                    <div
                      id={
                        tabs[selectedGroupIndex]?.panelID ??
                        "country-panel-selected"
                      }
                    >
                      {rulesMarkup}
                    </div>
                  )
                : null}
            </BlockStack>
          )}
        </Layout.Section>
      </Layout>
      <Modal
        open={isModalOpen}
        onClose={handleCloseModal}
        title={
          editingRule ? "Editar regla de envío" : "Nueva regla de envío"
        }
        primaryAction={{
          content: editingRule ? "Guardar cambios" : "Crear regla",
          onAction: () => {
            // This is a bit of a hack to submit the form from outside
            const form = document.getElementById("rule-form");
            if (form) {
              form.dispatchEvent(
                new Event("submit", { cancelable: true, bubbles: true }),
              );
            }
          },
          loading: isSubmitting,
        }}
        secondaryActions={[
          {
            content: "Cancelar",
            onAction: handleCloseModal,
          },
        ]}
      >
        <Modal.Section>
          <Form
            method="post"
            id="rule-form"
            onSubmit={() => {
              handleCloseModal();
            }}
          >
            <FormLayout>
              {actionData?.formError && (
                <Banner tone="critical">{actionData.formError}</Banner>
              )}
              <input
                type="hidden"
                name="intent"
                value={editingRule ? "update" : "create"}
              />
              {editingRule ? (
                <input type="hidden" name="id" value={editingRule.id} />
              ) : null}
              <TextField
                label="Nombre interno"
                name="title"
                value={formValues.title}
                onChange={handleTextFieldChange("title")}
                error={actionData?.errors?.title}
                requiredIndicator
                autoComplete="off"
              />
              <TextField
                label="Nombre visible para el cliente"
                name="rateName"
                value={formValues.rateName}
                onChange={handleTextFieldChange("rateName")}
                error={actionData?.errors?.rateName}
                requiredIndicator
                autoComplete="off"
              />
              <TextField
                label="Importe fijo (moneda de la tienda)"
                name="rateAmount"
                type="number"
                step={0.01}
                min={0}
                value={formValues.rateAmount}
                onChange={handleTextFieldChange("rateAmount")}
                error={actionData?.errors?.rateAmount}
                requiredIndicator
                autoComplete="off"
              />
              <Text as="h3" variant="headingMd">
                Condiciones opcionales
              </Text>
              <FormLayout.Group>
                <TextField
                  label="Subtotal mínimo"
                  name="minSubtotal"
                  type="number"
                  step={0.01}
                  value={formValues.minSubtotal}
                  onChange={handleTextFieldChange("minSubtotal")}
                  error={actionData?.errors?.minSubtotal}
                  autoComplete="off"
                />
                <TextField
                  label="Subtotal máximo"
                  name="maxSubtotal"
                  type="number"
                  step={0.01}
                  value={formValues.maxSubtotal}
                  onChange={handleTextFieldChange("maxSubtotal")}
                  error={actionData?.errors?.maxSubtotal}
                  autoComplete="off"
                />
              </FormLayout.Group>
              <FormLayout.Group>
                <TextField
                  label="Peso mínimo (kg)"
                  name="minWeight"
                  type="number"
                  step={0.01}
                  value={formValues.minWeight}
                  onChange={handleTextFieldChange("minWeight")}
                  error={actionData?.errors?.minWeight}
                  autoComplete="off"
                />
                <TextField
                  label="Peso máximo (kg)"
                  name="maxWeight"
                  type="number"
                  step={0.01}
                  value={formValues.maxWeight}
                  onChange={handleTextFieldChange("maxWeight")}
                  error={actionData?.errors?.maxWeight}
                  autoComplete="off"
                />
              </FormLayout.Group>
              <FormLayout.Group>
                <Select
                  label="País destino"
                  name="destinationCountry"
                  options={countryOptions}
                  value={formValues.destinationCountry}
                  onChange={handleTextFieldChange("destinationCountry")}
                />
                <TextField
                  label="Provincia/Estado (ISO)"
                  name="destinationProvince"
                  maxLength={10}
                  value={formValues.destinationProvince}
                  onChange={handleTextFieldChange("destinationProvince")}
                  autoComplete="off"
                />
              </FormLayout.Group>
              <FormLayout.Group>
                <TextField
                  label="Código postal desde"
                  name="destinationPostalCodeStart"
                  value={formValues.destinationPostalCodeStart}
                  onChange={handleTextFieldChange("destinationPostalCodeStart")}
                  error={actionData?.errors?.destinationPostalCodeStart}
                  helpText={postalRangeHelpText}
                  inputMode="numeric"
                  autoComplete="off"
                />
                <TextField
                  label="Código postal hasta"
                  name="destinationPostalCodeEnd"
                  value={formValues.destinationPostalCodeEnd}
                  onChange={handleTextFieldChange("destinationPostalCodeEnd")}
                  error={actionData?.errors?.destinationPostalCodeEnd}
                  inputMode="numeric"
                  autoComplete="off"
                />
              </FormLayout.Group>
              <TextField
                label="Código Carrier Service"
                name="carrierServiceCode"
                value={formValues.carrierServiceCode}
                onChange={handleTextFieldChange("carrierServiceCode")}
                placeholder="Opcional, visible en Shopify"
                autoComplete="off"
              />
              <Checkbox
                label="Regla activa"
                name="enabled"
                checked={formValues.enabled}
                onChange={handleEnabledChange}
              />
              {hasErrors && (
                <Banner tone="critical">
                  Revisa los campos marcados para poder guardar la regla.
                </Banner>
              )}
            </FormLayout>
          </Form>
        </Modal.Section>
      </Modal>
    </Page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
