import { create } from 'zustand';
import { db } from '@/lib/db';
import { Course, Module, Topic, Resource, TopicStatus, ResourceType, CurriculumStats, GemLink, Assignment } from '@/types/curriculum';
import { generateId } from '@/lib/utils';

interface CurriculumState {
  courses: Course[];
  modules: Module[];
  topics: Topic[];
  resources: Resource[];
  isLoading: boolean;
  isInitialized: boolean;
  
  initialize: () => Promise<void>;
  
  addCourse: (name: string, description: string, color?: string, icon?: string, gemLinks?: GemLink[]) => Promise<Course>;
  updateCourse: (id: string, updates: Partial<Course>) => Promise<void>;
  deleteCourse: (id: string) => Promise<void>;
  
  addModule: (courseId: string, name: string, description: string, notebookUrl?: string) => Promise<Module>;
  updateModule: (id: string, updates: Partial<Module>) => Promise<void>;
  deleteModule: (id: string) => Promise<void>;
  
  addTopic: (moduleId: string, courseId: string, name: string, quizUrl?: string, quizMaxScore?: number) => Promise<Topic>;
  updateTopic: (id: string, updates: Partial<Topic>) => Promise<void>;
  deleteTopic: (id: string) => Promise<void>;
  updateTopicStatus: (id: string, status: TopicStatus) => Promise<void>;
  toggleTopicCompletion: (id: string, isCompleted: boolean) => Promise<void>;
  submitTopicScore: (id: string, score: number) => Promise<void>;
  
  addAssignment: (topicId: string, assignment: Omit<Assignment, 'id'>) => Promise<void>;
  updateAssignment: (topicId: string, assignmentId: string, updates: Partial<Assignment>) => Promise<void>;
  deleteAssignment: (topicId: string, assignmentId: string) => Promise<void>;
  
  addResource: (topicId: string, title: string, url: string, type: ResourceType) => Promise<Resource>;
  deleteResource: (id: string) => Promise<void>;
  
  getCourseModules: (courseId: string) => Module[];
  getModuleTopics: (moduleId: string) => Topic[];
  getCourseProgress: (courseId: string) => number;
  getOverallStats: () => CurriculumStats;
}

export const useCurriculumStore = create<CurriculumState>((set, get) => ({
  courses: [],
  modules: [],
  topics: [],
  resources: [],
  isLoading: false,
  isInitialized: false,

  initialize: async () => {
    if (get().isInitialized) return;
    set({ isLoading: true });
    try {
      const courses = await db.courses.toArray();
      const modules = await db.modules.toArray();
      const topics = await db.topics.toArray();
      const resources = await db.resources.toArray();
      
      set({ courses, modules, topics, resources, isInitialized: true });
    } catch (error) {
      console.error("Failed to initialize curriculum store:", error);
    } finally {
      set({ isLoading: false });
    }
  },

  addCourse: async (name, description, color = 'blue', icon = 'Book', gemLinks) => {
    const newCourse: Course = {
      id: generateId(),
      name,
      description,
      color,
      icon,
      gemLinks,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    await db.courses.put(newCourse);
    set((state) => ({ courses: [...state.courses, newCourse] }));
    return newCourse;
  },

  updateCourse: async (id, updates) => {
    const updated = { ...updates, updatedAt: new Date() };
    await db.courses.update(id, updated);
    set((state) => ({
      courses: state.courses.map(c => c.id === id ? { ...c, ...updated } : c)
    }));
  },

  deleteCourse: async (id) => {
    const modules = get().modules.filter(m => m.courseId === id);
    const moduleIds = modules.map(m => m.id);
    const topics = get().topics.filter(t => moduleIds.includes(t.moduleId));
    const topicIds = topics.map(t => t.id);
    const resources = get().resources.filter(r => topicIds.includes(r.topicId));
    
    await Promise.all([
      db.courses.delete(id),
      ...moduleIds.map(mid => db.modules.delete(mid)),
      ...topicIds.map(tid => db.topics.delete(tid)),
      ...resources.map(r => db.resources.delete(r.id))
    ]);

    set((state) => ({
      courses: state.courses.filter(c => c.id !== id),
      modules: state.modules.filter(m => m.courseId !== id),
      topics: state.topics.filter(t => t.courseId !== id),
      resources: state.resources.filter(r => !topicIds.includes(r.topicId))
    }));
  },

  addModule: async (courseId, name, description, notebookUrl) => {
    const modules = get().modules.filter(m => m.courseId === courseId);
    const newModule: Module = {
      id: generateId(),
      courseId,
      name,
      description,
      order: modules.length,
      notebookUrl,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    await db.modules.put(newModule);
    set((state) => ({ modules: [...state.modules, newModule] }));
    return newModule;
  },

  updateModule: async (id, updates) => {
    const updated = { ...updates, updatedAt: new Date() };
    await db.modules.update(id, updated);
    set((state) => ({
      modules: state.modules.map(m => m.id === id ? { ...m, ...updated } : m)
    }));
  },

  deleteModule: async (id) => {
    const topics = get().topics.filter(t => t.moduleId === id);
    const topicIds = topics.map(t => t.id);
    const resources = get().resources.filter(r => topicIds.includes(r.topicId));

    await Promise.all([
      db.modules.delete(id),
      ...topicIds.map(tid => db.topics.delete(tid)),
      ...resources.map(r => db.resources.delete(r.id))
    ]);

    set((state) => ({
      modules: state.modules.filter(m => m.id !== id),
      topics: state.topics.filter(t => t.moduleId !== id),
      resources: state.resources.filter(r => !topicIds.includes(r.topicId))
    }));
  },

  addTopic: async (moduleId, courseId, name, quizUrl, quizMaxScore = 100) => {
    const newTopic: Topic = {
      id: generateId(),
      moduleId,
      courseId,
      name,
      status: 'not-started',
      isCompleted: false,
      resources: [],
      notes: '',
      quizUrl,
      quizMaxScore,
      assignments: [],
      order: get().topics.filter(t => t.moduleId === moduleId).length,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    await db.topics.put(newTopic);
    set((state) => ({ topics: [...state.topics, newTopic] }));
    return newTopic;
  },

  updateTopic: async (id, updates) => {
    const updated = { ...updates, updatedAt: new Date() };
    await db.topics.update(id, updated);
    set((state) => ({
      topics: state.topics.map(t => t.id === id ? { ...t, ...updated } : t)
    }));
  },

  deleteTopic: async (id) => {
    const resources = get().resources.filter(r => r.topicId === id);
    
    await Promise.all([
      db.topics.delete(id),
      ...resources.map(r => db.resources.delete(r.id))
    ]);

    set((state) => ({
      topics: state.topics.filter(t => t.id !== id),
      resources: state.resources.filter(r => r.topicId !== id)
    }));
  },

  updateTopicStatus: async (id, status) => {
    const isCompleted = status === 'completed';
    await get().updateTopic(id, { status, isCompleted });
  },

  toggleTopicCompletion: async (id, isCompleted) => {
    const topic = get().topics.find(t => t.id === id);
    if (!topic) return;
    const status: TopicStatus = isCompleted ? 'completed' : (topic.status === 'completed' ? 'in-progress' : topic.status);
    await get().updateTopic(id, { status, isCompleted });
  },

  submitTopicScore: async (id, score) => {
    const topic = get().topics.find(t => t.id === id);
    if (!topic) return;

    const maxScore = topic.quizMaxScore || 100;
    const percentage = (score / maxScore) * 100;

    let isMastered = false;
    let isCompleted = false;
    let status: TopicStatus = 'needs-review';

    if (percentage >= 85) {
      isMastered = true;
      isCompleted = true;
      status = 'completed';
    } else if (percentage >= 70) {
      isMastered = false;
      isCompleted = true;
      status = 'completed';
    } else {
      isMastered = false;
      isCompleted = false;
      status = 'needs-review';
    }

    await get().updateTopic(id, { quizScore: score, isMastered, isCompleted, status });

    // Auto-unlock next sequential item (mark next topic as in-progress if it's not-started)
    if (isCompleted) {
      const allTopics = get().topics.filter(t => t.moduleId === topic.moduleId).sort((a, b) => a.order - b.order);
      const currentIndex = allTopics.findIndex(t => t.id === topic.id);
      if (currentIndex !== -1 && currentIndex + 1 < allTopics.length) {
        const nextTopic = allTopics[currentIndex + 1];
        if (nextTopic.status === 'not-started') {
          await get().updateTopicStatus(nextTopic.id, 'in-progress');
        }
      }
    }
  },

  addAssignment: async (topicId, assignment) => {
    const topic = get().topics.find(t => t.id === topicId);
    if (!topic) return;
    
    const newAssignment: Assignment = {
      ...assignment,
      id: generateId(),
    };
    
    const assignments = [...(topic.assignments || []), newAssignment];
    await get().updateTopic(topicId, { assignments });
  },

  updateAssignment: async (topicId, assignmentId, updates) => {
    const topic = get().topics.find(t => t.id === topicId);
    if (!topic) return;
    
    const assignments = (topic.assignments || []).map(a => 
      a.id === assignmentId ? { ...a, ...updates } : a
    );
    
    await get().updateTopic(topicId, { assignments });
  },

  deleteAssignment: async (topicId, assignmentId) => {
    const topic = get().topics.find(t => t.id === topicId);
    if (!topic) return;
    
    const assignments = (topic.assignments || []).filter(a => a.id !== assignmentId);
    await get().updateTopic(topicId, { assignments });
  },

  addResource: async (topicId, title, url, type) => {
    const newResource: Resource = {
      id: generateId(),
      topicId,
      title,
      url,
      type,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    await db.resources.put(newResource);
    set((state) => ({ resources: [...state.resources, newResource] }));
    return newResource;
  },

  deleteResource: async (id) => {
    await db.resources.delete(id);
    set((state) => ({ resources: state.resources.filter(r => r.id !== id) }));
  },

  getCourseModules: (courseId) => {
    return get().modules.filter(m => m.courseId === courseId).sort((a, b) => a.order - b.order);
  },

  getModuleTopics: (moduleId) => {
    return get().topics.filter(t => t.moduleId === moduleId).sort((a, b) => a.order - b.order);
  },

  getCourseProgress: (courseId) => {
    const topics = get().topics.filter(t => t.courseId === courseId);
    if (topics.length === 0) return 0;
    const completed = topics.filter(t => t.status === 'completed').length;
    return Math.round((completed / topics.length) * 100);
  },

  getOverallStats: () => {
    const { courses, topics } = get();
    const completedTopics = topics.filter(t => t.status === 'completed').length;
    const totalTopics = topics.length;
    
    const progress = totalTopics > 0 ? Math.round((completedTopics / totalTopics) * 100) : 0;
    
    return {
      totalCourses: courses.length,
      completedCourses: courses.filter(c => get().getCourseProgress(c.id) === 100).length,
      totalTopics,
      completedTopics,
      overallProgress: progress,
      topicsNeedsReview: topics.filter(t => t.status === 'needs-review').length,
    };
  }
}));
