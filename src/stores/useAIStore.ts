import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { AIProvider, AIKeyConfig, ConnectionStatus, SUPPORTED_MODELS, AIModelOption } from '@/types/ai';
import { testConnection as runTestConnection, discoverGeminiModels, normalizeGeminiModel } from '@/lib/ai/client';

interface AIStoreState {
  keys: AIKeyConfig;
  activeProvider: AIProvider;
  activeModel: string;
  recognizedModels: Record<string, AIModelOption[]>;
  connectionStatuses: Record<string, ConnectionStatus>;
  
  // Actions
  setKey: (keyName: keyof AIKeyConfig | string, value: string) => void;
  removeKey: (keyName: keyof AIKeyConfig | string) => void;
  setActiveProvider: (provider: AIProvider) => void;
  setActiveModel: (model: string) => void;
  setRecognizedModels: (provider: string, models: AIModelOption[]) => void;
  autoDiscoverModels: (provider: AIProvider) => Promise<AIModelOption[]>;
  testConnection: (providerOrTool: AIProvider | 'tavily' | 'youtube' | 'github') => Promise<boolean>;
  hasKey: (providerOrTool: string) => boolean;
  getActiveKey: () => string | undefined;
  clearAllKeys: () => void;
}

export const useAIStore = create<AIStoreState>()(
  persist(
    (set, get) => ({
      keys: {},
      activeProvider: 'gemini',
      activeModel: 'gemini-2.5-flash',
      recognizedModels: {},
      connectionStatuses: {},

      setKey: (keyName, value) => {
        const trimmed = value.trim();
        set((state) => ({
          keys: {
            ...state.keys,
            [keyName]: trimmed
          },
          // Reset connection status on key change
          connectionStatuses: {
            ...state.connectionStatuses,
            [keyName]: { status: 'idle' }
          }
        }));

        // Proactively auto-discover recognized models in background when a Gemini key is entered
        if (keyName === 'gemini' && trimmed.length >= 20) {
          get().autoDiscoverModels('gemini').catch(() => {});
        }
      },

      removeKey: (keyName) => {
        set((state) => {
          const updatedKeys = { ...state.keys };
          delete (updatedKeys as any)[keyName];

          const updatedStatuses = { ...state.connectionStatuses };
          delete updatedStatuses[keyName];

          const updatedRecognized = { ...state.recognizedModels };
          delete updatedRecognized[keyName];

          return {
            keys: updatedKeys,
            connectionStatuses: updatedStatuses,
            recognizedModels: updatedRecognized
          };
        });
      },

      setActiveProvider: (provider) => {
        // If we have recognized models for this provider, use the first one; otherwise use catalog
        const recognized = get().recognizedModels[provider];
        const defaultModel = (recognized && recognized.length > 0)
          ? (recognized.find(m => m.isRecommended)?.id || recognized[0].id)
          : (SUPPORTED_MODELS[provider]?.[0]?.id || 'gemini-2.5-flash');

        set({
          activeProvider: provider,
          activeModel: defaultModel
        });
      },

      setActiveModel: (model) => {
        const normalized = get().activeProvider === 'gemini' ? normalizeGeminiModel(model) : model;
        set({ activeModel: normalized });
      },

      setRecognizedModels: (provider, models) => {
        set((state) => ({
          recognizedModels: {
            ...state.recognizedModels,
            [provider]: models
          }
        }));
      },

      autoDiscoverModels: async (provider) => {
        const key = (get().keys as any)[provider];
        if (!key || provider !== 'gemini') return [];

        try {
          const discovered = await discoverGeminiModels(key);
          if (discovered.length > 0) {
            set((state) => ({
              recognizedModels: {
                ...state.recognizedModels,
                gemini: discovered
              }
            }));

            // If current model is deprecated or not in discovered models, auto-switch to recommended
            const current = get().activeModel;
            const currentValid = discovered.some((m) => m.id === current);
            if (!currentValid || current.includes('1.5') || current.includes('2.0') || current === 'gemini-2.5-pro') {
              const recommended = discovered.find((m) => m.isRecommended)?.id || discovered[0].id;
              set({ activeModel: recommended });
            }
          }
          return discovered;
        } catch {
          return [];
        }
      },

      testConnection: async (providerOrTool) => {
        const key = (get().keys as any)[providerOrTool];
        if (!key) {
          set((state) => ({
            connectionStatuses: {
              ...state.connectionStatuses,
              [providerOrTool]: {
                status: 'error',
                errorMsg: 'No API key provided'
              }
            }
          }));
          return false;
        }

        set((state) => ({
          connectionStatuses: {
            ...state.connectionStatuses,
            [providerOrTool]: { status: 'testing' }
          }
        }));

        const modelToTest = providerOrTool === get().activeProvider ? get().activeModel : undefined;
        const result = await runTestConnection(providerOrTool, key, modelToTest);

        // Auto-update activeModel and recognizedModels if discovery succeeded
        if (result.ok) {
          if (result.recognizedModel && (providerOrTool === get().activeProvider || get().activeModel.includes('1.5') || get().activeModel.includes('2.0'))) {
            set({ activeModel: result.recognizedModel });
          }
          if (result.recognizedModels && result.recognizedModels.length > 0) {
            set((state) => ({
              recognizedModels: {
                ...state.recognizedModels,
                [providerOrTool]: result.recognizedModels!
              }
            }));
          }
        }

        set((state) => ({
          connectionStatuses: {
            ...state.connectionStatuses,
            [providerOrTool]: {
              status: result.ok ? 'connected' : 'error',
              latencyMs: result.latencyMs,
              errorMsg: result.error,
              recognizedModel: result.recognizedModel,
              recognizedModels: result.recognizedModels,
              checkedAt: new Date().toLocaleTimeString()
            }
          }
        }));

        return result.ok;
      },

      hasKey: (providerOrTool) => {
        const key = (get().keys as any)[providerOrTool];
        return Boolean(key && key.trim().length > 0);
      },

      getActiveKey: () => {
        const activeProvider = get().activeProvider;
        return (get().keys as any)[activeProvider];
      },

      clearAllKeys: () => {
        set({
          keys: {},
          connectionStatuses: {},
          recognizedModels: {}
        });
      }
    }),
    {
      name: 'degreetrack_ai_byok_config',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        keys: state.keys,
        activeProvider: state.activeProvider,
        activeModel: state.activeModel,
        recognizedModels: state.recognizedModels
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          // Upgrade any legacy deprecated models on restore
          if (
            !state.activeModel ||
            state.activeModel.includes('1.5') ||
            state.activeModel.includes('2.0') ||
            state.activeModel === 'gemini-2.5-pro'
          ) {
            state.activeModel = 'gemini-2.5-flash';
          }
        }
      }
    }
  )
);

// Global event listener for dynamic AI fallback notifications
if (typeof window !== 'undefined') {
  window.addEventListener('degreetrack:ai:model-fallback', (e: any) => {
    const detail = e.detail;
    if (detail?.model) {
      useAIStore.getState().setActiveModel(detail.model);
    }
  });
}
