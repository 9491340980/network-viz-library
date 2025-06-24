import { NetworkData, NetworkNode, NetworkLink } from '../interfaces/network-visualization.interfaces';

export class MockDataGenerator {
  static generateSimpleNetwork(): NetworkData {
    const nodes: NetworkNode[] = [
      { id: 1, label: 'Central Hub', group: 'Core', size: 20, color: '#ff6b6b' },
      { id: 2, label: 'Database', group: 'Storage', size: 15, color: '#4ecdc4' },
      { id: 3, label: 'Web Server', group: 'Frontend', size: 12, color: '#45b7d1' },
      { id: 4, label: 'API Gateway', group: 'Backend', size: 18, color: '#f9ca24' },
      { id: 5, label: 'Cache', group: 'Storage', size: 10, color: '#f0932b' },
    ];

    const links: NetworkLink[] = [
      { source: 1, target: 2, label: 'Data Flow', weight: 5 },
      { source: 1, target: 3, label: 'Requests', weight: 3 },
      { source: 3, target: 4, label: 'API Calls', weight: 4 },
      { source: 4, target: 2, label: 'Queries', weight: 2 },
      { source: 4, target: 5, label: 'Caching', weight: 1 },
    ];

    return { nodes, links };
  }

  static generateComplexNetwork(nodeCount: number = 50, linkCount: number = 75): NetworkData {
    const groups = ['Core', 'Frontend', 'Backend', 'Storage', 'Analytics', 'Security'];
    const colors = ['#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c'];

    const nodes: NetworkNode[] = Array.from({ length: nodeCount }, (_, i) => ({
      id: i,
      label: `Node ${i}`,
      group: groups[Math.floor(Math.random() * groups.length)],
      size: Math.random() * 15 + 5,
      color: colors[Math.floor(Math.random() * colors.length)],
    }));

    const links: NetworkLink[] = Array.from({ length: linkCount }, (_, i) => {
      const source = Math.floor(Math.random() * nodeCount);
      let target = Math.floor(Math.random() * nodeCount);
      // Ensure source !== target
      while (target === source) {
        target = Math.floor(Math.random() * nodeCount);
      }

      return {
        source,
        target,
        weight: Math.random() * 5 + 1,
        width: Math.random() * 3 + 1,
      };
    });

    return { nodes, links };
  }

  static generateHierarchicalNetwork(): NetworkData {
    const nodes: NetworkNode[] = [
      // Root
      { id: 0, label: 'CEO', group: 'Executive', size: 25, color: '#e74c3c' },

      // Level 1
      { id: 1, label: 'CTO', group: 'Executive', size: 20, color: '#3498db' },
      { id: 2, label: 'CFO', group: 'Executive', size: 20, color: '#2ecc71' },
      { id: 3, label: 'CMO', group: 'Executive', size: 20, color: '#f39c12' },

      // Level 2
      { id: 4, label: 'Dev Manager', group: 'Management', size: 15, color: '#9b59b6' },
      { id: 5, label: 'QA Manager', group: 'Management', size: 15, color: '#1abc9c' },
      { id: 6, label: 'Finance Manager', group: 'Management', size: 15, color: '#34495e' },
      { id: 7, label: 'Marketing Manager', group: 'Management', size: 15, color: '#e67e22' },

      // Level 3
      { id: 8, label: 'Senior Dev', group: 'Developer', size: 10, color: '#3498db' },
      { id: 9, label: 'Junior Dev', group: 'Developer', size: 8, color: '#3498db' },
      { id: 10, label: 'QA Engineer', group: 'QA', size: 10, color: '#1abc9c' },
      { id: 11, label: 'Accountant', group: 'Finance', size: 10, color: '#2ecc71' },
      { id: 12, label: 'Designer', group: 'Marketing', size: 10, color: '#e67e22' },
    ];

    const links: NetworkLink[] = [
      // CEO connections
      { source: 0, target: 1, label: 'Reports to' },
      { source: 0, target: 2, label: 'Reports to' },
      { source: 0, target: 3, label: 'Reports to' },

      // CTO connections
      { source: 1, target: 4, label: 'Manages' },
      { source: 1, target: 5, label: 'Manages' },

      // CFO connections
      { source: 2, target: 6, label: 'Manages' },

      // CMO connections
      { source: 3, target: 7, label: 'Manages' },

      // Manager connections
      { source: 4, target: 8, label: 'Manages' },
      { source: 4, target: 9, label: 'Manages' },
      { source: 5, target: 10, label: 'Manages' },
      { source: 6, target: 11, label: 'Manages' },
      { source: 7, target: 12, label: 'Manages' },

      // Cross-functional connections
      { source: 8, target: 10, label: 'Collaborates' },
      { source: 9, target: 10, label: 'Collaborates' },
      { source: 12, target: 8, label: 'Works with' },
    ];

    return { nodes, links };
  }
}
