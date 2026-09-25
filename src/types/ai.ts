import { ResourceType } from './curriculum';

export type AIProvider = 'gemini' | 'openai' | 'anthropic' | 'groq' | 'openrouter';
export type SearchProvider = 'tavily' | 'youtube' | 'github';

export interface AIModelOption {
  id: string;
  name: string;
  provider: AIProvider;
  description: string;
  contextWindow?: string;
  isRecommended?: boolean;
}

export const SUPPORTED_MODELS: Record<AIProvider, AIModelOption[]> = {
  gemini: [
    {
      id: 'gemini-2.5-flash',
      name: 'Gemini 2.5 Flash',
      provider: 'gemini',
      description: 'Ultra-fast, high-accuracy reasoning and structured course curation.',
      contextWindow: '1M tokens',
      isRecommended: true
    },
    {
      id: 'gemini-3.6-flash',
      name: 'Gemini 3.6 Flash',
      provider: 'gemini',
      description: 'Next-generation Gemini Flash with advanced curriculum capabilities.',
      contextWindow: '1M tokens'
    },
    {
      id: 'gemini-3.5-flash',
      name: 'Gemini 3.5 Flash',
      provider: 'gemini',
      description: 'High-speed balanced model for rapid outline generation.',
      contextWindow: '1M tokens'
    },
    {
      id: 'gemini-3.5-flash-lite',
      name: 'Gemini 3.5 Flash Lite',
      provider: 'gemini',
      description: 'Lightweight model with rapid response times for micro-tasks.',
      contextWindow: '1M tokens'
    }
  ],
  groq: [
    {
      id: 'llama-3.3-70b-versatile',
      name: 'Llama 3.3 70B Versatile',
      provider: 'groq',
      description: 'Ultra-fast open-weight reasoning hosted on Groq LPUs.',
      contextWindow: '128K tokens',
      isRecommended: true
    },
    {
      id: 'llama-3.1-8b-instant',
      name: 'Llama 3.1 8B Instant',
      provider: 'groq',
      description: 'Extremely high tokens/sec generation for rapid blueprints.',
      contextWindow: '128K tokens'
    }
  ],
  openai: [
    {
      id: 'gpt-4o',
      name: 'GPT-4o',
      provider: 'openai',
      description: 'Flagship OpenAI model with strong curriculum structuring capabilities.',
      contextWindow: '128K tokens',
      isRecommended: true
    },
    {
      id: 'gpt-4o-mini',
      name: 'GPT-4o mini',
      provider: 'openai',
      description: 'Fast, cost-effective model suitable for straightforward courses.',
      contextWindow: '128K tokens'
    }
  ],
  anthropic: [
    {
      id: 'claude-3-7-sonnet-latest',
      name: 'Claude 3.7 Sonnet',
      provider: 'anthropic',
      description: 'State-of-the-art hybrid reasoning for detailed pedagogical design.',
      contextWindow: '200K tokens',
      isRecommended: true
    },
    {
      id: 'claude-3-5-haiku-20241022',
      name: 'Claude 3.5 Haiku',
      provider: 'anthropic',
      description: 'Fast, lightweight Claude model for quick outlines.',
      contextWindow: '200K tokens'
    }
  ],
  openrouter: [
    {
      id: 'meta-llama/llama-3.3-70b-instruct',
      name: 'Llama 3.3 70B (OpenRouter)',
      provider: 'openrouter',
      description: 'High performance Meta Llama hosted via OpenRouter.',
      contextWindow: '128K tokens',
      isRecommended: true
    },
    {
      id: 'deepseek/deepseek-chat',
      name: 'DeepSeek V3 (OpenRouter)',
      provider: 'openrouter',
      description: 'Exceptional open-architecture model at great token economics.',
      contextWindow: '64K tokens'
    },
    {
      id: 'google/gemini-2.0-flash-001',
      name: 'Gemini 2.0 Flash (OpenRouter)',
      provider: 'openrouter',
      description: 'Gemini 2.0 Flash routed through OpenRouter credentials.',
      contextWindow: '1M tokens'
    }
  ]
};

export interface AIKeyConfig {
  gemini?: string;
  openai?: string;
  anthropic?: string;
  groq?: string;
  openrouter?: string;
  tavily?: string;
  youtube?: string;
  github?: string;
}

export type ConnectionStatusState = 'idle' | 'testing' | 'connected' | 'error';

export interface ConnectionStatus {
  status: ConnectionStatusState;
  latencyMs?: number;
  errorMsg?: string;
  checkedAt?: string;
  recognizedModel?: string;
  recognizedModels?: AIModelOption[];
}

export interface CurateCourseRequest {
  topicPrompt: string;
  level: 'beginner' | 'intermediate' | 'advanced';
  focus: 'comprehensive' | 'project-first' | 'fast-track' | 'interview-prep';
  durationWeeks?: number;
  hoursPerWeek?: number;
  prerequisites?: string;
  targetOutcomes?: string;
  customInstructions?: string;
  provider?: AIProvider;
  model?: string;
  enableWebSearch?: boolean;
}

export interface CuratedResource {
  title: string;
  url: string;
  type: ResourceType | 'video' | 'pdf' | 'textbook' | 'article' | 'link' | 'documentation';
  role: 'PRIMARY' | 'REFERENCE' | 'PRACTICE';
  description?: string;
}

export interface CuratedTopic {
  name: string;
  description: string;
  estimatedHours: number;
  difficulty: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
  learningObjectives: string[];
  skills: string[];
  resources: CuratedResource[];
}

export interface CuratedModule {
  name: string;
  description: string;
  order: number;
  topics: CuratedTopic[];
}

export interface CuratedCourseResponse {
  title: string;
  code?: string;
  description: string;
  color: string;
  icon: string;
  level: 'beginner' | 'intermediate' | 'advanced';
  estimatedHours: number;
  prerequisites: string[];
  learningOutcomes: string[];
  modules: CuratedModule[];
}
