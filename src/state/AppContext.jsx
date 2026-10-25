import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api, tokenStore } from "../api/client.js";

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(Boolean(tokenStore.get()));
  const [theme, setTheme] = useState("dark");
  const [profile, setProfile] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [history, setHistory] = useState([]);

  const refreshData = useCallback(async () => {
    const [profileRes, analyticsRes, historyRes] = await Promise.all([api.getProfile(), api.getAnalytics(), api.listInterviews()]);
    setProfile(profileRes.profile);
    setAnalytics(analyticsRes);
    setHistory(historyRes.interviews.filter((item) => item.hasReport));
  }, []);

  const refreshUser = useCallback(async () => {
    const { user: nextUser } = await api.me();
    setUser(nextUser);
    return nextUser;
  }, []);

  // Restore the session from a stored token on first load.
  useEffect(() => {
    if (!tokenStore.get()) return;
    refreshUser()
      .then(refreshData)
      .catch(() => tokenStore.set(null))
      .finally(() => setAuthLoading(false));
  }, [refreshUser, refreshData]);

  async function startSession({ token, user: nextUser }) {
    tokenStore.set(token);
    setUser(nextUser);
    await refreshData().catch(() => {});
    return nextUser;
  }

  const login = (form) => api.login(form).then(startSession);
  const signup = (form) => api.signup(form).then(startSession);
  const googleLogin = (credential) => api.googleLogin(credential).then(startSession);

  function logout() {
    api.logout().catch(() => {});
    tokenStore.set(null);
    setUser(null);
    setProfile(null);
    setAnalytics(null);
    setHistory([]);
  }

  async function analyzeResume(file) {
    const result = await api.uploadResume(file);
    setProfile(result.profile);
    refreshData().catch(() => {});
    return result;
  }

  async function updateAccount(updates) {
    const { user: nextUser } = await api.updateMe(updates);
    setUser(nextUser);
    return nextUser;
  }

  async function updateProfile(updates) {
    const { profile: nextProfile } = await api.updateProfile(updates);
    setProfile(nextProfile);
    return nextProfile;
  }

  function toggleTheme() {
    setTheme((current) => (current === "dark" ? "light" : "dark"));
  }

  const value = useMemo(
    () => ({
      user,
      setUser,
      authLoading,
      login,
      signup,
      googleLogin,
      logout,
      refreshUser,
      refreshData,
      theme,
      toggleTheme,
      profile,
      analyzeResume,
      updateAccount,
      updateProfile,
      analytics,
      history
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user, authLoading, theme, profile, analytics, history]
  );

  return (
    <AppContext.Provider value={value}>
      <div className={theme === "light" ? "light min-h-screen" : "min-h-screen"}>{children}</div>
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error("useApp must be used within AppProvider");
  return context;
}
