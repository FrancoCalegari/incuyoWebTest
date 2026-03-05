/**
 * Admin authentication middleware
 */
function requireAdmin(req, res, next) {
    if (req.session && req.session.isAdmin) {
        return next();
    }
    if (req.xhr || req.path.startsWith('/admin/api')) {
        return res.status(401).json({ error: 'No autorizado' });
    }
    return res.redirect('/admin/login');
}

module.exports = { requireAdmin };
