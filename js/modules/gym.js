import { head, empty } from '../core/ui.js';
export default {
  id: 'gym', name: 'Gym', color: '#FF7A6B', icon: 'dumbbell',
  tabs: [{ id: 'main', label: 'Gym', icon: 'dumbbell' }],
  render: () => [head('Gym'), empty('This module is being built.')],
  tile: () => ({ badge: 'Soon' }),
};
