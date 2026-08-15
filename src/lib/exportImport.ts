import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { db } from '@/lib/db';
import { useCurriculumStore } from '@/stores/useCurriculumStore';
import { generateId } from '@/lib/utils';
import { Course, Module, Topic, Resource, Assignment } from '@/types/curriculum';

export const exportCourseToZip = async (courseId: string) => {
  const zip = new JSZip();

  // 1. Fetch data
  const course = await db.courses.get(courseId);
  if (!course) throw new Error("Course not found");

  const modules = await db.modules.where('courseId').equals(courseId).toArray();
  const moduleIds = modules.map(m => m.id);
  const topics = await db.topics.where('courseId').equals(courseId).toArray();
  const topicIds = topics.map(t => t.id);
  const resources = await db.resources.where('topicId').anyOf(topicIds).toArray();

  // 2. Clean data & extract base64 files
  const assetsFolder = zip.folder("assets");
  if (!assetsFolder) throw new Error("Failed to create assets folder in zip");

  const processBase64Url = (url: string, id: string): string => {
    if (url && url.startsWith('data:')) {
      const parts = url.split(',');
      const metadata = parts[0];
      const base64Data = parts[1];
      const mimeMatch = metadata.match(/data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);/);
      let ext = 'bin';
      if (mimeMatch) {
        const mime = mimeMatch[1];
        if (mime === 'application/pdf') ext = 'pdf';
        else if (mime === 'image/jpeg') ext = 'jpg';
        else if (mime === 'image/png') ext = 'png';
        else if (mime === 'image/webp') ext = 'webp';
        else if (mime.startsWith('image/')) ext = mime.split('/')[1];
      }
      const filename = `${id}.${ext}`;
      assetsFolder.file(filename, base64Data, { base64: true });
      return `assets/${filename}`;
    }
    return url;
  };

  const cleanTopics = topics.map(topic => {
    const cleanTopic = { ...topic };
    
    // Reset progress
    cleanTopic.status = 'not-started';
    cleanTopic.isCompleted = false;
    cleanTopic.isMastered = false;
    cleanTopic.quizScore = undefined;
    
    if (cleanTopic.assignments) {
      cleanTopic.assignments = cleanTopic.assignments.map(a => {
        const cleanA = { ...a, isSubmitted: false, submissionFile: undefined, submittedAt: undefined };
        if (cleanA.file && cleanA.file.url) {
          cleanA.file.url = processBase64Url(cleanA.file.url, cleanA.file.id);
        }
        return cleanA;
      });
    }
    return cleanTopic;
  });

  const cleanResources = resources.map(resource => {
    const cleanR = { ...resource };
    if (cleanR.url) {
      cleanR.url = processBase64Url(cleanR.url, cleanR.id);
    }
    return cleanR;
  });

  const exportData = {
    version: 1,
    course,
    modules,
    topics: cleanTopics,
    resources: cleanResources
  };

  // 3. Add JSON to zip
  zip.file("course.json", JSON.stringify(exportData, null, 2));

  // 4. Generate and download
  const content = await zip.generateAsync({ type: "blob" });
  saveAs(content, `${course.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_export.zip`);
};

export const importCourseFromZip = async (file: File) => {
  const zip = new JSZip();
  const loadedZip = await zip.loadAsync(file);

  const jsonFile = loadedZip.file("course.json");
  if (!jsonFile) throw new Error("Invalid package: course.json missing");

  const jsonContent = await jsonFile.async("string");
  const data = JSON.parse(jsonContent);

  if (!data.course || !data.modules || !data.topics || !data.resources) {
    throw new Error("Invalid package format");
  }

  // ID mapping to ensure uniqueness
  const idMap: Record<string, string> = {};
  const getNewId = (oldId: string) => {
    if (!idMap[oldId]) idMap[oldId] = generateId();
    return idMap[oldId];
  };

  const getMimeFromExt = (ext: string) => {
    if (ext === 'pdf') return 'application/pdf';
    if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
    if (ext === 'png') return 'image/png';
    if (ext === 'webp') return 'image/webp';
    return 'application/octet-stream';
  };

  const restoreBase64Url = async (url: string) => {
    if (url && url.startsWith('assets/')) {
      const filename = url.replace('assets/', '');
      const zipFile = loadedZip.file(`assets/${filename}`);
      if (zipFile) {
        const base64Data = await zipFile.async("base64");
        const ext = filename.split('.').pop() || 'bin';
        const mime = getMimeFromExt(ext);
        return `data:${mime};base64,${base64Data}`;
      }
    }
    return url;
  };

  // Process IDs and restore files
  const newCourse = { ...data.course, id: getNewId(data.course.id), createdAt: new Date(), updatedAt: new Date() };
  
  const newModules = data.modules.map((m: Module) => ({
    ...m,
    id: getNewId(m.id),
    courseId: getNewId(m.courseId),
    createdAt: new Date(),
    updatedAt: new Date()
  }));

  const newTopics = await Promise.all(data.topics.map(async (t: Topic) => {
    const newT = {
      ...t,
      id: getNewId(t.id),
      moduleId: getNewId(t.moduleId),
      courseId: getNewId(t.courseId),
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    if (newT.assignments) {
      newT.assignments = await Promise.all(newT.assignments.map(async (a: Assignment) => {
        const newA = { ...a, id: getNewId(a.id) };
        if (newA.file) {
          newA.file = { ...newA.file, id: getNewId(newA.file.id), url: await restoreBase64Url(newA.file.url) };
        }
        return newA;
      }));
    }
    return newT;
  }));

  const newResources = await Promise.all(data.resources.map(async (r: Resource) => {
    return {
      ...r,
      id: getNewId(r.id),
      topicId: getNewId(r.topicId),
      url: await restoreBase64Url(r.url),
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }));

  // Save to database
  await db.transaction('rw', db.courses, db.modules, db.topics, db.resources, async () => {
    await db.courses.add(newCourse);
    await db.modules.bulkAdd(newModules);
    await db.topics.bulkAdd(newTopics);
    await db.resources.bulkAdd(newResources);
  });

  // Re-initialize store so UI updates
  await useCurriculumStore.getState().initialize();
};
