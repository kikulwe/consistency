import { head, empty } from '../core/ui.js';
export default {
  id: 'style', name: 'Style', color: '#C4A1FF', icon: 'hanger',
  tabs: [{ id: 'main', label: 'Style', icon: 'hanger' }],
  render: () => [head('Style'), empty('This module is being built.')],
  tile: () => ({ badge: 'Soon' }),
};
