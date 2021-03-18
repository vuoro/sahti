import { create, perspective, ortho, lookAt } from "gl-mat4-esm";
import { getContext, resizeSubscribers, requestJob } from "./main.js";

const createCamera = (props = {}) => {
  let { fov = 30, near = 0.01, far = 10, zoom = 1 } = props;
  const { includeInContext = ["projection", "view", "cameraPosition", "cameraTarget"] } = props;

  let width = window.innerWidth;
  let height = window.innerHeight;
  let projectionNeedsUpdate = true;

  const projection = create();
  const view = create();
  const position = Float32Array.of(0, 0, 1);
  const target = Float32Array.of(0, 0, 0);
  const up = Float32Array.of(0, 1, 0);

  const context = {
    projection,
    view,
    cameraPosition: position,
    cameraTarget: target,
    cameraUp: up,
  };

  for (const key in context) {
    if (!includeInContext.includes(key)) {
      delete context[key];
    }
  }

  const { update: updateContext } = getContext(context);

  const updateProjection = () => {
    if (fov !== undefined) {
      const aspect = width / height;
      const fovInRadians = (fov * Math.PI) / 180;
      const finalFov = aspect >= 1 ? fovInRadians : fovInRadians / (0.5 + aspect / 2);
      perspective(projection, finalFov, aspect, near, far);
    } else {
      const worldWidth = width > height ? width / height : 1;
      const worldHeight = width > height ? 1 : height / width;

      const left = -worldWidth / 2 / zoom;
      const right = worldWidth / 2 / zoom;
      const top = worldHeight / 2 / zoom;
      const bottom = -worldHeight / 2 / zoom;

      ortho(projection, left, right, bottom, top, near, far);
    }

    updateContext("projection", projection);
  };

  const updateView = () => {
    lookAt(view, position, target, up);
    updateContext("view", view);
  };

  const update = () => {
    if (projectionNeedsUpdate) requestJob(updateProjection);
    requestJob(updateView);
  };

  update();

  resizeSubscribers.add((x, y, drawingBufferWidth, drawingBufferHeight) => {
    width = drawingBufferWidth;
    height = drawingBufferHeight;
    requestJob(updateProjection);
  });

  const camera = {
    projection,
    view,
    position,
    target,
    up,
    update,

    get fov() {
      return fov;
    },
    get near() {
      return near;
    },
    get far() {
      return far;
    },
    get zoom() {
      return zoom;
    },

    set fov(input) {
      fov = input;
      projectionNeedsUpdate = true;
    },
    set near(input) {
      near = input;
      projectionNeedsUpdate = true;
    },
    set far(input) {
      far = input;
      projectionNeedsUpdate = true;
    },
    set zoom(input) {
      zoom = input;
      projectionNeedsUpdate = true;
    },
  };

  return [context, camera];
};

export default createCamera;
