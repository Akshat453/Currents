export class AppError extends Error {
  constructor(status, code, message, fields) {
    super(message);
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}
export const asyncRoute = (handler) => (req, res, next) =>
  Promise.resolve(handler(req, res, next)).catch(next);
export const assert = (condition, status, code, message) => {
  if (!condition) throw new AppError(status, code, message);
};
