import { create, perspective, ortho, lookAt, multiply, invert } from "gl-mat4-esm";
import { getContext, resizeSubscribers, requestJob } from "./main.js";

const createCamera = (props = {}) => {
  let { fov, near = 0.1, far = 1000, zoom = 1, include = {} } = props;
  const {
    position: includePosition = false,
    target: includeTarget = false,
    direction: includeDirection = false,
    up: includeUp = false,
    near: includeNear = false,
    far: includeFar = false,
    zoom: includeZoom = false,
    fov: includeFov = false,
    projection: includeProjection = true,
    view: includeView = true,
    projectionView: includeProjectionView = false,
    inverseProjectionView: includeInverseProjectionView = false,
    devicePixelRatio: includeDevicePixelRatio = false,
  } = include;

  let width = window?.innerWidth || 1;
  let height = window?.innerHeight || 1;
  let devicePixelRatio = window.devicePixelRatio;
  let projectionNeedsUpdate = true;

  const projection = create();
  const view = create();
  const projectionView = create();
  const inverseProjectionView = create();
  const position = Float32Array.from(props.position || [0, 0, 1]);
  const target = Float32Array.from(props.target || [0, 0, 0]);
  const up = Float32Array.from(props.up || [0, 1, 0]);
  const direction = Float32Array.from([0, 0, -1]);

  const calculateDirection = () => {
    direction[0] = target[0] - position[0];
    direction[1] = target[1] - position[1];
    direction[2] = target[2] - position[2];

    const sum =
      direction[0] * direction[0] + direction[1] * direction[1] + direction[2] * direction[2];
    const magnitude = Math.sqrt(sum);

    direction[0] /= magnitude;
    direction[1] /= magnitude;
    direction[2] /= magnitude;
  };

  const context = {};
  if (includePosition) context.cameraPosition = position;
  if (includeTarget) context.cameraTarget = target;
  if (includeDirection) context.cameraDirection = direction;
  if (includeUp) context.cameraUp = up;
  if (includeNear) context.cameraNear = near;
  if (includeFar) context.cameraFar = far;
  if (includeZoom) context.cameraZoom = zoom;
  if (includeFov) context.cameraFov = fov;
  if (includeProjection) context.projection = projection;
  if (includeView) context.view = view;
  if (includeProjectionView) context.projectionView = projectionView;
  if (includeInverseProjectionView) context.inverseProjectionView = inverseProjectionView;
  if (includeDevicePixelRatio) context.devicePixelRatio = devicePixelRatio;

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

    if (includeProjection) updateContext("projection", projection);
    if (includeNear) updateContext("cameraNear", near);
    if (includeFar) updateContext("cameraFar", far);
    if (includeZoom) updateContext("cameraZoom", zoom);
    if (includeFov) updateContext("cameraFov", fov);
  };

  const updateView = () => {
    lookAt(view, position, target, up);

    if (includePosition) updateContext("cameraPosition", position);
    if (includeTarget) updateContext("cameraTarget", target);
    if (includeUp) updateContext("cameraUp", up);

    if (includeDirection) {
      calculateDirection();
      updateContext("cameraDirection", direction);
    }

    if (includeView) updateContext("view", view);
  };

  const updateCombined = () => {
    multiply(projectionView, projection, view);
    invert(inverseProjectionView, projectionView);

    if (includeProjectionView) updateContext("projectionView", projectionView);
    if (includeInverseProjectionView) updateContext("inverseProjectionView", inverseProjectionView);
  };

  const update = () => {
    if (projectionNeedsUpdate) requestJob(updateProjection);
    requestJob(updateView);
    requestJob(updateCombined);
  };

  const updateDevicePixelRatio = () => {
    updateContext("devicePixelRatio", devicePixelRatio);
  };

  update();

  resizeSubscribers.add((x, y, drawingBufferWidth, drawingBufferHeight, ratio) => {
    width = drawingBufferWidth;
    height = drawingBufferHeight;

    requestJob(updateProjection);
    requestJob(updateCombined);

    if (includeDevicePixelRatio && ratio !== devicePixelRatio) {
      devicePixelRatio = ratio;
      requestJob(updateDevicePixelRatio);
    }
  });

  const camera = {
    projection,
    view,
    projectionView,
    inverseProjectionView,
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
