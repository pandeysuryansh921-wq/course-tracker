const fs = require('fs');

let content = fs.readFileSync('src/components/curriculum/TopicRow.tsx', 'utf-8');

// Update state
content = content.replace(
  "const [newResource, setNewResource] = React.useState({ title: '', url: '', type: 'other' });",
  "const [newResource, setNewResource] = React.useState({ title: '', url: '', type: 'other', role: 'PRIMARY' });"
);

// Update handleAddResource (link)
content = content.replace(
  "addResource(topic.id, newResource.title, newResource.url, newResource.type as Resource['type']);\n        setNewResource({ title: '', url: '', type: 'other' });",
  "addResource(topic.id, newResource.title, newResource.url, newResource.type as Resource['type'], newResource.role);\n        setNewResource({ title: '', url: '', type: 'other', role: 'PRIMARY' });"
);

// Update handleAddResource (upload)
content = content.replace(
  "addResource(topic.id, newResource.title, base64String, newResource.type as Resource['type']);\n          setNewResource({ title: '', url: '', type: 'other' });",
  "addResource(topic.id, newResource.title, base64String, newResource.type as Resource['type'], newResource.role);\n          setNewResource({ title: '', url: '', type: 'other', role: 'PRIMARY' });"
);

// Add dropdown to form
const dropdownHtml = </select>
                        <select 
                          value={newResource.role}
                          onChange={e => setNewResource({...newResource, role: e.target.value})}
                          className="px-3 py-2 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                        >
                          <option value="PRIMARY">PRIMARY (Core)</option>
                          <option value="SECONDARY">SECONDARY (Optional)</option>
                          <option value="VISUAL">VISUAL (Diagrams/Video)</option>
                          <option value="PRACTICE">PRACTICE (Exercises)</option>
                          <option value="IMPLEMENTATION">IMPLEMENTATION (Code)</option>
                          <option value="REFERENCE">REFERENCE (Docs)</option>
                          <option value="DEEP_DIVE">DEEP DIVE (Advanced)</option>
                        </select>
                      </div>;

content = content.replace(
  "</select>\n                      </div>",
  dropdownHtml
);

fs.writeFileSync('src/components/curriculum/TopicRow.tsx', content);
console.log('Done');
