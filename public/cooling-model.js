(function(root) {
  'use strict';

  // Pure curve math shared by the preview and the controller. Inputs are ordered
  // [temperature, percent] pairs; saving/validating them belongs to cooling-config.
  function between(a, b, position, interpolation) {
    const ratio = interpolation === 'smooth'
      ? position * position * (3 - 2 * position)
      : position;
    return a[1] + (b[1] - a[1]) * ratio;
  }

  function valueAt(points, temperature, interpolation = 'linear') {
    if (temperature <= points[0][0]) return points[0][1];
    for (let i = 1; i < points.length; i++) {
      if (temperature <= points[i][0]) {
        const a = points[i - 1], b = points[i];
        return between(a, b, (temperature - a[0]) / (b[0] - a[0]), interpolation);
      }
    }
    return points.at(-1)[1];
  }

  function plot(points, interpolation = 'linear') {
    const result = [], steps = interpolation === 'smooth' ? 20 : 1;
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1], b = points[i];
      for (let j = 0; j < steps; j++) {
        const position = j / steps;
        result.push([a[0] + (b[0] - a[0]) * position, between(a, b, position, interpolation)]);
      }
    }
    if (points.length) result.push(points.at(-1));
    return result;
  }

  const api = {valueAt, plot};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.NexusCoolingModel = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
