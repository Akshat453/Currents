import { forwardRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema
} from "@currents/shared";
import { Brand } from "../components/Brand.jsx";
import { api } from "../lib/api.js";
import { useAuthStore } from "../stores/auth.js";
function AuthFrame({ children }) {
  return (
    <main className="auth-layout">
      <aside className="auth-aside">
        <Brand />
        <p className="auth-quote">
          The calmest part of your drive should be deciding where to charge.
        </p>
        <span style={{ color: "var(--ink-300)", fontSize: 13 }}>
          Live in Bengaluru · Test network
        </span>
      </aside>
      <section className="auth-panel">{children}</section>
    </main>
  );
}
const Input = forwardRef(function Input({ label, error, ...props }, ref) {
  return (
    <div className="field">
      <label htmlFor={props.id}>{label}</label>
      <input ref={ref} className="input" {...props} />
      {error && <span className="error">{error.message}</span>}
    </div>
  );
});
export function LoginPage() {
  const user = useAuthStore((s) => s.user);
  const set = useAuthStore((s) => s.setSession);
  const navigate = useNavigate();
  const [serverError, setServerError] = useState("");
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting }
  } = useForm({ resolver: zodResolver(loginSchema) });
  if (user) return <Navigate to={user.role === "operator" ? "/operator" : "/app"} replace />;
  const submit = async (values) => {
    try {
      const { data } = await api.post("/auth/login", values);
      set(data.data);
      navigate(data.data.user.role === "operator" ? "/operator" : "/app");
    } catch (e) {
      setServerError(e.response?.data?.error?.message || "Could not sign in");
    }
  };
  return (
    <AuthFrame>
      <form className="auth-form" onSubmit={handleSubmit(submit)}>
        <h1>Welcome back.</h1>
        <p className="muted">Sign in to see where the road should take you.</p>
        <div className="form-stack">
          <Input
            id="email"
            type="email"
            label="Email"
            autoComplete="email"
            error={errors.email}
            {...register("email")}
          />
          <Input
            id="password"
            type="password"
            label="Password"
            autoComplete="current-password"
            error={errors.password}
            {...register("password")}
          />
          {serverError && (
            <p className="error" role="alert">
              {serverError}
            </p>
          )}
          <button className="btn btn-primary" disabled={isSubmitting}>
            {isSubmitting ? "Signing in…" : "Sign in"}
          </button>
          <Link to="/forgot-password" style={{ color: "var(--copper-500)", fontSize: 13 }}>
            Forgot your password?
          </Link>
        </div>
        <p className="muted" style={{ fontSize: 13, marginTop: 20 }}>
          New to Currents?{" "}
          <Link to="/register" style={{ color: "var(--copper-500)" }}>
            Create an account
          </Link>
        </p>
        <p className="muted" style={{ fontSize: 12 }}>
          Demo: driver@currents.local / Test1234!
        </p>
      </form>
    </AuthFrame>
  );
}

export function ForgotPasswordPage() {
  const [message, setMessage] = useState("");
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting }
  } = useForm({ resolver: zodResolver(forgotPasswordSchema) });
  const submit = async (values) => {
    const { data } = await api.post("/auth/forgot-password", values);
    setMessage(
      data.data.developmentToken
        ? `Development reset link: ${window.location.origin}/reset-password?token=${data.data.developmentToken}`
        : "If that account exists, a reset link is on its way."
    );
  };
  return (
    <AuthFrame>
      <form className="auth-form" onSubmit={handleSubmit(submit)}>
        <h1>Reset access.</h1>
        <p className="muted">Enter the email used for your Currents account.</p>
        <div className="form-stack">
          <Input
            id="reset-email"
            type="email"
            label="Email"
            error={errors.email}
            {...register("email")}
          />
          <button className="btn btn-primary" disabled={isSubmitting}>
            Send reset link
          </button>
          {message && (
            <p className="muted" role="status" style={{ overflowWrap: "anywhere" }}>
              {message}
            </p>
          )}
          <Link to="/login" style={{ color: "var(--copper-500)" }}>
            Back to sign in
          </Link>
        </div>
      </form>
    </AuthFrame>
  );
}

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [message, setMessage] = useState("");
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting }
  } = useForm({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { token: params.get("token") || "", password: "" }
  });
  const submit = async (values) => {
    await api.post("/auth/reset-password", values);
    setMessage("Password updated. Taking you to sign in…");
    setTimeout(() => navigate("/login"), 900);
  };
  return (
    <AuthFrame>
      <form className="auth-form" onSubmit={handleSubmit(submit)}>
        <h1>Choose a new password.</h1>
        <div className="form-stack">
          <Input id="reset-token" label="Reset token" error={errors.token} {...register("token")} />
          <Input
            id="new-password"
            type="password"
            label="New password"
            autoComplete="new-password"
            error={errors.password}
            {...register("password")}
          />
          <button className="btn btn-primary" disabled={isSubmitting}>
            Update password
          </button>
          {message && <p role="status">{message}</p>}
        </div>
      </form>
    </AuthFrame>
  );
}
export function RegisterPage() {
  const set = useAuthStore((s) => s.setSession);
  const navigate = useNavigate();
  const [serverError, setServerError] = useState("");
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting }
  } = useForm({ resolver: zodResolver(registerSchema) });
  const submit = async (values) => {
    try {
      const { data } = await api.post("/auth/register", values);
      set(data.data);
      navigate("/app");
    } catch (e) {
      setServerError(e.response?.data?.error?.message || "Could not create account");
    }
  };
  return (
    <AuthFrame>
      <form className="auth-form" onSubmit={handleSubmit(submit)}>
        <h1>Start moving.</h1>
        <p className="muted">Your next charge should feel like a decision, not a search.</p>
        <div className="form-stack">
          <Input
            id="name"
            label="Full name"
            autoComplete="name"
            error={errors.fullName}
            {...register("fullName")}
          />
          <Input
            id="email"
            type="email"
            label="Email"
            autoComplete="email"
            error={errors.email}
            {...register("email")}
          />
          <Input
            id="phone"
            label="Phone (optional)"
            autoComplete="tel"
            error={errors.phone}
            {...register("phone")}
          />
          <Input
            id="password"
            type="password"
            label="Password"
            autoComplete="new-password"
            error={errors.password}
            {...register("password")}
          />
          {serverError && (
            <p className="error" role="alert">
              {serverError}
            </p>
          )}
          <button className="btn btn-primary" disabled={isSubmitting}>
            {isSubmitting ? "Creating account…" : "Create account"}
          </button>
        </div>
        <p className="muted" style={{ fontSize: 13, marginTop: 20 }}>
          Already have an account?{" "}
          <Link to="/login" style={{ color: "var(--copper-500)" }}>
            Sign in
          </Link>
        </p>
      </form>
    </AuthFrame>
  );
}
