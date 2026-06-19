export const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api";

export const getWsUrl = (token) => {
  const wsBase = API_BASE.replace(/\/api$/, "").replace(/^http/, "ws");
  return `${wsBase}/ws?token=${token}`;
};
