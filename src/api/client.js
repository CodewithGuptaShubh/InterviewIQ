// In development, Vite proxies /api to the backend (see vite.config.js). Set VITE_API_URL for deployed builds.
const BASE_URL = `${import.meta.env.VITE_API_URL || ""}/api`;
const TOKEN_KEY = "interviewiq_token";

export const tokenStore = {
  get: () => {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set: (token) => {
    try {
      if (token) localStorage.setItem(TOKEN_KEY, token);
      else localStorage.removeItem(TOKEN_KEY);
    } catch {
      // Storage unavailable (private mode); the session lasts until reload.
    }
  }
};

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

async function request(method, path, body) {
  const token = tokenStore.get();
  const isForm = body instanceof FormData;
  let response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(body && !isForm ? { "Content-Type": "application/json" } : {})
      },
      body: body ? (isForm ? body : JSON.stringify(body)) : undefined
    });
  } catch {
    throw new ApiError(0, "Cannot reach the InterviewIQ server. Is the backend running?");
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new ApiError(response.status, data.error || `Request failed (${response.status})`);
  return data;
}

export const api = {
  signup: (form) => request("POST", "/auth/signup", form),
  login: (form) => request("POST", "/auth/login", form),
  googleLogin: (credential) => request("POST", "/auth/google", { credential }),
  me: () => request("GET", "/auth/me"),
  updateMe: (updates) => request("PATCH", "/auth/me", updates),
  logout: () => request("POST", "/auth/logout"),

  uploadResume(file, targetRole) {
    const form = new FormData();
    form.append("resume", file);
    if (targetRole) form.append("targetRole", targetRole);
    return request("POST", "/resumes", form);
  },
  getProfile: () => request("GET", "/profiles/me"),
  updateProfile: (updates) => request("PATCH", "/profiles/me", updates),

  createInterview: (options = {}) => request("POST", "/interviews", options),
  activeInterview: () => request("GET", "/interviews/active"),
  listInterviews: () => request("GET", "/interviews"),
  submitAnswer: (id, answer, durationSeconds) => request("POST", `/interviews/${id}/turns`, { answer, durationSeconds }),
  submitCode: (id, language, code) => request("POST", `/interviews/${id}/coding-submission`, { language, code }),
  completeInterview: (id) => request("POST", `/interviews/${id}/complete`),
  cancelInterview: (id) => request("POST", `/interviews/${id}/cancel`),

  getReport: (interviewId) => request("GET", `/reports/${interviewId}`),
  getAnalytics: () => request("GET", "/reports/analytics/summary"),

  paymentConfig: () => request("GET", "/payments/config"),
  createOrder: (credits = 1) => request("POST", "/payments/create-order", { credits }),
  verifyPayment: (payload) => request("POST", "/payments/verify", payload),
  reportPaymentFailure: (orderId, reason) => request("POST", "/payments/failed", { orderId, reason }),
  paymentHistory: () => request("GET", "/payments/history"),

  health: () => request("GET", "/health"),
  transcribe(audioBlob) {
    const form = new FormData();
    form.append("audio", audioBlob, "answer.wav");
    return request("POST", "/speech/stt", form);
  },
  async speak(text) {
    const response = await fetch(`${BASE_URL}/speech/tts`, {
      method: "POST",
      headers: { Authorization: `Bearer ${tokenStore.get()}`, "Content-Type": "application/json" },
      body: JSON.stringify({ text })
    });
    if (!response.ok) throw new ApiError(response.status, "Text-to-speech failed");
    return response.blob();
  }
};
