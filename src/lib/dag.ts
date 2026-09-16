import { Topic, TopicStatus } from '@/types/curriculum';

export interface DagNode {
  topic: Topic;
  prerequisites: string[]; // Topic IDs
  dependents: string[]; // Topic IDs
  status: TopicStatus;
  isUnlocked: boolean;
  depth: number;
  criticalPathScore: number;
}

export class DagProcessor {
  private nodes = new Map<string, DagNode>();
  
  constructor(topics: Topic[]) {
    this.buildGraph(topics);
    this.calculateCriticalPaths();
  }

  private buildGraph(topics: Topic[]) {
    // 1. Initialize nodes
    for (const t of topics) {
      this.nodes.set(t.id, {
        topic: t,
        prerequisites: [],
        dependents: [],
        status: t.status,
        isUnlocked: false,
        depth: 0,
        criticalPathScore: 0
      });
    }

    // 2. Resolve prereqs by matching strings (names or IDs) to other topics
    for (const t of topics) {
      const node = this.nodes.get(t.id)!;
      if (!t.prerequisites || t.prerequisites.length === 0) {
        continue;
      }

      for (const prereqString of t.prerequisites) {
        // Try to find the prereq topic by ID first, then by name (case-insensitive)
        const resolved = topics.find(other => 
          other.id === prereqString || 
          other.name.toLowerCase() === prereqString.toLowerCase()
        );
        
        if (resolved) {
          node.prerequisites.push(resolved.id);
          const parentNode = this.nodes.get(resolved.id);
          if (parentNode) {
            parentNode.dependents.push(node.topic.id);
          }
        }
      }
    }
    
    // 3. Determine 'Unlocked' status
    for (const [id, node] of this.nodes.entries()) {
      node.isUnlocked = this.checkIfUnlocked(id);
    }
  }

  private checkIfUnlocked(topicId: string): boolean {
    const node = this.nodes.get(topicId);
    if (!node) return false;
    
    // If it has no prereqs, it is unlocked
    if (node.prerequisites.length === 0) return true;

    // It is unlocked if ALL prerequisites are completed (or mastered)
    for (const prereqId of node.prerequisites) {
      const prereqNode = this.nodes.get(prereqId);
      if (!prereqNode || (prereqNode.status !== 'completed' && !prereqNode.topic.isMastered)) {
        return false;
      }
    }
    return true;
  }

  private calculateCriticalPaths() {
    // A simple bottom-up pass to calculate how many downstream topics rely on this node
    // This helps prioritize what the user should study next
    
    const memo = new Map<string, number>();
    
    const getScore = (id: string, visited: Set<string>): number => {
      if (memo.has(id)) return memo.get(id)!;
      if (visited.has(id)) return 0; // avoid cycles
      
      visited.add(id);
      
      const node = this.nodes.get(id);
      if (!node) return 0;
      
      let score = node.dependents.length;
      for (const depId of node.dependents) {
        score += getScore(depId, new Set(visited));
      }
      
      memo.set(id, score);
      return score;
    };

    for (const id of this.nodes.keys()) {
      const node = this.nodes.get(id)!;
      node.criticalPathScore = getScore(id, new Set());
    }
  }

  public getNextUp(): Topic[] {
    // Return unlocked, not-completed topics, sorted by criticalPathScore descending
    return Array.from(this.nodes.values())
      .filter(n => n.isUnlocked && n.status !== 'completed' && !n.topic.isMastered)
      .sort((a, b) => b.criticalPathScore - a.criticalPathScore)
      .map(n => n.topic);
  }

  public getBlockedTopics(): Topic[] {
    return Array.from(this.nodes.values())
      .filter(n => !n.isUnlocked && n.status !== 'completed')
      .map(n => n.topic);
  }

  public getRawNodes(): DagNode[] {
    return Array.from(this.nodes.values());
  }
}
