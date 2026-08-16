import { Placeholder, VERSION } from './index';

describe('@rnchart/charts', () => {
  it('exposes its version', () => {
    expect(VERSION).toBe('0.1.0');
  });

  it('exports Placeholder as a component', () => {
    expect(typeof Placeholder).toBe('function');
  });

  it('renders a tree carrying the label and the resolved package versions', () => {
    // Called directly rather than through a renderer: phase 1 has no rendering
    // to assert on, and the real render tests arrive with <Chart> in phase 5.
    const element = Placeholder({ label: 'test-label' });
    const json = JSON.stringify(element);

    expect(json).toContain('test-label');
    expect(json).toContain('core 0.1.0');
  });
});
