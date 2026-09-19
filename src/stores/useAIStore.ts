import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { AIProvider, AIKeyConfig, ConnectionStatus, SUPPORTED_MODELS } from '@/types/ai';
import { testConnection as runTestConnection } from '@/lib/ai/client';

interface AIStoreState {
  keys: AIKeyConfig;
  activeProvider: AIProvider;
  activeModel: string;
  connectionStatuses: Record<string, ConnectionStatus>;
  
  // Actions
  setKey: (keyName: keyof AIKeyConfig | string, value: string) => void;
  removeKey: (keyName: keyof AIKeyConfig | string) => void;
  setActiveProvider: (provider: AIProvider) => void;
  setActiveModel: (model: string) => void;
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
      activeModel: 'gemini-2.0-flash',
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
      },

      removeKey: (keyName) => {
        set((state) => {
          const updatedKeys = { ...state.keys };
          delete (updatedKeys as any)[keyName];

          const updatedStatuses = { ...state.connectionStatuses };
          delete updatedStatuses[keyName];

          return {
            keys: updatedKeys,
            connectionStatuses: updatedStatuses
          };
        });
      },

      setActiveProvider: (provider) => {
        const defaultModel = SUPPORTED_MODELS[provider]?.[0]?.id || '';
        set({
          activeProvider: provider,
          activeModel: defaultModel
        });
      },

      setActiveModel: (model) => {
        set({ activeModel: model });
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

        set((state) => ({
          connectionStatuses: {
            ...state.connectionStatuses,
            [providerOrTool]: {
              status: result.ok ? 'connected' : 'error',
              latencyMs: result.latencyMs,
              errorMsg: result.error,
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
          connectionStatuses: {}
        });
      }
    }),
    {
      name: 'degreetrack_ai_byok_config',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        keys: state.keys,
        activeProvider: state.activeProvider,
        activeModel: state.activeModel
      })
    }
  )
);
