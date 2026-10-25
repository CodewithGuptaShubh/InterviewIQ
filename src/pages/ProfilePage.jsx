import { LogOut, Save } from "lucide-react";
import { useState } from "react";
import { Badge } from "../components/ui/Badge.jsx";
import { Button } from "../components/ui/Button.jsx";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/Card.jsx";
import { Input } from "../components/ui/Input.jsx";
import { useApp } from "../state/AppContext.jsx";

const PREFERENCES = ["Voice-first interviews", "Intermediate difficulty", "Include coding round", "Behavioral follow-ups", "Detailed reports", "Weekly reminders"];

export function ProfilePage() {
  const { user, profile, updateAccount, updateProfile, logout } = useApp();
  const [form, setForm] = useState({ name: user.name, email: user.email, title: user.title, targetRole: profile?.targetRole || "" });
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);

  async function saveProfile(event) {
    event.preventDefault();
    setSaving(true);
    setStatus("");
    try {
      await updateAccount({ name: form.name, email: form.email, title: form.title });
      if (profile && form.targetRole && form.targetRole !== profile.targetRole) await updateProfile({ targetRole: form.targetRole });
      setStatus("Saved");
      setTimeout(() => setStatus(""), 1800);
    } catch (err) {
      setStatus(err.message);
    } finally {
      setSaving(false);
    }
  }

  function togglePreference(item) {
    const next = user.preferences.includes(item) ? user.preferences.filter((p) => p !== item) : [...user.preferences, item];
    updateAccount({ preferences: next }).catch(() => {});
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
      <Card>
        <CardContent className="p-6 text-center">
          <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-2xl bg-primary text-3xl font-bold text-primary-foreground">{user.avatar}</div>
          <h2 className="mt-4 text-2xl font-semibold">{user.name}</h2>
          <p className="text-muted-foreground">{user.title || "Add your current title"}</p>
          <div className="mt-5 flex justify-center gap-2">
            <Badge tone="info">{user.plan}</Badge>
            <Badge tone="success">{user.credits} credit{user.credits === 1 ? "" : "s"}</Badge>
          </div>
          <Button variant="outline" className="mt-6" onClick={logout}><LogOut className="h-4 w-4" /> Sign out</Button>
        </CardContent>
      </Card>

      <div className="space-y-6">
        <Card>
          <CardHeader><CardTitle>Account settings</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={saveProfile} className="grid gap-4 md:grid-cols-2">
              <Field label="Full name"><Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></Field>
              <Field label="Email"><Input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></Field>
              <Field label="Current title"><Input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></Field>
              <Field label="Target role"><Input disabled={!profile} placeholder={profile ? "" : "Upload a resume first"} value={form.targetRole} onChange={(event) => setForm({ ...form, targetRole: event.target.value })} /></Field>
              <div className="md:col-span-2">
                <Button type="submit" disabled={saving}><Save className="h-4 w-4" /> {saving ? "Saving..." : "Save changes"}</Button>
                {status && <span className={status === "Saved" ? "ml-3 text-sm text-emerald-300" : "ml-3 text-sm text-red-300"}>{status}</span>}
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Interview preferences</CardTitle></CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-3">
            {PREFERENCES.map((item) => (
              <label key={item} className="flex items-center gap-3 rounded-md border bg-background/50 p-3 text-sm">
                <input type="checkbox" checked={user.preferences.includes(item)} onChange={() => togglePreference(item)} className="h-4 w-4 accent-cyan-400" />
                {item}
              </label>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return <label className="space-y-2 text-sm font-medium"><span>{label}</span>{children}</label>;
}
