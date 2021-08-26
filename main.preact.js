import { h } from "preact";
import { useRef, useEffect, useCallback } from "preact/hooks";

import {
  createRenderer,
  component as baseComponent,
  subscribeToAnimationFrame,
  unsubscribeFromAnimationFrame,
} from "./main.js";
export * from "./main.js";

export const Canvas = ({ attributes, pixelRatio, debug, clearColor, ...rest }) => {
  const ref = useRef();
  useCanvas(ref, { attributes, pixelRatio, debug, clearColor });
  return h("canvas", {
    ref,
    ...rest,
  });
};

export const useCanvas = (elementOrRef, config) => {
  useEffect(() => {
    const canvas = elementOrRef.current || elementOrRef;
    const renderer = createRenderer(canvas, config);

    return () => {
      renderer.destroy();
    };
  }, [elementOrRef, ...Object.keys(config), ...Object.values(config)]);
};

export const component = (...args) => {
  const elem = baseComponent(...args);
  const WebGL2Component = ({ children = null, ...props }) => {
    useComponent(elem, props);
    return children;
  };

  return WebGL2Component;
};

export const useComponent = (component, props, enabled = true) => {
  const ref = useRef({ ...props });
  const { addInstance, deleteInstance, updateInstance } = component;

  useEffect(() => {
    if (enabled) {
      const instance = ref.current;
      addInstance(instance);
      return () => deleteInstance(instance);
    }
  }, [enabled, addInstance, deleteInstance]);

  const instance = ref.current;

  const update = useCallback(
    (name, value) => updateInstance(instance, name, value),
    [instance, updateInstance]
  );

  // Update data from props
  for (const key in props) {
    const oldValue = instance[key];
    const newValue = props[key];

    if (key !== "children" && oldValue !== newValue) {
      instance[key] = newValue;
      update(
        key,
        ArrayBuffer.isView(newValue)
          ? newValue
          : Array.isArray(newValue)
          ? new Float32Array(newValue)
          : Float32Array.of(newValue)
      );
    }
  }

  return [instance, update];
};

export const useAnimationFrame = (callback, nthFrame = 1) => {
  useEffect(() => {
    if (callback) {
      subscribeToAnimationFrame(callback, nthFrame);
      return unsubscribeFromAnimationFrame(callback, nthFrame);
    }
  }, [callback, nthFrame]);
};
