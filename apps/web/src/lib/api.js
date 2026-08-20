import axios from "axios";
import { useAuthStore } from "../stores/auth.js";
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:4000/api",
  withCredentials: true
});
let refreshPromise;
api.interceptors.request.use((request) => {
  const token = useAuthStore.getState().accessToken;
  if (token) request.headers.Authorization = `Bearer ${token}`;
  return request;
});
api.interceptors.response.use(
  (r) => r,
  async (error) => {
    const request = error.config;
    if (
      error.response?.status !== 401 ||
      request?._retried ||
      request?.url?.includes("/auth/refresh")
    )
      throw error;
    request._retried = true;
    refreshPromise ||= api
      .post("/auth/refresh")
      .then(({ data }) => {
        useAuthStore.getState().setSession(data.data);
        return data.data.accessToken;
      })
      .finally(() => {
        refreshPromise = null;
      });
    try {
      const token = await refreshPromise;
      request.headers.Authorization = `Bearer ${token}`;
      return api(request);
    } catch (refreshError) {
      useAuthStore.getState().clear();
      throw refreshError;
    }
  }
);
export const dataOf = (promise) => promise.then((response) => response.data.data);
