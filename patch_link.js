const fs = require('fs');

let content = fs.readFileSync('src/components/curriculum/ResourceLink.tsx', 'utf-8');

const oldScope = {resource.scopeInstructions && (
        <div className="ml-7 mr-2 p-2 bg-blue-50 dark:bg-blue-900/10 border-l-2 border-blue-400 dark:border-blue-700 rounded-r-md">
          <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-400 block mb-1">Study Scope</span>
          <p className="text-xs text-blue-900 dark:text-blue-200">{resource.scopeInstructions}</p>
        </div>
      )};

const newScope = {resource.scopeInstructions && (
        <div className="ml-7 mb-1 flex items-center">
          {['PRIMARY', 'SECONDARY', 'VISUAL', 'PRACTICE', 'IMPLEMENTATION', 'REFERENCE', 'DEEP_DIVE', 'RESEARCH', 'REVISION'].includes(resource.scopeInstructions.toUpperCase()) ? (
            <span className={\	ext-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider \\}>
              {resource.scopeInstructions}
            </span>
          ) : (
            <div className="p-2 w-full bg-blue-50 dark:bg-blue-900/10 border-l-2 border-blue-400 dark:border-blue-700 rounded-r-md">
              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-400 block mb-1">Study Scope</span>
              <p className="text-xs text-blue-900 dark:text-blue-200">{resource.scopeInstructions}</p>
            </div>
          )}
        </div>
      )};

content = content.replace(oldScope, newScope);
fs.writeFileSync('src/components/curriculum/ResourceLink.tsx', content);
