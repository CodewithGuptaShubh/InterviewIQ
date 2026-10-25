import { Outlet, NavLink, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { BarChart3, BrainCircuit, CreditCard, FileText, LayoutDashboard, LogOut, Menu, Moon, Sun, User, Video } from "lucide-react";
import { useState } from "react";
import { Button } from "../ui/Button.jsx";
import { useApp } from "../../state/AppContext.jsx";
import { cn } from "../../lib/utils.js";

const navItems = [
  { label: "Dashboard", to: "/", icon: LayoutDashboard },
  { label: "Resume", to: "/resume", icon: FileText },
  { label: "Interview", to: "/interview", icon: Video },
  { label: "Analytics", to: "/analytics", icon: BarChart3 },
  { label: "Pricing", to: "/pricing", icon: CreditCard },
  { label: "Profile", to: "/profile", icon: User }
];

export function AppShell() {
  const { user, theme, toggleTheme, logout } = useApp();
  const [open, setOpen] = useState(false);
  const location = useLocation();

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[264px_1fr]">
      <aside className="hidden border-r bg-background/70 px-4 py-5 backdrop-blur lg:block">
        <Sidebar />
      </aside>

      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-40 bg-black/60 lg:hidden" onClick={() => setOpen(false)}>
            <motion.aside
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              className="h-full w-72 border-r bg-background p-4"
              onClick={(event) => event.stopPropagation()}
            >
              <Sidebar onNavigate={() => setOpen(false)} />
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="min-w-0">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-background/80 px-4 backdrop-blur md:px-6">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" className="w-9 px-0 lg:hidden" onClick={() => setOpen(true)} aria-label="Open navigation">
              <Menu className="h-5 w-5" />
            </Button>
            <div>
              <p className="text-sm text-muted-foreground">InterviewIQ</p>
              <h1 className="text-base font-semibold md:text-lg">{pageTitle(location.pathname)}</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden rounded-md border bg-card px-3 py-2 text-sm text-muted-foreground sm:block">
              {/* Show both balances: showing only one made a purchase look like "1 left" → "1 left". */}
              {user.credits} credit{user.credits === 1 ? "" : "s"} · {Math.max(0, 2 - user.freeInterviewsUsed)} free left
            </div>
            <Button variant="ghost" size="sm" className="w-9 px-0" onClick={toggleTheme} aria-label="Toggle theme">
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <NavLink to="/profile" className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-sm font-bold text-primary-foreground" aria-label="Profile">{user.avatar}</NavLink>
            <Button variant="ghost" size="sm" className="w-9 px-0" onClick={logout} aria-label="Sign out">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </header>
        <div className="mx-auto w-full max-w-7xl px-4 py-6 md:px-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

function Sidebar({ onNavigate }) {
  const { analytics } = useApp();
  return (
    <div className="flex h-full flex-col">
      <div className="mb-8 flex items-center gap-3 px-2">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <BrainCircuit className="h-5 w-5" />
        </div>
        <div>
          <p className="font-semibold">InterviewIQ</p>
          <p className="text-xs text-muted-foreground">Mock interviews, sharpened</p>
        </div>
      </div>
      <nav className="space-y-1">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/"}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                "flex h-11 items-center gap-3 rounded-md px-3 text-sm font-medium transition",
                isActive ? "bg-primary text-primary-foreground shadow-glow" : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )
            }
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </NavLink>
        ))}
      </nav>
      <div className="mt-auto rounded-lg border bg-card/60 p-4">
        <p className="text-sm font-semibold">Next best action</p>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">{analytics?.nextBestAction || "Upload your resume to get started."}</p>
      </div>
    </div>
  );
}

function pageTitle(pathname) {
  if (pathname.startsWith("/resume")) return "Resume Analysis";
  if (pathname.startsWith("/interview")) return "Live Mock Interview";
  if (pathname.startsWith("/analytics")) return "Analytics";
  if (pathname.startsWith("/pricing")) return "Pricing";
  if (pathname.startsWith("/profile")) return "Profile";
  if (pathname.startsWith("/reports")) return "Interview Report";
  return "Dashboard";
}
