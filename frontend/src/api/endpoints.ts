
export const API_ENDPOINTS = {
  // Person 2: Operational APIs
  products: {
    list: "/api/v1/products",
    create: "/api/v1/products",
    detail: (id: string) =>
      `/api/v1/products/${encodeURIComponent(id)}`,
    update: (id: string) =>
      `/api/v1/products/${encodeURIComponent(id)}`,
    deactivate: (id: string) =>
      `/api/v1/products/${encodeURIComponent(id)}/deactivate`,
    deletePreview: (id: string) =>
      `/api/v1/products/${encodeURIComponent(id)}/delete-preview`,
  },

  // Person 3: Agent APIs
  agent: {
    submit: "/api/v1/agent/tasks",
    task: (taskId: string) =>
      `/api/v1/agent/tasks/${encodeURIComponent(taskId)}`,
    approval: (taskId: string) =>
      `/api/v1/agent/tasks/${encodeURIComponent(taskId)}/approval`,
    cancel: (taskId: string) =>
      `/api/v1/agent/tasks/${encodeURIComponent(taskId)}/cancel`,
  },

  // Person 4: Dynamic reports
  reports: {
    list: "/api/v1/reports",
    generate: "/api/v1/reports/generate",
    detail: (id: string) =>
      `/api/v1/reports/${encodeURIComponent(id)}`,
  },
} as const;
