const fs = require('fs');
let file1 = fs.readFileSync('src/stores/useCurriculumStore.ts', 'utf-8');
file1 = file1.replace(/topicIds\.includes\(r\.topicId\)/g, "topicIds.includes(r.topicId as string)");
file1 = file1.replace(/moduleIds\.includes\(t\.moduleId\)/g, "moduleIds.includes(t.moduleId as string)");
fs.writeFileSync('src/stores/useCurriculumStore.ts', file1);

let file2 = fs.readFileSync('src/lib/exportImport.ts', 'utf-8');
file2 = file2.replace(/topicIds\.includes\(r\.topicId\)/g, "topicIds.includes(r.topicId as string)");
file2 = file2.replace(/getNewId\(r\.topicId\)/g, "getNewId(r.topicId as string)");
fs.writeFileSync('src/lib/exportImport.ts', file2);
