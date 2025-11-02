import { useMemo, useState } from "react";
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
  const destinationPostalCode = sanitizeString(
    formData.get("destinationPostalCode"),
  )?.toUpperCase() ?? null;

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
            destinationPostalCode,
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

export default function ShippingRulesPage() {
  const { rules } = useLoaderData<typeof loader>();
  const actionData = useActionData<ActionData>();
  const navigation = useNavigation();
  const [editingId, setEditingId] = useState<number | null>(null);
  const deleteFetcher = useFetcher<typeof action>();
  const toggleFetcher = useFetcher<typeof action>();

  const isSubmitting = navigation.state === "submitting";

  const editingRule = useMemo(
    () => rules.find((rule) => rule.id === editingId) ?? null,
    [rules, editingId],
  );

  const hasErrors = Boolean(
    actionData?.formError || Object.keys(actionData?.errors ?? {}).length,
  );

  return (
    <s-page heading="Reglas de envío">
      <s-button
        slot="primary-action"
        variant="primary"
        onClick={() => setEditingId(null)}
      >
        Nueva regla
      </s-button>

      <s-layout>
        <s-layout-section>
          <s-section heading="Reglas configuradas">
            {rules.length === 0 ? (
              <s-paragraph>
                Todavía no has creado reglas. Añade la primera para personalizar
                los costes de envío.
              </s-paragraph>
            ) : (
              <s-stack direction="block" gap="base">
                {rules.map((rule) => (
                  <s-box
                    key={rule.id}
                    padding="base"
                    borderWidth="base"
                    borderRadius="base"
                    background="subdued"
                  >
                    <s-stack direction="block" gap="tight">
                      <s-stack direction="inline" gap="base" alignment="center">
                        <s-heading level="3">{rule.title}</s-heading>
                        <s-badge tone={rule.enabled ? "success" : "critical"}>
                          {rule.enabled ? "Activa" : "Inactiva"}
                        </s-badge>
                      </s-stack>
                      <s-text>
                        Tarifa mostrada: <strong>{rule.rateName}</strong> ·{" "}
                        {formatAmount(rule.rateAmountCents)} (moneda tienda)
                      </s-text>
                      <s-text>
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
                            ? `País: ${rule.destinationCountry}`
                            : null,
                          rule.destinationProvince
                            ? `Provincia/Estado: ${rule.destinationProvince}`
                            : null,
                          rule.destinationPostalCode
                            ? `CP: ${rule.destinationPostalCode}`
                            : null,
                        ]
                          .filter(Boolean)
                          .join(" · ") || "Sin restricciones"}
                      </s-text>
                      <s-stack direction="inline" gap="base">
                        <s-button
                          variant="tertiary"
                          onClick={() => setEditingId(rule.id)}
                        >
                          Editar
                        </s-button>
                        <toggleFetcher.Form method="post">
                          <input type="hidden" name="intent" value="toggle" />
                          <input type="hidden" name="id" value={rule.id} />
                          <input
                            type="hidden"
                            name="enabled"
                            value={String(!rule.enabled)}
                          />
                          <s-button type="submit" variant="tertiary">
                            {rule.enabled ? "Desactivar" : "Activar"}
                          </s-button>
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
                          <s-button tone="critical" type="submit" variant="plain">
                            Eliminar
                          </s-button>
                        </deleteFetcher.Form>
                      </s-stack>
                    </s-stack>
                  </s-box>
                ))}
              </s-stack>
            )}
          </s-section>
        </s-layout-section>

        <s-layout-section secondary>
          <s-section
            heading={
              editingRule ? "Editar regla de envío" : "Nueva regla de envío"
            }
          >
            {actionData?.formError && (
              <s-banner tone="critical">{actionData.formError}</s-banner>
            )}

            <Form
              method="post"
              key={editingRule ? `edit-${editingRule.id}` : "create"}
            >
              <input
                type="hidden"
                name="intent"
                value={editingRule ? "update" : "create"}
              />
              {editingRule ? (
                <input type="hidden" name="id" value={editingRule.id} />
              ) : null}

              <s-stack direction="block" gap="base">
                <label>
                  <s-text variant="subdued">Nombre interno</s-text>
                  <input
                    name="title"
                    type="text"
                    defaultValue={editingRule?.title ?? ""}
                    required
                  />
                  {actionData?.errors?.title && (
                    <s-text tone="critical">
                      {actionData.errors.title}
                    </s-text>
                  )}
                </label>

                <label>
                  <s-text variant="subdued">
                    Nombre visible para el cliente
                  </s-text>
                  <input
                    name="rateName"
                    type="text"
                    defaultValue={editingRule?.rateName ?? ""}
                    required
                  />
                  {actionData?.errors?.rateName && (
                    <s-text tone="critical">
                      {actionData.errors.rateName}
                    </s-text>
                  )}
                </label>

                <label>
                  <s-text variant="subdued">
                    Importe fijo (moneda de la tienda)
                  </s-text>
                  <input
                    name="rateAmount"
                    type="number"
                    step="0.01"
                    min="0"
                    defaultValue={
                      editingRule
                        ? (editingRule.rateAmountCents / 100).toFixed(2)
                        : ""
                    }
                    required
                  />
                  {actionData?.errors?.rateAmount && (
                    <s-text tone="critical">
                      {actionData.errors.rateAmount}
                    </s-text>
                  )}
                </label>

                <s-heading level="4">Condiciones opcionales</s-heading>

                <label>
                  <s-text variant="subdued">
                    Subtotal mínimo del pedido (moneda de la tienda)
                  </s-text>
                  <input
                    name="minSubtotal"
                    type="number"
                    step="0.01"
                    defaultValue={
                      editingRule && editingRule.minSubtotal !== null
                        ? editingRule.minSubtotal.toString()
                        : ""
                    }
                  />
                  {actionData?.errors?.minSubtotal && (
                    <s-text tone="critical">
                      {actionData.errors.minSubtotal}
                    </s-text>
                  )}
                </label>

                <label>
                  <s-text variant="subdued">
                    Subtotal máximo del pedido (moneda de la tienda)
                  </s-text>
                  <input
                    name="maxSubtotal"
                    type="number"
                    step="0.01"
                    defaultValue={
                      editingRule && editingRule.maxSubtotal !== null
                        ? editingRule.maxSubtotal.toString()
                        : ""
                    }
                  />
                  {actionData?.errors?.maxSubtotal && (
                    <s-text tone="critical">
                      {actionData.errors.maxSubtotal}
                    </s-text>
                  )}
                </label>

                <label>
                  <s-text variant="subdued">Peso mínimo (kg)</s-text>
                  <input
                    name="minWeight"
                    type="number"
                    step="0.01"
                    defaultValue={
                      editingRule && editingRule.minWeight !== null
                        ? editingRule.minWeight.toString()
                        : ""
                    }
                  />
                  {actionData?.errors?.minWeight && (
                    <s-text tone="critical">
                      {actionData.errors.minWeight}
                    </s-text>
                  )}
                </label>

                <label>
                  <s-text variant="subdued">Peso máximo (kg)</s-text>
                  <input
                    name="maxWeight"
                    type="number"
                    step="0.01"
                    defaultValue={
                      editingRule && editingRule.maxWeight !== null
                        ? editingRule.maxWeight.toString()
                        : ""
                    }
                  />
                  {actionData?.errors?.maxWeight && (
                    <s-text tone="critical">
                      {actionData.errors.maxWeight}
                    </s-text>
                  )}
                </label>

                <label>
                  <s-text variant="subdued">
                    País destino (ISO 2 letras)
                  </s-text>
                  <input
                    name="destinationCountry"
                    type="text"
                    maxLength={2}
                    defaultValue={editingRule?.destinationCountry ?? ""}
                  />
                </label>

                <label>
                  <s-text variant="subdued">
                    Provincia/Estado destino (ISO)
                  </s-text>
                  <input
                    name="destinationProvince"
                    type="text"
                    maxLength={10}
                    defaultValue={editingRule?.destinationProvince ?? ""}
                  />
                </label>

                <label>
                  <s-text variant="subdued">Código postal destino</s-text>
                  <input
                    name="destinationPostalCode"
                    type="text"
                    defaultValue={editingRule?.destinationPostalCode ?? ""}
                  />
                </label>

                <label>
                  <s-text variant="subdued">Código Carrier Service</s-text>
                  <input
                    name="carrierServiceCode"
                    type="text"
                    defaultValue={editingRule?.carrierServiceCode ?? ""}
                    placeholder="Opcional, visible en Shopify"
                  />
                </label>

                <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input
                    type="checkbox"
                    name="enabled"
                    defaultChecked={editingRule ? editingRule.enabled : true}
                  />
                  <s-text>Regla activa</s-text>
                </label>

                <s-button
                  tone="critical"
                  variant="tertiary"
                  type="button"
                  onClick={() => setEditingId(null)}
                  disabled={!editingRule}
                >
                  Cancelar edición
                </s-button>

                <s-button
                  type="submit"
                  variant="primary"
                  loading={isSubmitting}
                >
                  {editingRule ? "Guardar cambios" : "Crear regla"}
                </s-button>
              </s-stack>
            </Form>

            {hasErrors && (
              <s-text tone="subdued">
                Revisa los campos marcados para poder guardar la regla.
              </s-text>
            )}
          </s-section>
        </s-layout-section>
      </s-layout>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
