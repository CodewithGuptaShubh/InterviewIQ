import { Check, CreditCard, Loader2, ShieldCheck } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Badge } from "../components/ui/Badge.jsx";
import { Button } from "../components/ui/Button.jsx";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/Card.jsx";
import { api } from "../api/client.js";
import { openCheckout } from "../lib/razorpay.js";
import { cn } from "../lib/utils.js";
import { useApp } from "../state/AppContext.jsx";

const PACKS = [1, 3, 5];
const STATUS_TONE = { paid: "success", created: "default", failed: "warning" };

export function PricingPage() {
  const { user, setUser, refreshUser } = useApp();
  const [config, setConfig] = useState(null);
  const [credits, setCredits] = useState(1);
  const [buying, setBuying] = useState(false);
  const [notice, setNotice] = useState(null);
  const [history, setHistory] = useState([]);
  const freeLeft = Math.max(0, 2 - user.freeInterviewsUsed);
  const price = config?.pricePerCredit ?? 50;
  const isRazorpay = config?.provider === "razorpay";

  const loadHistory = useCallback(() => api.paymentHistory().then((data) => setHistory(data.payments)).catch(() => {}), []);

  useEffect(() => {
    api.paymentConfig().then(setConfig).catch(() => setConfig({ provider: "demo", pricePerCredit: 50 }));
    loadHistory();
    // Pull the latest balance in case a payment was credited elsewhere (another tab or the webhook).
    refreshUser().catch(() => {});
  }, [loadHistory, refreshUser]);

  async function buyCredits() {
    setBuying(true);
    setNotice(null);
    let order;
    try {
      order = await api.createOrder(credits);
      let verification = { orderId: order.orderId };
      if (order.provider === "razorpay") {
        let response;
        try {
          response = await openCheckout(order, { description: `${credits} mock interview credit${credits > 1 ? "s" : ""}` });
        } catch (checkoutError) {
          // Only failures inside checkout mark the order failed; a verify/network error after paying must not.
          if (!checkoutError?.cancelled) api.reportPaymentFailure(order.orderId, checkoutError.message).catch(() => {});
          throw checkoutError;
        }
        verification = { orderId: response.razorpay_order_id, paymentId: response.razorpay_payment_id, signature: response.razorpay_signature };
      }
      const result = await api.verifyPayment(verification);
      setUser(result.user);
      const balance = `You now have ${result.user.credits} paid credit${result.user.credits === 1 ? "" : "s"}.`;
      setNotice({ tone: "success", text: `${result.message} ${balance}${order.provider === "razorpay" ? "" : " (demo payment, no charge)"}` });
    } catch (err) {
      if (err?.cancelled) {
        setNotice({ tone: "info", text: "Payment cancelled. No money was charged." });
      } else {
        setNotice({ tone: "error", text: err.message || "Payment failed" });
      }
    } finally {
      setBuying(false);
      loadHistory();
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="p-8">
          <Badge tone="info">Simple pricing</Badge>
          <h2 className="mt-4 max-w-2xl text-4xl font-semibold md:text-5xl">Start free, pay only when you need deeper feedback.</h2>
          <p className="mt-4 max-w-2xl text-muted-foreground">The paid interview unlocks the full report, coding round evaluation, analytics, and personalized roadmap.</p>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Plan title="Free" price="₹0" subtitle={`2 interviews total • ${freeLeft} left`} features={["Basic feedback", "Resume analysis", "Dashboard history", "Text interview mode"]}>
          <Button className="mt-8 w-full" variant="outline" disabled>{freeLeft ? "Current plan" : "Free interviews used"}</Button>
        </Plan>

        <Plan title="Paid interview" price={`₹${price}`} subtitle={`Per full interview • you have ${user.credits} credit${user.credits === 1 ? "" : "s"}`} featured features={["Full AI report", "Detailed analytics", "Coding round", "Personalized roadmap", "Voice interview experience"]}>
          <div className="mt-8 grid grid-cols-3 gap-2">
            {PACKS.map((pack) => (
              <button
                key={pack}
                type="button"
                onClick={() => setCredits(pack)}
                className={cn("rounded-md border p-3 text-center text-sm transition", credits === pack ? "border-primary bg-primary/10" : "hover:bg-muted")}
              >
                <p className="font-semibold">{pack} credit{pack > 1 ? "s" : ""}</p>
                <p className="text-muted-foreground">₹{pack * price}</p>
              </button>
            ))}
          </div>
          <Button className="mt-4 w-full" onClick={buyCredits} disabled={buying || !config}>
            {buying ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
            {buying ? "Processing..." : `Pay ₹${credits * price}`}
          </Button>
          <p className="mt-3 flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5" />
            {isRazorpay ? "Secured by Razorpay • UPI, cards, netbanking, wallets" : "Demo mode: no real payment is taken"}
          </p>
        </Plan>
      </div>

      {notice && (
        <Card>
          <CardContent className={cn("flex items-center gap-3 text-sm", notice.tone === "success" ? "text-emerald-300" : notice.tone === "error" ? "text-red-300" : "text-muted-foreground")}>
            <CreditCard className="h-4 w-4" /> {notice.text}
          </CardContent>
        </Card>
      )}

      {history.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Payment history</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="text-muted-foreground">
                <tr><th className="pb-3">Date</th><th className="pb-3">Credits</th><th className="pb-3">Amount</th><th className="pb-3">Status</th><th className="pb-3">Reference</th></tr>
              </thead>
              <tbody>
                {history.map((payment) => (
                  <tr key={payment.orderId} className="border-t">
                    <td className="py-3">{new Date(payment.paidAt || payment.createdAt).toLocaleString()}</td>
                    <td>{payment.credits}</td>
                    <td>₹{payment.amount}</td>
                    <td><Badge tone={STATUS_TONE[payment.status]} title={payment.failureReason || ""}>{payment.status === "created" ? "pending" : payment.status}</Badge></td>
                    <td className="font-mono text-xs text-muted-foreground">{payment.paymentId || payment.orderId}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Plan({ title, price, subtitle, features, featured, children }) {
  return (
    <Card className={featured ? "border-primary shadow-glow" : ""}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>{title}</CardTitle>
          {featured && <Badge tone="success">Recommended</Badge>}
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-5xl font-semibold">{price}</p>
        <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>
        <div className="mt-6 space-y-3">
          {features.map((feature) => <p key={feature} className="flex items-center gap-2 text-sm"><Check className="h-4 w-4 text-emerald-300" /> {feature}</p>)}
        </div>
        {children}
      </CardContent>
    </Card>
  );
}
