'use strict';
/**
 * The crew's names as the station shows them. The first officer is filed as
 * COMMUNICATION OFFICER — the key their Commander Blog, their daily figures,
 * their mood and their answers are stored under, in content/ and in the
 * database — and is shown everywhere as the Commanding Officer: the same
 * person, the same role (they relay and answer the messages from Earth), a
 * new title. Only what is shown changes, so nothing filed under the old key
 * can be lost; `shown` turns a stored designation into the one on the page,
 * in whatever case it was written.
 */
const RENAMED = [['COMMUNICATION OFFICER', 'COMMANDING OFFICER']];

function shown(designation) {
  let s = String(designation == null ? '' : designation);
  for (const [from, to] of RENAMED) {
    s = s.replace(new RegExp(from, 'gi'), (hit) => (hit === hit.toUpperCase() ? to
      : hit === hit.toLowerCase() ? to.toLowerCase()
        : hit.charAt(0) === hit.charAt(0).toUpperCase() && hit.slice(1) === hit.slice(1).toLowerCase() ? to.charAt(0) + to.slice(1).toLowerCase()
          : to.split(' ').map((w) => w.charAt(0) + w.slice(1).toLowerCase()).join(' ')));
  }
  return s;
}

module.exports = { shown, RENAMED };
