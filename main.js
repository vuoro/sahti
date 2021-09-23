const blankObject = {};

// useAnimationFrame
const animationFrameSets = new Map();
const animationFrameJobs = new Set();
const animationFrameRenderJobs = new Set();
let frameNumber = 0;
let totalSubscribers = 0;
let frame = null;
const now = new Date();
const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
const navigationStart = performance?.timing?.navigationStart || 0;
const timeOffset = navigationStart - startOfMonth.valueOf();

export const subscribeToAnimationFrame = (callback, nthFrame) => {
  if (!animationFrameSets.has(nthFrame)) {
    animationFrameSets.set(nthFrame, new Set());
  }
  const set = animationFrameSets.get(nthFrame);
  set.add(callback);
  totalSubscribers++;

  frame = frame || requestAnimationFrame(animationFrame);
};

export const unsubscribeFromAnimationFrame = (callback, nthFrame) => () => {
  animationFrameSets.get(nthFrame).delete(callback);
  totalSubscribers--;
};

export const requestJob = (job) => {
  animationFrameJobs.add(job);
  frame = frame || requestAnimationFrame(animationFrame);
};

export const requestRenderJob = (job) => {
  animationFrameRenderJobs.add(job);
  frame = frame || requestAnimationFrame(animationFrame);
};

const animationFrame = (timestamp) => {
  for (const [nthFrame, set] of animationFrameSets) {
    if (frameNumber % nthFrame === 0) {
      for (const callback of set) {
        callback.call(
          undefined,
          timestamp,
          timestamp + navigationStart,
          timestamp + timeOffset,
          frameNumber
        );
      }
    }
  }

  for (const job of animationFrameJobs) {
    job();
  }
  animationFrameJobs.clear();

  for (const job of animationFrameRenderJobs) {
    job();
  }
  animationFrameRenderJobs.clear();

  frameNumber++;

  if (
    totalSubscribers !== 0 ||
    animationFrameJobs.size !== 0 ||
    animationFrameRenderJobs.size !== 0
  ) {
    frame = requestAnimationFrame(animationFrame);
  } else {
    frame = null;
  }
};

// WebGL2
export const defaultAttributes = {
  alpha: false,
  antialias: false,
};
const renderer = {};
export const resizeSubscribers = new Set();
const textureIndexes = new Map();
let needsRendering = false;

const requestRendering = () => {
  needsRendering = true;

  if (renderer.gl) {
    requestRenderJob(render);
  }
};

export const createRenderer = (
  canvas,
  { attributes = blankObject, pixelRatio = 1, debug = false, clearColor = [0, 0, 0, 1] }
) => {
  let gl = canvas.getContext("webgl2", { ...defaultAttributes, ...attributes });

  // Caches and setters
  let currentProgram = null;
  let currentVao = null;
  let currentBuffer = null;
  let currentTexture = null;
  let currentFramebuffer = null;
  let currentDepth = null;
  let currentCull = null;

  const setProgram = (program) => {
    if (currentProgram !== program) {
      gl.useProgram(program);
      currentProgram = program;
    }
  };
  const setVao = (vao = null) => {
    if (currentVao !== vao) {
      gl.bindVertexArray(vao);
      currentVao = vao;
    }
  };
  const setBuffer = (buffer, type = gl.ARRAY_BUFFER) => {
    if (currentBuffer !== buffer) {
      gl.bindBuffer(type, buffer);
      currentBuffer = buffer;
    }
  };
  const setDepth = (depth) => {
    if (currentDepth !== depth) {
      if (depth) {
        gl.enable(gl.DEPTH_TEST);
        gl.depthFunc(gl[depth]);
      } else {
        gl.disable(gl.DEPTH_TEST);
      }
      currentDepth = depth;
    }
  };
  const setCull = (cull) => {
    if (currentCull !== cull) {
      if (cull) {
        gl.enable(gl.CULL_FACE);
        gl.cullFace(gl[cull]);
      } else {
        gl.disable(gl.CULL_FACE);
      }
      currentCull = cull;
    }
  };

  gl.enable(gl.DEPTH_TEST);
  gl.enable(gl.CULL_FACE);

  const setTexture = (texture) => {
    if (currentTexture !== texture) {
      if (!textureIndexes.has(texture)) {
        textureIndexes.set(texture, textureIndexes.size);
      }

      const index = textureIndexes.get(texture);
      gl.activeTexture(gl[`TEXTURE${index}`]);
      gl.bindTexture(gl.TEXTURE_2D, texture);
    }

    currentTexture = texture;
  };

  const setFramebuffer = (framebuffer) => {
    if (currentFramebuffer !== framebuffer) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
      currentFramebuffer = framebuffer;
    }
  };

  // Clearing
  let lastDepth = 1;
  const setClear = (color = clearColor, depth = lastDepth) => {
    color.forEach((value, index) => {
      clearColor[index] = value;
    });
    gl.clearColor(...color);
    if (lastDepth.current !== depth) {
      gl.clearDepth(depth);
      lastDepth = depth;
    }
  };
  setClear();
  const clear = (value = 16640) => {
    gl.clear(value);
  };

  const observer = new ResizeObserver((entries) => {
    for (const entry of entries) {
      const { width, height } = entry.contentRect;
      const ratio = window.devicePixelRatio * pixelRatio;
      canvas.width = width * ratio;
      canvas.height = height * ratio;
      gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);

      for (const subscriber of resizeSubscribers) {
        subscriber(0, 0, width, height, ratio);
      }

      requestRendering();
    }
  });
  observer.observe(canvas);

  renderer.gl = gl;
  renderer.canvas = canvas;
  renderer.setProgram = setProgram;
  renderer.setVao = setVao;
  renderer.setBuffer = setBuffer;
  renderer.setTexture = setTexture;
  renderer.setFramebuffer = setFramebuffer;
  renderer.setDepth = setDepth;
  renderer.setCull = setCull;
  renderer.setClear = setClear;
  renderer.clear = clear;
  renderer.observer = observer;
  renderer.uniformBindIndexCounter = 0;
  renderer.debug = debug;

  renderer.destroy = () => {
    if (debug) console.log("destroying renderer");
    observer.disconnect();
    gl = null;
    currentProgram = null;
    currentVao = null;
    currentBuffer = null;
    currentTexture = null;
    currentFramebuffer = null;
    currentDepth = null;
    currentCull = null;
    destroyCommandsAndContexts();

    for (const key in renderer) {
      delete renderer[key];
    }
  };

  const destroyCommandsAndContexts = () => {
    commands.forEach((state) => state.destroy());
    contexts.forEach((state) => state.destroy());
    textureIndexes.clear();
  };

  canvas.addEventListener("webglcontextlost", (event) => {
    if (debug) console.log("context lost");
    event.preventDefault();
    destroyCommandsAndContexts();
    // TODO: prevent rendering until restored
  });
  canvas.addEventListener("webglcontextrestored", () => {
    if (debug) console.log("context restoring");
    commands.forEach((state) => state.create());
  });

  commands.forEach((state) => state.create());

  if (needsRendering) {
    requestRendering();
  }

  return renderer;
};

export const contexts = new Map();
export const commands = new Map();

const programCache = new Map();
const shaderCache = new Map();
const shaderVersion = "#version 300 es";
const defaultShouldRender = () => true;

export const component = (input) => {
  const {
    context = blankObject,
    elements,
    props = blankObject,
    vertex,
    fragment,
    mode = "TRIANGLES",
    depth = "LESS",
    cull = "BACK",
    vertexPrecision = "precision highp float;",
    fragmentPrecision = "precision highp float;",
    order = commands.size * 0.001,
    count: overrideCount,
    instanceCount: overrideInstanceCount,
    shouldRender = defaultShouldRender,
  } = input;

  const state = { order, input, created: false, count: overrideCount || 0 };

  if (!vertex || !fragment) {
    throw new Error("missing vertex or fragment shader");
  }

  // Kick off contexts
  const attributes = [],
    instancedAttributes = [],
    uniformBlocks = [],
    textures = [];
  let elementsContext;

  for (const name in context) {
    const contextResource = context[name];
    const result = createContext(name, contextResource);

    const { contextType } = result;
    let storage;

    switch (contextType) {
      case "buffer":
        storage = attributes;
        break;
      case "texture":
        storage = textures;
        break;
      case "uniformBlock":
        storage = uniformBlocks;
        break;
      default:
        throw new Error("unknown contextType");
    }

    storage.push(result);
  }

  for (const name in props) {
    const context = props[name];
    instancedAttributes.push(createContext(name, context, { isInstanced: true }));
  }

  // Kick off instances
  const instances = new Set();
  const offsets = new Map();
  const pendingInstanceUpdates = new Set();
  let instancesNeedToBeRecreated = true;
  let instanceCount = overrideInstanceCount || 0;
  const instancedBufferUpdaters = new Map(
    instancedAttributes.map(({ name, update }) => [name, update])
  );

  state.addInstance = (instance) => {
    for (const { name, defaultValue } of instancedAttributes) {
      if (instance[name] === undefined) {
        instance[name] = Array.isArray(defaultValue)
          ? [...defaultValue]
          : ArrayBuffer.isView(defaultValue)
          ? new defaultValue.constructor(defaultValue)
          : defaultValue;
      }
    }

    instances.add(instance);
    instanceCount++;
    instancesNeedToBeRecreated = true;
    requestRendering();
  };

  state.deleteInstance = (instance) => {
    instances.delete(instance);
    instanceCount--;
    instancesNeedToBeRecreated = true;
    requestRendering();
  };

  state.updateInstance = (instance, name, value) => {
    if (state.created) {
      instancedBufferUpdaters.get(name)(value, offsets.get(instance));
      requestRendering();
    } else {
      pendingInstanceUpdates.add([instance, name, value]);
    }
  };

  // Lifecycles
  state.countVertices = () => {
    state.count = overrideCount
      ? overrideCount
      : attributes.reduce((count, context) => Math.min(count, context.count), Infinity);
  };

  state.create = () => {
    const { gl, setProgram, setBuffer, setVao, setDepth, setCull, debug } = renderer;

    [...attributes, ...instancedAttributes, ...uniformBlocks, ...textures].forEach((resource) => {
      if (!resource.created) {
        resource.create();
      }
      resource.bindTo(state);
    });

    const attributeLines = attributes
      .map(({ name, shaderType }) => {
        return `in ${shaderType} ${name};`;
      })
      .join("\n");

    const instancedAttributeLines = instancedAttributes
      .map(({ name, shaderType }) => {
        return `in ${shaderType} ${name};`;
      })
      .join("\n");

    const textureLines = textures
      .map(({ name, shaderType }) => {
        return `uniform ${shaderType} ${name};`;
      })
      .join("\n");

    const uniformLines = uniformBlocks
      .map(({ name, shaderType, uniforms }) => {
        return `layout(std140) uniform ${name} { 
  ${Object.entries(uniforms)
    .map(([name, { shaderType }]) => `${shaderType} ${name};`)
    .join("\n  ")} 
};`;
      })
      .join("\n");

    const finalVertex = [
      shaderVersion,
      vertexPrecision,
      attributeLines,
      instancedAttributeLines,
      uniformLines,
      textureLines,
      vertex,
    ].join("\n");

    const finalFragment = [
      shaderVersion,
      fragmentPrecision,
      uniformLines,
      textureLines,
      fragment,
    ].join("\n");

    if (debug) console.log("Creating command", input, { finalVertex, finalFragment });

    const programKey = finalVertex + finalFragment;

    if (!programCache.has(programKey)) {
      if (!shaderCache.has(finalVertex)) {
        // compile vertex shader and log errors
        const vertexShader = gl.createShader(gl.VERTEX_SHADER);
        gl.shaderSource(vertexShader, finalVertex);
        gl.compileShader(vertexShader);
        const log = gl.getShaderInfoLog(vertexShader);
        if (log !== "") logError(log, finalVertex);
        shaderCache.set(vertex, vertexShader);
      }

      if (!shaderCache.has(finalFragment)) {
        // compile fragment shader and log errors
        const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
        gl.shaderSource(fragmentShader, finalFragment);
        gl.compileShader(fragmentShader);
        const log = gl.getShaderInfoLog(fragmentShader);
        if (log !== "") logError(log, finalFragment);
        shaderCache.set(fragment, fragmentShader);
      }

      // compile program and log errors
      const program = gl.createProgram();
      gl.attachShader(program, shaderCache.get(vertex));
      gl.attachShader(program, shaderCache.get(fragment));
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        throw new Error(gl.getProgramInfoLog(program));
      }

      programCache.set(programKey, program);
    }

    const program = programCache.get(programKey);
    setProgram(program);

    // Prepare VAO
    const vao = gl.createVertexArray();
    setVao(vao);

    // Prepare elements
    if (elements) {
      elementsContext = createContext("ELEMENTS", elements, {
        BUFFER_BINDING: "ELEMENT_ARRAY_BUFFER",
      });
      elementsContext.create();
    }

    // Prepare attributes
    for (let i = gl.getProgramParameter(program, gl.ACTIVE_ATTRIBUTES) - 1; i >= 0; i--) {
      const { name } = gl.getActiveAttrib(program, i);
      const location = gl.getAttribLocation(program, name);
      const context =
        attributes.find((state) => name === state.name) ||
        instancedAttributes.find((state) => name === state.name);

      if (location === -1 || !context.buffer) {
        console.warn(`Failed ${name}`);
        continue;
      }

      if (context.contextType === "instancedBuffer") {
        gl.vertexAttribDivisor(location, 1);
      }

      gl.enableVertexAttribArray(location);
      setBuffer(context.buffer);
      gl.vertexAttribPointer(location, context.dimensions, gl[context.bufferType], false, 0, 0);
    }

    setVao();

    // Count vertices
    state.countVertices();

    // Prepare uniform blocks
    for (let i = gl.getProgramParameter(program, gl.ACTIVE_UNIFORM_BLOCKS) - 1; i >= 0; i--) {
      const name = gl.getActiveUniformBlockName(program, i);
      const index = gl.getUniformBlockIndex(program, name);

      const context = uniformBlocks.find((state) => name === state.name);

      if (index === -1 || context.bindIndex === undefined) {
        console.warn(`Failed ${name}`);
        continue;
      }

      gl.uniformBlockBinding(program, index, context.bindIndex);
    }

    // Prepare textures
    const totalUniforms = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
    const indexes = [...Array(totalUniforms).keys()];
    const blockIndexes = gl.getActiveUniforms(program, indexes, gl.UNIFORM_BLOCK_INDEX);
    const indexesOfNonBlockUniforms = indexes.filter((index) => blockIndexes[index] === -1);

    for (const i of indexesOfNonBlockUniforms) {
      const { name } = gl.getActiveUniform(program, i);
      const location = gl.getUniformLocation(program, name);

      const context = textures.find((state) => state.name === name);

      if (location === -1 || context.index === undefined) {
        console.warn(`Failed ${name}`);
        continue;
      }

      gl.uniform1i(location, context.index);
    }

    // Handle instances
    const createInstances = () => {
      if (debug) console.log("Creating instances", state, instances);

      let isFirstBuffer = true;
      offsets.clear();
      for (const { name, refill, dimensions, BatchConstructor } of instancedAttributes) {
        const batch = new BatchConstructor(dimensions * instances.size);

        for (const instance of instances) {
          if (isFirstBuffer) {
            offsets.set(instance, offsets.size);
          }

          const value = instance[name];

          if (dimensions === 1) {
            batch[offsets.get(instance) * dimensions] = value;
          } else {
            batch.set(value, offsets.get(instance) * dimensions);
          }
        }

        refill(batch);
        isFirstBuffer = false;
      }

      instancesNeedToBeRecreated = false;
    };

    // Prepare for rendering
    const glMode = gl[mode];
    const glUnsignedShort = gl.UNSIGNED_SHORT;
    const elementsLength = elements ? elements.length : 0;

    state.render = () => {
      if (!shouldRender()) return;

      if (!state.created) {
        if (renderer.gl) {
          state.create();
        } else {
          return;
        }
      }

      if (instancesNeedToBeRecreated) {
        createInstances();
      }

      if (instanceCount === 0) {
        return;
      }

      if (debug) console.log("Rendering", instanceCount, state);

      setProgram(program);
      setVao(vao);
      setDepth(depth);
      setCull(cull);

      if (elementsContext) {
        gl.drawElementsInstanced(glMode, elementsLength, glUnsignedShort, 0, instanceCount);
      } else {
        gl.drawArraysInstanced(glMode, 0, state.count, instanceCount);
      }

      setVao();
    };

    for (const update of pendingInstanceUpdates) {
      state.updateInstance(...update);
    }
    pendingInstanceUpdates.clear();

    state.created = true;
    requestRendering();
  };

  state.destroy = () => {
    state.created = false;
  };

  if (renderer.gl) {
    state.create();
  }

  const id = commands.size;
  state.id = id;
  commands.set(id, state);
  sortCommands();
  return state;
};

const sortCommands = () => {
  const list = [...commands].sort(([, a], [, b]) => a.order - b.order);
  commands.clear();
  list.forEach(([key, value]) => commands.set(key, value));
};

let instancedBufferCounter = 0;

const createContext = (
  name,
  context,
  { isInstanced = false, BUFFER_BINDING = "ARRAY_BUFFER" } = blankObject
) => {
  const isElements = BUFFER_BINDING === "ELEMENT_ARRAY_BUFFER";

  if (!isInstanced && contexts.has(context)) {
    const result = getContext(context);

    if (!result.created && context.gl) {
      result.create();
    }

    if (!result.name) {
      result.name = name;
    }

    return result;
  }

  let type;

  if (isInstanced) {
    type = "instancedBuffer";
  } else if (Array.isArray(context) || ArrayBuffer.isView(context)) {
    type = "buffer";
  } else if (context.sampler) {
    type = "texture";
  } else {
    type = "uniformBlock";
  }

  const state = { name, contextType: type, created: false };

  const pendingUpdates = new Set();
  const boundComponents = new Set();

  state.bindTo = (component) => boundComponents.add(component);

  if (isInstanced) {
    state.defaultValue = context;
  }

  let firstDirty = Infinity;
  let lastDirty = 0;

  if (type === "buffer" || isInstanced) {
    // buffer
    let buffer, usage;

    const [bufferType, shaderType] = isElements
      ? ["UNSIGNED_SHORT", "int"]
      : dataToTypes(isInstanced ? context : context[0]);
    state.bufferType = bufferType;
    state.shaderType = shaderType;
    state.dimensions = (isInstanced ? context : context[0]).length || 1;
    state.BatchConstructor = bufferTypeToConstructor(bufferType);

    state.create = () => {
      const { gl, setBuffer } = renderer;
      buffer = gl.createBuffer();
      state.buffer = buffer;
      setBuffer(buffer, gl[BUFFER_BINDING]);

      const data = new state.BatchConstructor(
        isInstanced
          ? Array.isArray(context) || ArrayBuffer.isView(context)
            ? context
            : [context]
          : context.flatMap((v) => v)
      );

      if (!isInstanced) {
        state.count = context.length;
      }

      usage = isInstanced ? gl.DYNAMIC_DRAW : gl.STATIC_DRAW;

      state.created = true;
      state.refill(data);
      requestRendering();

      if (pendingUpdates.size) {
        for (const [isRefill, update] of pendingUpdates) {
          state[isRefill ? "refill" : "update"](...update);
        }
        pendingUpdates.clear();
      }

      if (renderer.debug)
        console.log(`Created ${isInstanced ? "prop" : "context"} buffer`, context, state);
    };

    state.refill = (data) => {
      if (state.created) {
        const { gl, setBuffer } = renderer;

        state.count = data.length / state.dimensions;
        state.allData = data;

        for (const component of boundComponents) {
          requestJob(component.countVertices);
        }

        setBuffer(buffer, gl[BUFFER_BINDING]);
        gl.bufferData(gl[BUFFER_BINDING], data, usage);
        requestRendering();
      } else {
        pendingUpdates.add([true, [data]]);
      }
    };

    state.update = (data, offset = 0) => {
      if (state.created) {
        const length = data.length;

        firstDirty = Math.min(offset, firstDirty);
        lastDirty = Math.max(offset + length, lastDirty);

        if (length) {
          state.allData.set(data, offset);
        } else {
          state.allData[offset] = data;
        }

        requestJob(state.commitUpdate);
      } else {
        pendingUpdates.add([data, offset]);
      }
    };

    state.commitUpdate = () => {
      if (renderer.debug)
        console.log("Updating buffer", state.name, state.allData, firstDirty, lastDirty);

      const { gl, setBuffer } = renderer;
      setBuffer(buffer, gl[BUFFER_BINDING]);
      gl.bufferSubData(
        gl[BUFFER_BINDING],
        firstDirty * state.allData.BYTES_PER_ELEMENT,
        state.allData,
        firstDirty,
        lastDirty - firstDirty
      );

      firstDirty = Infinity;
      lastDirty = 0;

      requestRendering();
    };
  } else if (type === "uniformBlock") {
    // uniformBlock
    let buffer;
    state.uniforms = {};
    const offsets = new Map();

    state.create = () => {
      const { gl, setBuffer } = renderer;

      state.bindIndex =
        state.bindIndex === undefined ? renderer.uniformBindIndexCounter++ : state.bindIndex;

      buffer = gl.createBuffer();
      setBuffer(buffer, gl.UNIFORM_BUFFER);
      gl.bindBufferBase(gl.UNIFORM_BUFFER, state.bindIndex, buffer);

      let byteCounter = 0;
      let elementCounter = 0;

      const uniforms = Object.entries(context).map(([name, value], index) => {
        const [, shaderType] = dataToTypes(value);
        const elementCount = value.length || 1;

        // std140 alignment rules
        const [alignment, size] =
          elementCount === 1 ? [1, 1] : elementCount === 2 ? [2, 2] : [4, elementCount];

        // std140 alignment padding
        // | a |...|...|...|b.x|b.y|b.z|b.w| c | d |...|...|
        const padding = (alignment - (elementCounter % alignment)) % alignment;
        elementCounter += padding;
        byteCounter += padding * 4;

        let data;
        if (Array.isArray(value) || ArrayBuffer.isView(value)) {
          data = value;
        } else {
          data = [value];
        }

        const uniform = {
          shaderType,
          padding,
          size,
          byteOffset: byteCounter,
          elementOffset: elementCounter,
          data,
        };

        state.uniforms[name] = uniform;
        offsets.set(name, uniform.elementOffset);

        elementCounter += size;
        byteCounter += size * 4;

        return uniform;
      });

      const endPadding = (4 - (elementCounter % 4)) % 4;
      elementCounter += endPadding;

      state.allData = new Float32Array(elementCounter);

      uniforms.forEach(({ data, elementOffset }) => state.allData.set(data, elementOffset));

      gl.bufferData(gl.UNIFORM_BUFFER, state.allData, gl.DYNAMIC_DRAW);

      state.created = true;
      requestRendering();

      if (pendingUpdates.size) {
        for (const update of pendingUpdates) {
          state.update(...update);
        }
        pendingUpdates.clear();
      }

      if (renderer.debug) console.log("Created context uniform block", context, state);
    };

    state.update = (key, data) => {
      if (state.created) {
        const length = data.length || 1;
        const offset = offsets.get(key);

        firstDirty = Math.min(offset, firstDirty);
        lastDirty = Math.max(offset + length, lastDirty);

        if (data.length) {
          state.allData.set(data, offset);
        } else {
          state.allData[offset] = data;
        }

        requestJob(state.commitUpdate);
      } else {
        pendingUpdates.add([key, data]);
      }
    };

    state.commitUpdate = () => {
      if (renderer.debug)
        console.log("Updating uniform block", state.name, state.allData, firstDirty, lastDirty);

      const { gl, setBuffer } = renderer;
      setBuffer(buffer, gl.UNIFORM_BUFFER);
      gl.bufferSubData(
        gl.UNIFORM_BUFFER,
        firstDirty * state.allData.BYTES_PER_ELEMENT,
        state.allData,
        firstDirty,
        lastDirty - firstDirty
      );

      firstDirty = Infinity;
      lastDirty = 0;

      requestRendering();
    };
  } else if (type === "texture") {
    // Texture
    let texture;
    let _TEXTURE_2D;
    let _level, _format, _type;

    state.create = () => {
      const { gl, setTexture } = renderer;
      texture = gl.createTexture();
      setTexture(texture);
      state.index = textureIndexes.get(texture);

      const {
        sampler = "sampler2D",
        level = 0,
        format = "RGBA",
        internalFormat = "RGBA32F",
        type = "FLOAT",
        channels = 4,
        border = 0,
        offset,
        pixels: inputPixels,
        width: inputWidth,
        height: inputHeight,
        ...inputParameters
      } = context;

      const pixelsAreABuffer = !inputPixels || ArrayBuffer.isView(inputPixels);
      const width = pixelsAreABuffer && (inputWidth || 64);
      const height = pixelsAreABuffer && (inputHeight || 64);
      state.allData = context.pixels || new Float32Array(width * height * channels);

      state.shaderType = sampler;
      _level = level;
      _format = gl[format];
      _type = gl[type];

      const parameters = {
        TEXTURE_MAG_FILTER: "NEAREST",
        TEXTURE_MIN_FILTER: "NEAREST",
        ...inputParameters,
      };

      for (const key in parameters) {
        gl.texParameteri(gl.TEXTURE_2D, gl[key], gl[parameters[key]]);
      }

      if (pixelsAreABuffer) {
        gl.texImage2D(
          gl.TEXTURE_2D,
          level,
          gl[internalFormat],
          width,
          height,
          border,
          _format,
          _type,
          state.allData,
          offset
        );
      } else {
        gl.texImage2D(gl.TEXTURE_2D, level, gl[internalFormat], _format, _type, state.allData);
      }

      _TEXTURE_2D = gl.TEXTURE_2D;

      state.created = true;
      requestRendering();

      if (pendingUpdates.size) {
        for (const update of pendingUpdates) {
          state.update(...update);
        }
        pendingUpdates.clear();
      }

      if (renderer.debug) console.log("Created context texture", context, state);
    };

    state.update = (data, x = 0, y = 0, width = 1, height = 1, dataOffset) => {
      if (state.created) {
        const { gl, setTexture } = renderer;
        setTexture(texture);

        gl.texSubImage2D(
          _TEXTURE_2D,
          _level,
          x,
          y,
          width,
          height,
          _format,
          _type,
          data,
          dataOffset
        );
      } else {
        pendingUpdates.add([data, x, y, width, height, dataOffset]);
      }

      requestRendering();
    };
  } else {
    throw new Error("Unknown context type");
  }

  state.destroy = () => {
    state.created = false;
  };

  contexts.set(isInstanced ? "instancedBuffer-" + instancedBufferCounter++ : context, state);

  if (context.gl && !state.created) {
    state.create();
  }

  return state;
};

export const getContext = (context) => {
  if (!contexts.has(context)) {
    createContext(undefined, context);
  }

  return contexts.get(context);
};

export const render = () => {
  renderer.clear();
  for (const [, command] of commands) {
    command.render();
  }
  needsRendering = false;
};

const dataToTypes = (data) => {
  if (typeof data === "number") {
    return ["FLOAT", "float"];
  }

  if (typeof data === "boolean") {
    return ["BYTE", "bool"];
  }

  if (Array.isArray(data)) {
    return ["FLOAT", data.length > 4 ? `mat${Math.sqrt(data.length)}` : `vec${data.length}`];
  }

  switch (data.constructor.name) {
    case "Float32Array":
      return ["FLOAT", data.length > 4 ? `mat${Math.sqrt(data.length)}` : `vec${data.length}`];
    case "Int8Array":
      return ["BYTE", `ivec${data.length}`];
    case "Uint8Array":
    case "Uint8ClampedArray":
      return ["UNSIGNED_BYTE", `uvec${data.length}`];
    case "Int16Array":
      return ["SHORT", `ivec${data.length}`];
    case "Uint16Array":
      return ["UNSIGNED_SHORT", `uvec${data.length}`];
    default:
      throw new Error("Finding types failed");
  }
};

const bufferTypeToConstructor = (type) => {
  switch (type) {
    case "BYTE":
      return Int8Array;
    case "UNSIGNED_BYTE":
      return Uint8Array;
    case "SHORT":
      return Int16Array;
    case "UNSIGNED_SHORT":
      return Uint16Array;
    default:
      return Float32Array;
  }
};

const logError = (log, shader) => {
  const position = log.match(/(\d+:\d+)/g)[0];
  if (position) {
    const [, lineNumber] = position.split(":");
    let lineIndex = 1;
    for (const line of shader.split("\n")) {
      if (Math.abs(lineIndex - lineNumber) < 8) {
        console[lineIndex === +lineNumber ? "warn" : "log"](`${lineIndex} ${line}`);
      }
      lineIndex++;
    }
  }
};
