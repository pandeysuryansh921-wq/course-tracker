import { db } from './db';

export async function harvestResourceEffectiveness(topicId: string, quizScorePercentage: number, isMastered: boolean) {
  try {
    // 1. Find all resources the user used for this topic
    const selections = await db.userResourceSelections.where('topicId').equals(topicId).toArray();
    
    // We only want to credit PRIMARY or VISUAL resources that actually teach the core concept
    const coreSelections = selections.filter(s => 
      s.role === 'PRIMARY' || s.role === 'VISUAL' || s.role === 'IMPLEMENTATION'
    );

    if (coreSelections.length === 0) return;

    for (const selection of coreSelections) {
      // Find the ecosystem mapping if it exists, or create one
      const existingMappings = await db.resourceMappings
        .where('[resourceId+targetId]')
        .equals([selection.resourceId, topicId])
        .toArray();
      
      let mapping = existingMappings[0];
      
      if (!mapping) {
        mapping = {
          id: 'map_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
          resourceId: selection.resourceId,
          targetType: 'topic',
          targetId: topicId,
          role: selection.role,
          confidenceScore: 0,
          successCount: 0,
          usageCount: 0,
          createdAt: new Date()
        };
      }

      // Harvest Analytics
      mapping.usageCount = (mapping.usageCount || 0) + 1;
      
      if (isMastered) {
        mapping.successCount = (mapping.successCount || 0) + 1;
        // Bump confidence score significantly
        mapping.confidenceScore = (mapping.confidenceScore || 0) + 10;
      } else if (quizScorePercentage >= 70) {
        // Minor bump
        mapping.confidenceScore = (mapping.confidenceScore || 0) + 2;
      } else {
        // Drop confidence if the user failed despite using this resource
        mapping.confidenceScore = Math.max(0, (mapping.confidenceScore || 0) - 5);
      }

      // Save it back to the canonical mapping table
      await db.resourceMappings.put(mapping);
    }
    
    console.log('[Harvester] Analytics successfully processed for topic:', topicId);
  } catch (error) {
    console.error('[Harvester] Failed to harvest analytics:', error);
  }
}
