# Sahti

Components API for instanced rendering in WebGL 2

## Minimal React example

<https://vuoro.github.io/sahti/>

```js
import { Canvas, component } from "@sahti/react";

const triangle = [
  [-1, -1, 0],
  [1, -1, 0],
  [-1, 1, 0],
];

const RedTriangle = component({
  context: { triangle },
  props: { position: [0, 0, 0] },
  vertex: `
    void main() {
      gl_Position = vec4((triangle + position) * 0.25, 1.0);
    }
  `,
  fragment: `
    out vec4 pixelColor;

    void main() {
      pixelColor = vec4(1.0, 0.0, 0.0, 1.0);
    }
  `,
});

const App = () => {
  return (
    <>
      <RedTriangle />
      <RedTriangle position={[2, 0, 0]} />
      <RedTriangle position={[-2, 0, 0]} />
      <Canvas width={320} height={320} />
    </>
  );
};
```
