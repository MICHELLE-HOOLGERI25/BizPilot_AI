import type { AgentRequest, AgentTask } from '../types/agent';
import {runMockTask,resolveMockApproval} from '../mocks/mockAgent';
// Switch this adapter to real FastAPI endpoints after Person 3 agrees the contracts.
export const agentApi = {
  submit: (request:AgentRequest,onUpdate:(task:AgentTask)=>void)=>runMockTask(request,onUpdate),
  approve: async(task:AgentTask)=>resolveMockApproval(task,true),
  cancel: async(task:AgentTask)=>resolveMockApproval(task,false),
};
