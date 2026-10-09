
export type TaskStatus =
  | "pending"
  | "running"
  | "awaiting_approval"
  | "completed"
  | "failed"
  | "cancelled"
  | "partial";

export type StepStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "blocked";

export interface PlanStep {
  step_id: string;
  description: string;
  status: StepStatus;
  tool_id?: string;
  safe_result_summary?: string;
  error_code?: string;
  duration_ms?: number;
}

export interface ToolExecution {
  execution_id: string;
  tool_id: string;
  label?: string;
  status: StepStatus;
  safe_result_summary?: string;
  duration_ms?: number;
  error_code?: string;
  error_message?: string;
  started_at?: string;
  completed_at?: string;
}

export interface EvidenceItem {
  label: string;
  value: string;
  record_id?: string;
  timestamp?: string;
  source?: string;
}

export interface NavigationInstruction {
  route: string;
  filters?: Record<string, string>;
}

export interface ApprovalRequest {
  approval_id: string;
  operation: string;
  target_summary: string;
  impact_summary: string;
  expires_at: string;
  status: "pending" | "approved" | "cancelled" | "expired";
}

export interface AgentResult {
  status: TaskStatus;
  summary: string;
  findings: string[];
  evidence: EvidenceItem[];
  navigation_instruction?: NavigationInstruction;
  partial_failures: string[];
}

export interface AgentRequest {
  message: string;
  active_task_id?: string;
  current_route: string;
  current_filters: Record<string, string>;
  selected_record_id?: string;
  client_request_id: string;
}

export interface AgentTask {
  task_id: string;
  status: TaskStatus;
  created_at: string;
  updated_at: string;
  plan: PlanStep[];
  result?: AgentResult;
  error?: string;
  pending_approval?: ApprovalRequest;
  evidence: EvidenceItem[];
  tool_executions?: ToolExecution[];
}

export interface ConversationMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  created_at: string;
  task_id?: string;
}
