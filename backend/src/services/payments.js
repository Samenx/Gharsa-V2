import { assert } from "../utils/errors.js";
// Gateway adapters may create payment intents here. Never accept card data or
// a paid status from the client. Online gateways must verify signed webhooks.
const methods = new Map([
  [
    "cod",
    {
      name: "Cash on Delivery",
      validate(settings) {
        assert(
          settings.cod_enabled !== false,
          "Cash on delivery is currently unavailable.",
        );
      },
      initialStatus: "unpaid",
    },
  ],
]);
export function paymentMethod(code, settings) {
  const method = methods.get(code);
  assert(method, "This payment method is not supported.");
  method.validate(settings);
  return method;
}
