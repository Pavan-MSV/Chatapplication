let base = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api";

// Auto-append '/api' if not present in the environment variable
if (base && !base.endsWith("/api")) {
  base = base.replace(/\/$/, "") + "/api";
}

export const API_BASE = base;

export const getWsUrl = (token) => {
  const wsBase = API_BASE.replace(/\/api$/, "").replace(/^http/, "ws");
  return `${wsBase}/ws?token=${token}`;
};
