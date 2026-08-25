'use strict';
/** Tiny cookie middleware. Two cookies are all this station needs. */
module.exports = function cookies(req, res, next) {
  req.cookies = {};
  const header = req.headers.cookie;
  if (header) {
    for (const part of header.split(';')) {
      const i = part.indexOf('=');
      if (i < 0) continue;
      const k = part.slice(0, i).trim();
      if (k) req.cookies[k] = decodeURIComponent(part.slice(i + 1).trim());
    }
  }
  res.cookie = (name, value, opts = {}) => {
    const bits = [`${name}=${encodeURIComponent(value)}`, `Path=${opts.path || '/'}`];
    if (opts.maxAge) bits.push(`Max-Age=${Math.floor(opts.maxAge / 1000)}`);
    if (opts.httpOnly !== false) bits.push('HttpOnly');
    if (opts.secure) bits.push('Secure');
    bits.push(`SameSite=${opts.sameSite || 'Lax'}`);
    const prev = res.getHeader('Set-Cookie');
    res.setHeader('Set-Cookie', prev ? [].concat(prev, bits.join('; ')) : bits.join('; '));
    return res;
  };
  res.clearCookie = (name) => res.cookie(name, '', { maxAge: 0 });
  next();
};
