import { head, empty } from '../core/ui.js';
export default {
  id: 'budget', name: 'Budget', color: '#3DD68C', icon: 'wallet',
  tabs: [{ id: 'main', label: 'Budget', icon: 'wallet' }],
  render: () => [head('Budget'), empty('This module is being built.')],
  tile: () => ({ badge: 'Soon' }),
};
