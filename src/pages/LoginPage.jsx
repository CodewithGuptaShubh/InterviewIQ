import { Link, useNavigate } from "react-router-dom";
import { BrainCircuit } from "lucide-react";
import { useCallback, useState } from "react";
import { GoogleButton } from "../components/auth/GoogleButton.jsx";
import { Button } from "../components/ui/Button.jsx";
import { Card, CardContent } from "../components/ui/Card.jsx";
import { Input } from "../components/ui/Input.jsx";
import { useApp } from "../state/AppContext.jsx";

export function LoginPage() {
  const { login, googleLogin } = useApp();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      await login(form);
      navigate("/");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const handleGoogle = useCallback(
    async (credential) => {
      setError("");
      try {
        await googleLogin(credential);
        navigate("/");
      } catch (err) {
        setError(err.message);
      }
    },
    [googleLogin, navigate]
  );

  return (
    <AuthFrame eyebrow="Welcome back" title="Practice like the interview is already on the calendar.">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input required value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} type="email" placeholder="Email" />
        <Input required value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} type="password" placeholder="Password" />
        {error && <FormError message={error} />}
        <Button className="w-full" size="lg" disabled={loading}>{loading ? "Signing in..." : "Sign in"}</Button>
        <GoogleButton onCredential={handleGoogle} onError={setError} />
      </form>
      <p className="mt-5 text-center text-sm text-muted-foreground">
        New to InterviewIQ? <Link className="font-medium text-accent-foreground" to="/signup">Create an account</Link>
      </p>
    </AuthFrame>
  );
}

export function FormError({ message }) {
  return <p className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">{message}</p>;
}

export function AuthFrame({ children, eyebrow, title }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_0.9fr]">
      <section className="flex min-h-screen items-center px-6 py-10 md:px-12">
        <div className="mx-auto w-full max-w-lg">
          <div className="mb-10 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <BrainCircuit className="h-5 w-5" />
            </div>
            <div>
              <p className="font-semibold">InterviewIQ</p>
              <p className="text-xs text-muted-foreground">AI-powered mock interviews</p>
            </div>
          </div>
          <p className="text-sm font-medium text-accent-foreground">{eyebrow}</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-normal md:text-5xl">{title}</h1>
          <Card className="mt-8">
            <CardContent>{children}</CardContent>
          </Card>
        </div>
      </section>
      <section className="hidden border-l bg-card/40 p-10 lg:flex lg:items-end">
        <div className="w-full rounded-lg border bg-background/70 p-6 shadow-soft">
          <div className="grid grid-cols-3 gap-3">
            {["Resume intelligence", "Adaptive follow-ups", "Readiness roadmap"].map((item) => (
              <div key={item} className="rounded-md border bg-card p-4 text-sm font-medium">{item}</div>
            ))}
          </div>
          <div className="mt-8 h-44 rounded-lg border bg-[linear-gradient(135deg,rgba(34,211,238,.22),rgba(16,185,129,.14))] p-6">
            <p className="text-sm text-muted-foreground">Current readiness</p>
            <p className="mt-3 text-6xl font-semibold">82</p>
            <p className="mt-2 text-sm text-emerald-300">+21 points across five practice rounds</p>
          </div>
        </div>
      </section>
    </div>
  );
}
