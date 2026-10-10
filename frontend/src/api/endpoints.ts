
export const API_ENDPOINTS = {
  inventory: {
    list: "/api/v1/inventory",
  },

  replenishment: {
    recommendations: "/api/v1/replenishment/recommendations",
  },

  suppliers: {
    list: "/api/v1/suppliers",
    create: "/api/v1/suppliers",
    detail: (id: string | number) =>
      `/api/v1/suppliers/${encodeURIComponent(String(id))}`,
    update: (id: string | number) =>
      `/api/v1/suppliers/${encodeURIComponent(String(id))}`,
    delete: (id: string | number) =>
      `/api/v1/suppliers/${encodeURIComponent(String(id))}`,
  },

  purchaseOrders: {
    list: "/api/v1/purchase-orders",
    create: "/api/v1/purchase-orders",
    detail: (id: string | number) =>
      `/api/v1/purchase-orders/${encodeURIComponent(String(id))}`,
    confirmations: "/api/v1/purchase-orders/confirmations",
  },

  products: {
    list: "/api/v1/products",
    create: "/api/v1/products",
    detail: (id: string) =>
      `/api/v1/products/${encodeURIComponent(id)}`,
    update: (id: string) =>
      `/api/v1/products/${encodeURIComponent(id)}`,
    deactivate: (id: string) =>
      `/api/v1/products/${encodeURIComponent(id)}/deactivate`,
    delete: (sku: string) =>
      `/api/v1/products/${encodeURIComponent(sku)}`,
    deletePreview: (id: string) =>
      `/api/v1/products/${encodeURIComponent(id)}/delete-preview`,
  },

  agent: {
    submit: "/api/v1/agent/tasks",
    task: (taskId: string) =>
      `/api/v1/agent/tasks/${encodeURIComponent(taskId)}`,
    approval: (taskId: string) =>
      `/api/v1/agent/tasks/${encodeURIComponent(taskId)}/approval`,
    cancel: (taskId: string) =>
      `/api/v1/agent/tasks/${encodeURIComponent(taskId)}/cancel`,
  },

  reports: {
    list: "/api/v1/reports",
    generate: "/api/v1/reports/generate",
    detail: (id: string) =>
      `/api/v1/reports/${encodeURIComponent(id)}`,
  },
} as const;
