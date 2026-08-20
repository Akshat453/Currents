export const ok = (res, data, meta, status = 200) =>
  res.status(status).json(meta ? { data, meta } : { data });
