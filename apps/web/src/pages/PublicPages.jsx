import {
  ArrowRight,
  Check,
  Clock3,
  IndianRupee,
  Route,
  ShieldCheck,
  SlidersHorizontal
} from "lucide-react";
import { Link } from "react-router-dom";
import { Brand } from "../components/Brand.jsx";
function PublicNav() {
  return (
    <header className="shell nav">
      <Brand />
      <nav className="nav-links" aria-label="Main navigation">
        <Link to="/how-it-works">How it works</Link>
        <Link to="/pricing">Pricing</Link>
        <Link to="/login">Sign in</Link>
        <Link className="btn btn-primary" to="/register">
          Find my charger <ArrowRight size={15} />
        </Link>
      </nav>
    </header>
  );
}
function Footer() {
  return (
    <footer className="shell footer">
      <Brand />
      <span>© 2026 Currents Mobility. Built for the road ahead.</span>
      <span>Bengaluru · India</span>
    </footer>
  );
}
export function LandingPage() {
  return (
    <>
      <PublicNav />
      <main>
        <section className="shell hero">
          <div>
            <span className="eyebrow">Smart EV charging</span>
            <h1>
              Know where to charge. <em>And why.</em>
            </h1>
            <p className="hero-copy">
              Currents looks beyond the nearest pin. Live availability, your car, the queue, and the
              price—ranked into one clear recommendation.
            </p>
            <div className="hero-actions">
              <Link className="btn btn-primary" to="/register">
                Recommend a charger <ArrowRight size={17} />
              </Link>
              <Link className="btn btn-secondary" to="/how-it-works">
                See how it decides
              </Link>
            </div>
            <div className="trust-row">
              <span>
                <Check size={14} /> Live charger status
              </span>
              <span>
                <Check size={14} /> Price-aware routing
              </span>
              <span>
                <Check size={14} /> One-tap booking
              </span>
            </div>
          </div>
          <div className="recommend-preview" aria-label="Currents recommendation preview">
            <div className="preview-top">
              <span>NEAR INDIRANAGAR</span>
              <span>18:42 · LIVE</span>
            </div>
            <div className="preview-map">
              <i className="map-pin" style={{ left: "51%", top: "40%" }} />
              <i className="map-pin" style={{ left: "28%", top: "64%", opacity: 0.55 }} />
              <i className="map-pin" style={{ left: "75%", top: "24%", opacity: 0.55 }} />
            </div>
            <div className="recommend-card">
              <span className="rank">01 · BEST MATCH</span>
              <h3>Indiranagar Current Hub</h3>
              <p>
                1.2 km farther, but no wait and ₹2.40/kWh cheaper—back on the road 12 minutes
                sooner.
              </p>
              <div className="metric-row">
                <div className="metric">
                  <strong>28 min</strong>
                  <small>total time</small>
                </div>
                <div className="metric">
                  <strong>₹412</strong>
                  <small>estimate</small>
                </div>
                <div className="metric">
                  <strong>60 kW</strong>
                  <small>best plug</small>
                </div>
              </div>
            </div>
          </div>
        </section>
        <section className="section section-sunken">
          <div className="shell">
            <div className="section-head">
              <h2>The nearest charger is not always the right one.</h2>
              <p>
                Five extra minutes of driving can save twenty in a queue. Currents does that
                arithmetic before you leave.
              </p>
            </div>
            <div className="feature-grid">
              <article className="feature-card">
                <span className="num">01 / LIVE</span>
                <h3>Reads the network</h3>
                <p>
                  Availability, connector speed, faults, and active queues—not a stale directory of
                  pins.
                </p>
              </article>
              <article className="feature-card">
                <span className="num">02 / PERSONAL</span>
                <h3>Understands your car</h3>
                <p>
                  Connector, battery size, and current charge turn generic results into your result.
                </p>
              </article>
              <article className="feature-card">
                <span className="num">03 / EXPLAINED</span>
                <h3>Shows its reasoning</h3>
                <p>
                  Every recommendation includes the time, cost, and trade-off in plain language.
                </p>
              </article>
            </div>
          </div>
        </section>
        <section className="shell section">
          <p className="quote">
            “A charging app should make a decision easier—not give you a map and ask you to do the
            maths.”
          </p>
          <Link className="btn btn-primary" to="/register">
            Start with Currents <ArrowRight size={16} />
          </Link>
        </section>
      </main>
      <Footer />
    </>
  );
}
export function HowItWorksPage() {
  return (
    <>
      <PublicNav />
      <main>
        <section className="shell section">
          <span className="eyebrow">How it works</span>
          <div className="section-head" style={{ marginTop: 20 }}>
            <h2>From low battery to the right plug in three steps.</h2>
            <p>
              No opaque score. Currents exposes the trade-offs so you can trust the recommendation.
            </p>
          </div>
          <div className="feature-grid">
            <article className="feature-card">
              <SlidersHorizontal color="var(--copper-500)" />
              <h3>Tell us what matters</h3>
              <p>
                Pick your vehicle, current battery, and whether this trip should optimize for time,
                cost, or both.
              </p>
            </article>
            <article className="feature-card">
              <Route color="var(--copper-500)" />
              <h3>We compare the journey</h3>
              <p>
                Currents combines driving time, expected queue, charging speed, and the live rate
                across compatible stations.
              </p>
            </article>
            <article className="feature-card">
              <Clock3 color="var(--copper-500)" />
              <h3>Book with context</h3>
              <p>
                Choose from three ranked options, read why each made the list, then reserve the
                exact plug.
              </p>
            </article>
          </div>
        </section>
        <section className="section section-sunken">
          <div className="shell split">
            <div>
              <span className="eyebrow">A useful score</span>
              <h2 className="display" style={{ fontSize: 48 }}>
                Time to back on the road.
              </h2>
              <p className="hero-copy">
                Distance alone hides the expensive part: waiting and charging. Our v1 engine
                estimates all three, alongside the final bill.
              </p>
            </div>
            <div className="card">
              <div className="metric-row">
                <div className="metric">
                  <strong>8 min</strong>
                  <small>drive</small>
                </div>
                <div className="metric">
                  <strong>0 min</strong>
                  <small>wait</small>
                </div>
                <div className="metric">
                  <strong>21 min</strong>
                  <small>charge</small>
                </div>
              </div>
              <hr style={{ border: 0, borderTop: "1px solid var(--border)", margin: "28px 0" }} />
              <strong className="display" style={{ fontSize: 38 }}>
                29 min total
              </strong>
              <p className="muted">Compared consistently across every compatible station nearby.</p>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
export function PricingPage() {
  return (
    <>
      <PublicNav />
      <main>
        <section className="shell section">
          <span className="eyebrow">Simple pricing</span>
          <div className="section-head" style={{ marginTop: 20 }}>
            <h2>Pay for the energy you use. Nothing invented.</h2>
            <p>
              No platform subscription in the MVP. Stations set their per-kWh rate and Currents
              shows the live estimate before booking.
            </p>
          </div>
          <div className="split">
            <article className="card" style={{ padding: 34 }}>
              <IndianRupee color="var(--copper-500)" />
              <h3 style={{ fontSize: 32 }}>Charging</h3>
              <p className="muted">
                The station’s ₹/kWh rate × energy delivered, including any visible time-of-day
                multiplier.
              </p>
              <div className="metric-row">
                <div className="metric">
                  <strong>₹15–₹22</strong>
                  <small>typical per kWh</small>
                </div>
                <div className="metric">
                  <strong>₹0</strong>
                  <small>Currents fee</small>
                </div>
                <div className="metric">
                  <strong>Live</strong>
                  <small>cost estimate</small>
                </div>
              </div>
            </article>
            <article className="card" style={{ padding: 34 }}>
              <ShieldCheck color="var(--copper-500)" />
              <h3 style={{ fontSize: 32 }}>Payments</h3>
              <p className="muted">
                Pay securely by card or supported local methods through Stripe, or keep a balance in
                your Currents wallet.
              </p>
              <ul style={{ lineHeight: 2, color: "var(--ink-700)", paddingLeft: 20 }}>
                <li>Receipt for every completed session</li>
                <li>Clear energy and rate breakdown</li>
                <li>Wallet balance updated atomically</li>
              </ul>
            </article>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
