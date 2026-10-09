
import type {
  AgentRequest,
  AgentTask,
  ApprovalRequest,
  NavigationInstruction,
} from "./agent";

import type {
  Product,
  ProductInput,
} from "./product";

import type { DynamicView } from "./dynamicView";

// Common response structures
export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  request_id?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}

// Person 2: Product management
export type CreateProductRequest = ProductInput;
export type UpdateProductRequest = ProductInput;
export type ProductResponse = Product;
export type ProductListResponse = PaginatedResponse<Product>;

export interface ProductDeletePreview {
  product_id: string;
  sku: string;
  name: string;
  can_delete: boolean;
  blockers: string[];
}

// Person 3: Agent execution
export type SubmitAgentRequest = AgentRequest;
export type SubmitAgentResponse = AgentTask;
export type AgentTaskResponse = AgentTask;

export interface ApprovalDecisionRequest {
  approval_id: string;
  decision: "approve" | "reject";
}

export interface ApprovalDecisionResponse {
  task: AgentTask;
}

// Person 4: Dynamic reports
export interface GenerateReportRequest {
  prompt: string;
  current_route?: string;
}

export interface GenerateReportResponse {
  view: DynamicView;
}

export interface ReportListResponse {
  items: DynamicView[];
}

// Shared navigation
export type SafeNavigationRequest = NavigationInstruction;

// Shared approvals
export type PendingApproval = ApprovalRequest;
