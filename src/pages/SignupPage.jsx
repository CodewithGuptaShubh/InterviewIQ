import { Link, useNavigate } from "react-router-dom";
import { useCallback, useState } from "react";
import { GoogleButton } from "../components/auth/GoogleButton.jsx";
import { Button } from "../components/ui/Button.jsx";
import { Input } from "../components/ui/Input.jsx";
import { useApp } from "../state/AppContext.jsx";
import { AuthFrame, FormError } from "./LoginPage.jsx";

export function SignupPage() {
  const { signup, googleLogin } = useApp();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      await signup(form);
      navigate("/resume");
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
        navigate("/resume");
      } catch (err) {
        setError(err.message);
      }
    },
    [googleLogin, navigate]
  );

  return (
    <AuthFrame eyebrow="Start free" title="Build interview confidence with feedback that remembers your progress.">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Full name" />
        <Input required value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} type="email" placeholder="Email" />
        <Input required minLength={8} value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} type="password" placeholder="Password (min 8 characters)" />
        {error && <FormError message={error} />}
        <Button className="w-full" size="lg" disabled={loading}>{loading ? "Creating account..." : "Create account"}</Button>
        <GoogleButton onCredential={handleGoogle} onError={setError} />
      </form>
      <p className="mt-5 text-center text-sm text-muted-foreground">
        Already have an account? <Link className="font-medium text-accent-foreground" to="/login">Sign in</Link>
      </p>
    </AuthFrame>
  );
}
