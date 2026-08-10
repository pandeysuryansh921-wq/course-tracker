'use client';

import { useEffect } from 'react';
import { useCurriculumStore } from '@/stores/useCurriculumStore';

export function AppInitializer() {
  const initCurriculum = useCurriculumStore((state) => state.initialize);

  useEffect(() => {
    if (typeof initCurriculum === 'function') initCurriculum();
  }, [initCurriculum]);

  return null;
}
