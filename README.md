# Sahti

**Write a WebGL 2 command, use it like a component.**

Sahti lets you combine the power of WebGL 2 shaders with the familiar API of front-end component frameworks. 

I built Sahti to help me build performant, battery-friendly WebGL games. It's a library intended for people comfortable with writing custom GLSL shaders by hand. I currently use it with React, but it should be able to support any front-end JS framework.

Sahti is still **unstable and experimental**.

```
npm install --save @vuoro/sahti
yarn add @vuoro/sahti
```
![](https://img.shields.io/bundlephobia/minzip/@vuoro/sahti)   
https://www.npmjs.com/package/@vuoro/sahti

## Supported frameworks

✅ React (documentation WIP)  
  `import {component, Canvas} from "@vuoro/sahti/react";`

✅ Custom (documentation WIP)  
  `import {component, createRenderer} from "@vuoro/sahti";`

🚫 Web Components (soon, hopefully)

## Minimal React example 

Demo: https://vuoro.github.io/sahti/

```js
import { Canvas, component } from "@vuoro/sahti/react";

const triangle = [[-1, -1, 0], [1, -1, 0], [-1, 1, 0]];

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
    <Canvas style={{width: "100%", height: "100vh"}} />
  </>
);
```

## Technical summary

`component()` creates a single, instanced, decently well optimized (I hope) WebGL 2 draw call.

`component()` returns a framework-specific component function, used for mounting instances of it, and feeding them data:

```js
// Vague React example
const RedTriangle = component({…});
…
<RedTriangle/>
<RedTriangle position={[1, 0]}/>
<RedTriangle position={[1, 1]}/>
```

`component()` takes in an object like this:

```js
const MyComponent = component({
  context = {},
  props = {},
  vertex,
  fragment,
  mode = "TRIANGLES",
  depth = "LESS",
  cull = "BACK",
  vertexPrecision = "precision highp float;",
  fragmentPrecision = "precision highp float;",
  order
})
```

### `context`

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

### `props`

`props` contains examples of the kind of data your components will be able to take in. Each of these will become an instanced attribute buffer, automatically updated as your components mount and update.

```js
const Example = component({props: { position: [0, 0] }, …});
…
<Example/> // defaults to the above example value of [0, 0]
<Example position={[1, 0]}/>
<Example position={[1, 1]}/>
```

### `vertex` and `fragment` shaders

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

### Other props

`mode`, `depth`, `cull` can be used to change the WebGL drawing modes used for a particular component.

If you have created multiple components, but would like them to be rendered in an order different from the one they are initialized in, you can use `order`:

```js
component({order: 1, …})
component({order: 0, …})
```

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

```
import {useAnimationFrame, requestJob} from "@vuoro/sahti/react";

// Called on every frame.
useAnimationFrame(() => {});

// Called on every nth (8th here) frame. Handy if you don't need to do something on _every_ frame.
useAnimationFrame(() => {}, 8);

// Called once, on the next frame.
requestJob(() => {});
```

### Resizing

Sahti uses a `ResizeObserver` to respond to `<canvas>` dimension changes. Due to how it's implemented, it's important to set your `<canvas>` some kind of width and height with CSS, or you'll end up with a massive broken `<canvas>`.
