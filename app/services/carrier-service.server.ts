import type { Session } from "@shopify/shopify-api";
import { ApiVersion } from "@shopify/shopify-app-react-router/server";

const API_VERSION = ApiVersion.October25;
const CARRIER_SERVICE_NAME = "Shipping Rules Carrier";
const CARRIER_SERVICE_CODE = "SHIPPING_RULES";
const CALLBACK_PATH = "/api/carrier";

type ShopifyCarrierService = {
  id: number;
  name: string;
  callback_url: string;
  active: boolean;
  carrier_service_type?: string;
};

const shopAdminUrl = (shop: string, path: string) =>
  `https://${shop}/admin/api/${API_VERSION}${path}`;

const buildHeaders = (session: Session) => ({
  "Content-Type": "application/json",
  "X-Shopify-Access-Token": session.accessToken,
});

const getCallbackUrl = () => {
  const appUrl = process.env.SHOPIFY_APP_URL;

  if (!appUrl) {
    throw new Error(
      "SHOPIFY_APP_URL no está configurado. Es necesario para registrar el Carrier Service.",
    );
  }

  return new URL(CALLBACK_PATH, appUrl).toString();
};

const fetchCarrierServices = async (session: Session) => {
  const response = await fetch(
    shopAdminUrl(session.shop, "/carrier_services.json"),
    {
      method: "GET",
      headers: buildHeaders(session),
    },
  );

  if (!response.ok) {
    const payload = await response.text();
    throw new Error(
      `No se pudo recuperar la lista de Carrier Services (${response.status}): ${payload}`,
    );
  }

  const payload = (await response.json()) as {
    carrier_services?: ShopifyCarrierService[];
  };

  return payload.carrier_services ?? [];
};

const createCarrierService = async (
  session: Session,
  callbackUrl: string,
) => {
  const response = await fetch(
    shopAdminUrl(session.shop, "/carrier_services.json"),
    {
      method: "POST",
      headers: buildHeaders(session),
      body: JSON.stringify({
        carrier_service: {
          name: CARRIER_SERVICE_NAME,
          callback_url: callbackUrl,
          service_discovery: true,
          carrier_service_type: "api",
          format: "json",
          active: true,
          code: CARRIER_SERVICE_CODE,
        },
      }),
    },
  );

  if (!response.ok) {
    const payload = await response.text();
    throw new Error(
      `No se pudo crear el Carrier Service (${response.status}): ${payload}`,
    );
  }
};

const updateCarrierService = async (
  session: Session,
  carrierId: number,
  callbackUrl: string,
) => {
  const response = await fetch(
    shopAdminUrl(session.shop, `/carrier_services/${carrierId}.json`),
    {
      method: "PUT",
      headers: buildHeaders(session),
      body: JSON.stringify({
        carrier_service: {
          id: carrierId,
          name: CARRIER_SERVICE_NAME,
          callback_url: callbackUrl,
          active: true,
          service_discovery: true,
          carrier_service_type: "api",
          format: "json",
          code: CARRIER_SERVICE_CODE,
        },
      }),
    },
  );

  if (!response.ok) {
    const payload = await response.text();
    throw new Error(
      `No se pudo actualizar el Carrier Service (${response.status}): ${payload}`,
    );
  }
};

export const ensureCarrierService = async (session: Session) => {
  const callbackUrl = getCallbackUrl();
  const services = await fetchCarrierServices(session);

  const matchingService = services.find(
    (service) =>
      service.name === CARRIER_SERVICE_NAME ||
      service.callback_url === callbackUrl ||
      service.id === Number(process.env.SHIPPING_RULES_CARRIER_ID ?? ""),
  );

  if (!matchingService) {
    await createCarrierService(session, callbackUrl);
    return;
  }

  const needsUpdate =
    matchingService.callback_url !== callbackUrl || !matchingService.active;

  if (needsUpdate) {
    await updateCarrierService(session, matchingService.id, callbackUrl);
  }
};
