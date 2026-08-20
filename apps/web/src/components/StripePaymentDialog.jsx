import { useState } from "react";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { X } from "lucide-react";

const publishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
const stripePromise = publishableKey ? loadStripe(publishableKey) : null;

function StripeForm({ intent, onConfirmed }) {
  const stripe = useStripe();
  const elements = useElements();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    const result = await stripe.confirmPayment({
      elements,
      redirect: "if_required",
      confirmParams: { return_url: window.location.href }
    });
    if (result.error) setError(result.error.message || "Payment could not be completed");
    else if (result.paymentIntent?.status === "succeeded") await onConfirmed(intent.id);
    setBusy(false);
  };
  return (
    <form className="form-stack" onSubmit={submit}>
      <PaymentElement />
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <button className="btn btn-primary" disabled={!stripe || busy}>
        {busy ? "Confirming…" : "Pay securely"}
      </button>
    </form>
  );
}

export function StripePaymentDialog({ intent, title, onClose, onConfirmed }) {
  return (
    <div
      className="dialog-backdrop"
      role="presentation"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <section
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="stripe-payment-title"
      >
        <div className="dialog-head">
          <h2 id="stripe-payment-title">{title}</h2>
          <button className="icon-btn" aria-label="Close payment" onClick={onClose}>
            <X size={17} />
          </button>
        </div>
        {intent.provider === "fake" ? (
          <div className="form-stack">
            <p className="muted">Local test mode does not charge a real payment method.</p>
            <button className="btn btn-primary" onClick={() => onConfirmed(intent.id, true)}>
              Complete test payment
            </button>
          </div>
        ) : !stripePromise ? (
          <p className="form-error" role="alert">
            Set VITE_STRIPE_PUBLISHABLE_KEY and restart the web app.
          </p>
        ) : (
          <Elements
            stripe={stripePromise}
            options={{ clientSecret: intent.clientSecret, appearance: { theme: "stripe" } }}
          >
            <StripeForm intent={intent} onConfirmed={onConfirmed} />
          </Elements>
        )}
      </section>
    </div>
  );
}
