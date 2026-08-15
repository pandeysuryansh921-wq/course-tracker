'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useCurriculumStore } from '@/stores/useCurriculumStore';
import { useSidebarStore } from '@/stores/useSidebarStore';
import { useUserStore } from '@/stores/useUserStore';
import { App } from '@capacitor/app';

export function AppInitializer() {
  const initCurriculum = useCurriculumStore((state) => state.initialize);
  const initUser = useUserStore((state) => state.initialize);
  const router = useRouter();

  useEffect(() => {
    if (typeof initCurriculum === 'function') initCurriculum();
    if (typeof initUser === 'function') initUser();
  }, [initCurriculum, initUser]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    let backPressCount = 0;
    
    const backButtonListener = App.addListener('backButton', () => {
      // Priority 1: Modals and Sidebar
      const sidebarState = useSidebarStore.getState();
      if (sidebarState.isOpen) {
        sidebarState.setIsOpen(false);
        return;
      }
      
      // Check if a modal is open (we use body overflow hidden as a reliable indicator)
      if (document.body.style.overflow === 'hidden') {
        // Dispatch Escape key to trigger modal close
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
        return;
      }

      // Priority 2: Navigate back on sub-pages
      const currentPath = window.location.pathname;
      const isRoot = currentPath === '/' || 
                     currentPath === '/dashboard' || 
                     currentPath === '/curriculum' || 
                     currentPath === '/journal' || 
                     currentPath === '/analytics';
      
      if (!isRoot) {
        router.back();
        return;
      }

      // Priority 3: Exit App on Root Tabs
      backPressCount++;
      if (backPressCount === 1) {
         // Optionally notify user
         setTimeout(() => { backPressCount = 0; }, 2000);
      } else {
         App.exitApp();
      }
    });

    return () => {
      backButtonListener.then(listener => listener.remove());
    };
  }, [router]);

  return null;
}
