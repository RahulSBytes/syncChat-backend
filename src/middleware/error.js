import { envMode } from "../index.js";

export function errorHandlerMiddleware(err, req, res, next) {
  const { status = 500, message = "something broke" } = err;

// modify status and message for other errors that may occur

  return res.status(status).json({
    success: false,
    message: envMode === 'DEVELOPMENT'? err : message,
  });
}

export function asyncWrapper(fn) {
  return function (req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

export class customError extends Error {
  constructor(message, status) {
    super();
    (this.status = status), (this.message = message);
  }
}
