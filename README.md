# Sahti

**Write a WebGL 2 command, use it like a component.**

Sahti lets you combine the power of instanced WebGL 2 rendering with the familiar API of front-end component frameworks.

Sahti is still **unstable and experimental**.

```
npm install --save @vuoro/sahti
yarn add @vuoro/sahti
```

![](https://img.shields.io/bundlephobia/minzip/@vuoro/sahti)  
https://www.npmjs.com/package/@vuoro/sahti

## Supported frameworks

- [x] React `import {component, Canvas} from "@vuoro/sahti/react";`
- [x] Preact `import {component, Canvas} from "@vuoro/sahti/preact";`
- [x] Custom `import {component, createRenderer} from "@vuoro/sahti";`
- [ ] Web Components (soon, hopefully)

## Minimal React example

Demo and source: https://vuoro.github.io/sahti/examples/minimal.react.html

```js
import { Canvas, component } from "@vuoro/sahti/react";

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

const App = () => (
  <>
    <RedTriangle />
    <RedTriangle position={[2, 0, 0]} />
    <RedTriangle position={[-2, 0, 0]} />
    <Canvas style={{ width: "100%", height: "100vh" }} />
  </>
);
```

## Maximal React example

Demo and source: https://vuoro.github.io/sahti/examples/maximal.react.html

## Minimal Preact example

Demo and source: https://vuoro.github.io/sahti/examples/minimal.preact.html

## API and usage

### `component` from "@vuoro/sahti"

Creates a single, instanced, decently well optimized (I hope) WebGL 2 draw call.

```js
const MyComponent = component({
  // See below for what you can put in these.
  context = {},
  props = {},
  // Your WebGL 2 shader strings. Required. See below for details.
  vertex,
  fragment,
  // The `mode` parameter in `gl.drawArrays`
  // https://developer.mozilla.org/en-US/docs/Web/API/WebGLRenderingContext/drawArrays#parameters
  mode = "TRIANGLES",
  // The depth function in `gl.depthFunc`
  // (Can be set to a falsy value to disable `gl.DEPTH_TEST`.)
  // https://developer.mozilla.org/en-US/docs/Web/API/WebGLRenderingContext/depthFunc
  depth = "LESS",
  // The `mode` parameter in `gl.cullFace`
  // (Can be set to a falsy value to disable `gl.CULL_FACE`.)
  // https://developer.mozilla.org/en-US/docs/Web/API/WebGLRenderingContext/cullFace
  cull = "BACK",
  // Override the automatically inserted shader precision lines
  vertexPrecision = "precision highp float;",
  fragmentPrecision = "precision highp float;",
  order
})
```

Returns an object with 3 methods for managing the instances of the draw call:

```js
import { component } from "@vuoro/sahti";

const { addInstance, deleteInstance, updateInstance } = component({…});

// Set up an object as the identity of your instance,
// and use it to add or remove it as needed.
const myInstance = {};
addInstance(myInstance);
deleteInstance(myInstance);

// Update the `props` of your instance like this
updateInstance(
  myInstance,
  "position",
  [0, 1, 0]
);
```

#### `context`

`context` can contain references to objects or arrays. Each will be interpreted as either a WebGL attribute (an array), a texture (an object with the "sampler" key set), or a uniform block (other objects). Sahti will set up the appropriate buffers and other WebGL-related things for each.

The same piece of context can be shared between multiple components. Only 1 buffer/texture/uniform block will be created.

```js
const triangle = [[…], […], […]];
const world = { time: Date.now(), lightDirection: [0, -1, 0] };
const PlainTriangle = component({context: { triangle, world }, …})
const FancyTriangle = component({context: { triangle, world }, …})
```

You can also update the data in these context pieces at any time:

```js
getContext(triangle).update(new Float32Array(9));
getContext(world).update("time", Date.now());
```

#### `props`

`props` contains examples of the kind of data your components will be able to take in. Each of these will become an instanced attribute buffer, automatically updated as your components mount and update.

```js
const Example = component({props: { position: [0, 0] }, …});
…
<Example/> // defaults to the above example value of [0, 0]
<Example position={[1, 0]}/>
<Example position={[1, 1]}/>
```

#### `vertex` and `fragment` shaders

`vertex` and `fragment` are the shaders you'll write. Sahti will automatically insert all the attributes, uniform blocks, and texture uniforms based on the `context` and/or `props` you provide.

It will also add the shader version and precision lines. (Optionally customizable with `vertexPrecision`, `fragmentPrecision`.)

```js
component({
  context: { triangle: [[…], […], […]], world: { time: 0 } }
  props: { position: [0, 0] },
  vertex: `
    // Inserted automatically:
    // -----------------------
    // #version 300 es
    // precision highp float;
    // in vec3 triangle;
    // in vec2 position;
    // uniform world { float time; };

    void main() {
      gl_Position = vec4((triangle + vec3(position, 0.0)) * 0.25, 1.0);
    }
  `,
  fragment: `
    // Inserted automatically:
    // -----------------------
    // #version 300 es
    // precision highp float;
    // uniform world { float time; };

    out vec4 pixelColor;

    void main() {
      pixelColor = vec4(1.0 - time * 0.01, 1.0, 1.0, 1.0);
    }
  `,
})
```

### `component` from "@vuoro/sahti/react"

Same API as above, but returns a React component that handles `addInstance, deleteInstance, updateInstance` automatically.

The component optionally supports `forwardRef`. `ref.current` will be set to `[instance = {}, update = (name, value) => updateInstance(instance, name, value)]`.

```js
import { component } from "@vuoro/sahti/react";

const RedTriangle = component({…});

const App = () => {
  const ref = useRef();

  return (
    <>
      <RedTriangle ref={ref}/>
      <RedTriangle position={[1, 0]}/>
      <RedTriangle position={[1, 1]}/>
    </>
  );
}
```

### `useComponent` from "@vuoro/sahti/react"

Does the same as `component` above, but in the form of a React hook.

```js
import { component } from "@vuoro/sahti";
import { useComponent } from "@vuoro/sahti/react";

const RedTriangle = component({…});

const MyRedTriangle = (props) => {
  const [instance, updateInstance] = useComponent(RedTriangle, props, enabled = true);
  return null;
}
```

### `createCamera` from "@vuoro/sahti/camera"

Because every WebGL library needs its own, opinionated camera implementation. :) It automatically updates a the context in your draw calls with `projection` and `view` matrices.

This module is completely optional to use, and will not be included in your JS if you don't use it.

```js
import { component } from "@vuoro/sahti";
import createCamera from "@vuoro/sahti/camera";

const [camera, cameraObject] = createCamera({
  // Field of view in degrees
  // (uses orthographic camera if not set, perspective camera if set)
  fov,
  // Near and far planes
  near = 0.1,
  far = 1000,
  // Only used for orthographic camera
  zoom = 1,
  // Optionally adds `vec3` `cameraPosition`, `cameraTarget`, and `cameraUp` vectors to your shaders
  includePosition = true,
  includeTarget = true,
  includeUp = false,
});

component({context: {camera}, …});

// Updating any of these triggers an automatic update
cameraObject.fov = 60;
cameraObject.near = 0.01;
cameraObject.far = 500;
cameraObject.zoom = 1;

// Don't try to reassign these. Instead just modify their contents, or use the Float32Array API:
// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Float32Array
// And finally call `update()`, because they won't know to update automatically.
cameraObject.position[0] = 1;
cameraObject.target[0] = 1;
cameraObject.up.set([0, -1, 0]);
cameraObject.update();
```

## Technical details

### Lifecycles

You can start creating components, mounting instances, and updating context resources at any time: no need to wait for a `<canvas>` to initialize a WebGL context. Once a context becomes available, all context and instance updates will be "played back" in sequence. This also means Sahti can take a WebGL context loss and restoration without stopping the entire app.

### Automatic rendering on changes

All created draw calls will be called on the next `requestAnimationFrame`, whenever:

- they're created
- a canvas context is available (or restored after a failure)
- its instances change or update
- one of its context resources gets updated
- another draw call is created

### Single `requestAnimationFrame`

To use the same `requestAnimationFrame` loop as Sahti, you can use `useAnimationFrame` or `requestJob`. If you update any context pieces or instances with these, Sahti will call all draw calls at the end of the same frame.

```js
import { useAnimationFrame, requestJob } from "@vuoro/sahti";

// Called on every frame.
useAnimationFrame(() => {});

// Called on every nth (8th here) frame. Handy if you don't need to do something on _every_ frame.
useAnimationFrame(() => {}, 8);

// Called once, on the next frame.
requestJob(() => {});
```

### Resizing

Sahti uses a `ResizeObserver` to respond to `<canvas>` dimension changes. Due to how it's implemented, it's important to set your `<canvas>` some kind of width and height with CSS, or you'll end up with a massive broken `<canvas>`.

### Module exports

`@vuoro/sahti/react` (and any other upcoming variants) will also export everything from `@vuoro/sahti`. So both of these will work:

```js
import { useAnimationFrame } from "@vuoro/sahti";
import { useAnimationFrame } from "@vuoro/sahti/react";
```

## Contributors

- https://twitter.com/jonikorpi/
- https://twitter.com/VirtanenS (library name)
