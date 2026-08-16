import { rendererInfo, VERSION } from './index';

describe('@rnchart/skia', () => {
  it('exposes its own version', () => {
    expect(VERSION).toBe('0.1.0');
  });

  it('resolves @rnchart/core across the workspace boundary', () => {
    const info = rendererInfo();
    expect(info.renderer).toBe('skia');
    expect(info.coreVersion).toBe('0.1.0');
  });
});
