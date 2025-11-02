export default function HelpPage() {
  return (
    <s-page heading="Ayuda y documentación">
      <s-section heading="Cómo funcionan las reglas de envío">
        <s-paragraph>
          Define condiciones por subtotal, peso y destino para devolver tarifas
          dinámicas desde un Carrier Service. Shopify invocará el endpoint
          <code>/api/carrier</code> en cada cálculo de envío y la respuesta se
          genera con las reglas activas.
        </s-paragraph>
        <s-paragraph>
          Usa el formulario de la página principal para crear, editar o
          desactivar reglas. Las reglas se evalúan en orden de creación y todas
          las coincidencias se mostrarán al cliente como opciones de envío.
        </s-paragraph>
      </s-section>

      <s-section heading="Configuración necesaria">
        <s-unordered-list>
          <s-list-item>
            Añade los scopes <code>read_shipping</code> y
            <code>write_shipping</code> en tus variables de entorno y en el
            fichero <code>shopify.app.toml</code>.
          </s-list-item>
          <s-list-item>
            Establece <code>SHOPIFY_APP_URL</code> con la URL pública de la app;
            se usa para registrar el Carrier Service con el callback
            <code>/api/carrier</code>.
          </s-list-item>
          <s-list-item>
            Reinstala la app o fuerza un nuevo login para ejecutar el hook
            <code>afterAuth</code> y (re)registrar el Carrier Service en la
            tienda.
          </s-list-item>
        </s-unordered-list>
      </s-section>

      <s-section slot="aside" heading="Recursos recomendados">
        <s-unordered-list>
          <s-list-item>
            <s-link
              href="https://shopify.dev/docs/apps/fulfillment/shipping-rates/carrier-service"
              target="_blank"
            >
              Carrier Service API
            </s-link>
          </s-list-item>
          <s-list-item>
            <s-link
              href="https://shopify.dev/docs/apps/build/polaris-components"
              target="_blank"
            >
              Polaris Web Components
            </s-link>
          </s-list-item>
        </s-unordered-list>
      </s-section>
    </s-page>
  );
}
