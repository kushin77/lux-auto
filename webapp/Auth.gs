/**
 * Access control. Runs server-side only.
 *
 * - If ALLOWED_EMAILS is set, only those users may load the app (defense in depth
 *   on top of the manifest's "access": "DOMAIN").
 * - ADMIN_EMAILS get write actions (move/approve/reject deals).
 */

function currentUser_() {
  var email = (Session.getActiveUser().getEmail() || '').toLowerCase();
  var admins = emailList_('ADMIN_EMAILS');
  return {
    email: email,
    name: email ? email.split('@')[0] : 'guest',
    role: admins.indexOf(email) !== -1 ? 'admin' : 'user',
    isAdmin: admins.indexOf(email) !== -1
  };
}

/** Throws if the caller isn't allowed. Returns the user when allowed. */
function assertAccess_() {
  var user = currentUser_();
  var allow = emailList_('ALLOWED_EMAILS');
  if (allow.length && allow.indexOf(user.email) === -1) {
    throw new Error('ACCESS_DENIED');
  }
  return user;
}

function assertAdmin_() {
  var user = assertAccess_();
  if (!user.isAdmin) throw new Error('ADMIN_REQUIRED');
  return user;
}
