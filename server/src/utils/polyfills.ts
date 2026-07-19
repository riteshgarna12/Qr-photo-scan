import { TextEncoder, TextDecoder } from 'util';
import Module from 'module';

// Intercept require calls to redirect @tensorflow/tfjs-node to the pure JS @tensorflow/tfjs package.
// This allows us to use face-api's optimized Node build without compiling native binaries.
const originalRequire = Module.prototype.require;
Module.prototype.require = function (id: string) {
  if (id === '@tensorflow/tfjs-node') {
    return originalRequire.call(this, '@tensorflow/tfjs');
  }
  return originalRequire.call(this, id);
};

// Set up globals for TensorFlow/Face-API compatibility in Node context
(global as any).TextEncoder = TextEncoder;
(global as any).TextDecoder = TextDecoder;

if (!(global as any).util) {
  (global as any).util = {};
}
(global as any).util.TextEncoder = TextEncoder;
(global as any).util.TextDecoder = TextDecoder;
