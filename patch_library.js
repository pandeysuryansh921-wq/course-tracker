const fs = require('fs');
let content = fs.readFileSync('src/app/library/page.tsx', 'utf-8');

// Imports
content = content.replace(
  "import { Resource } from '@/types/curriculum';",
  "import { Resource, ResourceMapping } from '@/types/curriculum';\nimport { db } from '@/lib/db';"
);

content = content.replace(
  "import { Library, Search, FileText, Video, BookOpen, Globe, Link as LinkIcon, File } from 'lucide-react';",
  "import { Library, Search, FileText, Video, BookOpen, Globe, Link as LinkIcon, File, Star } from 'lucide-react';"
);

// State
content = content.replace(
  "const [filterType, setFilterType] = useState<string>('all');",
  "const [filterType, setFilterType] = useState<string>('all');\n  const [analytics, setAnalytics] = useState<Record<string, { confidence: number, success: number }>>({});\n\n  React.useEffect(() => {\n    db.resourceMappings.toArray().then(mappings => {\n      const stats: Record<string, { confidence: number, success: number }> = {};\n      mappings.forEach(m => {\n        if (!stats[m.resourceId]) stats[m.resourceId] = { confidence: 0, success: 0 };\n        stats[m.resourceId].confidence += (m.confidenceScore || 0);\n        stats[m.resourceId].success += (m.successCount || 0);\n      });\n      setAnalytics(stats);\n    });\n  }, []);\n"
);

// Map builder 
content = content.replace(
  "map.get(canonicalUrl)!.uses.push({",
  "const resId = 'res_' + btoa(canonicalUrl).replace(/[^a-zA-Z0-9]/g, \"\").substring(0, 16);\n      map.get(canonicalUrl)!.base.resourceId = resId;\n      map.get(canonicalUrl)!.uses.push({"
);

// JSX Render - Title
content = content.replace(
  "                <h3 className=\"font-semibold text-slate-800 dark:text-slate-100 line-clamp-2\" title={base.title}>{base.title}</h3>",
  "                <h3 className=\"font-semibold text-slate-800 dark:text-slate-100 line-clamp-2\" title={base.title}>\n                  {base.title}\n                </h3>\n                {analytics[base.resourceId] && analytics[base.resourceId].confidence > 0 && (\n                  <div className=\"flex items-center gap-1 mt-1 text-yellow-600 dark:text-yellow-500 bg-yellow-50 dark:bg-yellow-900/20 px-2 py-0.5 rounded-full w-max text-[10px] font-bold\">\n                    <Star className=\"w-3 h-3 fill-current\" />\n                    {analytics[base.resourceId].confidence} Effectiveness Score\n                  </div>\n                )}"
);

fs.writeFileSync('src/app/library/page.tsx', content);
