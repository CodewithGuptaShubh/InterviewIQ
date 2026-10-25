const CHECKOUT_SRC = "https://checkout.razorpay.com/v1/checkout.js";
let loader = null;

function loadCheckout() {
  if (window.Razorpay) return Promise.resolve();
  loader ||= new Promise((resolve, reject) => {
    const script = Object.assign(document.createElement("script"), { src: CHECKOUT_SRC, async: true });
    script.onload = resolve;
    script.onerror = () => {
      loader = null;
      reject(new Error("Could not load Razorpay checkout. Check your internet connection."));
    };
    document.body.appendChild(script);
  });
  return loader;
}

/**
 * Open Razorpay Checkout for a server-created order.
 * Resolves with { razorpay_order_id, razorpay_payment_id, razorpay_signature } on success.
 * Rejects when the window is closed: with the last payment error if an attempt failed, else { cancelled: true }.
 * (Razorpay keeps the window open after a failed attempt so the user can retry, so failures aren't final.)
 */
export async function openCheckout(order, { description, color = "#22d3ee" } = {}) {
  await loadCheckout();
  return new Promise((resolve, reject) => {
    let lastError = null;
    const checkout = new window.Razorpay({
      key: order.keyId,
      order_id: order.orderId,
      amount: order.amountPaise,
      currency: order.currency,
      name: "InterviewIQ",
      description,
      prefill: order.prefill,
      theme: { color },
      handler: resolve,
      modal: { ondismiss: () => reject(lastError || { cancelled: true }) }
    });
    checkout.on("payment.failed", (response) => {
      lastError = new Error(response.error?.description || "Payment failed");
    });
    checkout.open();
  });
}
