import axios from "axios";

export const apiClient = axios.create({
  baseURL: "",
  headers: {
    "Content-Type": "application/json",
  },
});

if (import.meta.env.DEV) {
  apiClient.defaults.headers.common["X-Demo-Actor-Id"] =
    "local-demo-user";

  apiClient.defaults.headers.common["X-Demo-Tenant-Id"] = "demo";

  apiClient.defaults.headers.common["X-Demo-Role"] = "admin";
}