import { head, empty } from '../core/ui.js';
export default {
  id: 'tasks', name: 'Tasks', color: '#F5B544', icon: 'board',
  tabs: [{ id: 'main', label: 'Tasks', icon: 'board' }],
  render: () => [head('Tasks'), empty('This module is being built.')],
  tile: () => ({ badge: 'Soon' }),
};
