import * as React from 'react';
import renderer from 'react-test-renderer';

import { MonoText } from '../StyledText';

it(`renders correctly`, async () => {
  let mounted;
  await renderer.act(async () => { mounted = renderer.create(<MonoText>Snapshot test!</MonoText>); });
  try {
    expect(mounted.toJSON()).not.toBeNull();
    expect(mounted.toJSON()).toMatchSnapshot();
  } finally {
    await renderer.act(async () => mounted.unmount());
  }
});
