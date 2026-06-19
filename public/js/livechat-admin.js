// ─── Live Chat Admin Panel ─────────────────────────────────────────────────
// Archivo: /public/js/livechat-admin.js

var lcCurrentSessionId = null;
var lcPollSessionInterval = null;
var lcPollListInterval = null;
var lcLastMsgId = 0;
var lcSessionsCache = [];
var _lcNotifiedSessions = {};

function lcEsc(s) {
    var d = document.createElement('div');
    d.appendChild(document.createTextNode(String(s)));
    return d.innerHTML.replace(/\n/g, '<br>');
}

function lcFormatDate(dt) {
    try { return new Date(dt).toLocaleString('es-AR'); }
    catch(e) { return dt; }
}

// ─── Inicializar tablas ────────────────────────────────────────────────────
function lcInitTables() {
    var btn = document.getElementById('lcInitTablesBtn');
    if (btn) btn.disabled = true;
    fetch('/admin/api/init-chat-tables', { method: 'POST' })
        .then(function(r) { return r.json(); })
        .then(function(d) {
            if (typeof showToast === 'function') showToast(d.success ? 'Tablas de chat creadas' : (d.error || 'Error'));
            if (d.success) lcLoadSessions();
        })
        .catch(function(e) { if (typeof showToast === 'function') showToast('Error: ' + e.message); })
        .finally(function() { if (btn) btn.disabled = false; });
}

// ─── Cargar sesiones ──────────────────────────────────────────────────────
function lcLoadSessions() {
    var icon = document.getElementById('lcRefreshIcon');
    if (icon) icon.classList.add('fa-spin');

    fetch('/admin/api/chat-sessions')
        .then(function(r) { return r.json(); })
        .then(function(sessions) {
            if (!Array.isArray(sessions)) throw new Error((sessions && sessions.error) || 'Respuesta inválida');
            lcSessionsCache = sessions;
            lcRenderSessionsList(sessions);
            lcUpdateBadge(sessions);
            lcCheckAndNotify(sessions);
        })
        .catch(function(e) {
            var el = document.getElementById('lcSessionsList');
            if (el) el.innerHTML = '<div style="text-align:center;padding:2rem;color:#e53e3e;"><i class="fas fa-exclamation-triangle"></i> ' + lcEsc(e.message) + '<br><small>Hint: Usá "Inicializar BD" si es la primera vez.</small></div>';
        })
        .finally(function() {
            if (icon) icon.classList.remove('fa-spin');
        });
}

// ─── Renderizar lista ──────────────────────────────────────────────────────
function lcRenderSessionsList(sessions) {
    var el = document.getElementById('lcSessionsList');
    if (!el) return;

    if (!sessions || !sessions.length) {
        el.innerHTML = '<div style="text-align:center;padding:3rem;color:#aaa;"><i class="fas fa-comment-slash" style="font-size:3rem;display:block;margin-bottom:1rem;opacity:0.3;"></i><p>No hay sesiones activas en las últimas 48 horas.</p></div>';
        return;
    }

    var html = '<div class="lc-sessions-grid">';
    sessions.forEach(function(s) {
        var isWaiting = s.status === 'waiting';
        var isActive  = s.status === 'active';
        var cardClass = 'lc-session-card' + (isWaiting ? ' lc-session-card--waiting' : '') + (isActive ? ' lc-session-card--active' : '');
        var statusHtml = isWaiting
            ? '<span class="lc-status-badge lc-status-badge--waiting"><i class="fas fa-clock"></i> Esperando</span>'
            : isActive
            ? '<span class="lc-status-badge lc-status-badge--active"><i class="fas fa-circle"></i> En curso</span>'
            : '<span class="lc-status-badge lc-status-badge--closed"><i class="fas fa-times-circle"></i> Cerrado</span>';

        html += '<div class="' + cardClass + '" onclick="lcOpenSession(\'' + s.id + '\')" style="cursor:pointer;">';
        html += '<div class="lc-session-card__header">' + statusHtml + '<span class="lc-session-msgs"><i class="fas fa-comments"></i> ' + (s.msg_count || 0) + '</span></div>';
        html += '<div class="lc-session-card__id">ID: ' + s.id.substring(0, 8) + '...</div>';
        html += '<div class="lc-session-card__meta"><span><i class="fas fa-clock"></i> ' + lcFormatDate(s.created_at) + '</span>' + (s.admin_name ? '<span><i class="fas fa-user"></i> ' + lcEsc(s.admin_name) + '</span>' : '') + '</div>';
        html += '</div>';
    });
    html += '</div>';
    el.innerHTML = html;
}

// ─── Badge del sidebar ────────────────────────────────────────────────────
function lcUpdateBadge(sessions) {
    var waiting = sessions.filter(function(s) { return s.status === 'waiting' || s.status === 'active'; }).length;
    var badge = document.getElementById('livechatBadge');
    if (!badge) return;
    badge.textContent = waiting;
    badge.style.display = waiting > 0 ? 'inline-block' : 'none';
}

// ─── Notificaciones ────────────────────────────────────────────────────────
function lcCheckAndNotify(sessions) {
    sessions.forEach(function(s) {
        if (s.status !== 'waiting' || _lcNotifiedSessions[s.id]) return;
        _lcNotifiedSessions[s.id] = true;
        lcBrowserNotify(s.id);
    });
}

function lcBrowserNotify(sessionId) {
    if (!('Notification' in window)) return;
    var short = sessionId.substring(0, 8);
    var doNotify = function() {
        new Notification('Nuevo chat - INCUYO', { body: 'Un visitante solicita asistencia. ID: ' + short, icon: '/assets/img/logo.png' });
    };
    if (Notification.permission === 'granted') {
        doNotify();
    } else if (Notification.permission !== 'denied') {
        Notification.requestPermission().then(function(p) { if (p === 'granted') doNotify(); });
    }
}

// ─── Abrir sesión ──────────────────────────────────────────────────────────
function lcOpenSession(sessionId) {
    lcCurrentSessionId = sessionId;
    lcLastMsgId = 0;

    var detail = document.getElementById('lcChatDetail');
    var idEl   = document.getElementById('lcDetailSessionId');
    var area   = document.getElementById('lcMessagesArea');

    if (detail) detail.style.display = 'block';
    if (idEl)   idEl.textContent = sessionId;
    if (area)   area.innerHTML = '<div style="text-align:center;padding:1rem;color:#aaa;"><i class="fas fa-spinner fa-spin"></i> Cargando...</div>';
    if (detail) detail.scrollIntoView({ behavior: 'smooth' });

    lcLoadMessages(sessionId);

    if (lcPollSessionInterval) clearInterval(lcPollSessionInterval);
    lcPollSessionInterval = setInterval(function() { lcLoadMessages(sessionId); }, 5000);

    var sess = lcSessionsCache.find(function(s) { return s.id === sessionId; });
    var takeBtn = document.getElementById('lcTakeControlBtn');
    if (takeBtn && sess) takeBtn.style.display = sess.status === 'waiting' ? 'inline-flex' : 'none';
}

function lcLoadMessages(sessionId) {
    fetch('/admin/api/chat-sessions/' + sessionId + '/messages')
        .then(function(r) { return r.json(); })
        .then(function(data) {
            if (data.messages) lcRenderMessages(data.messages);
            if (data.session) {
                var takeBtn = document.getElementById('lcTakeControlBtn');
                if (takeBtn) takeBtn.style.display = data.session.status === 'waiting' ? 'inline-flex' : 'none';
            }
        })
        .catch(function(e) { console.error('[LC Admin] messages error:', e); });
}

function lcRenderMessages(messages) {
    var area = document.getElementById('lcMessagesArea');
    if (!area) return;
    var html = '';
    messages.forEach(function(msg) {
        if (msg.id > lcLastMsgId) lcLastMsgId = msg.id;
        var cls   = msg.role === 'user'  ? 'lc-msg lc-msg--user'
                  : msg.role === 'admin' ? 'lc-msg lc-msg--admin'
                  : 'lc-msg lc-msg--bot';
        var label = msg.role === 'user'  ? '&#128100; Visitante'
                  : msg.role === 'admin' ? '&#128100; Admin'
                  : '&#129302; Asistente IA';
        html += '<div class="' + cls + '">';
        html += '<span class="lc-msg__label">' + label + '</span>';
        html += '<div class="lc-msg__bubble">' + lcEsc(msg.content) + '</div>';
        html += '<span class="lc-msg__time">' + lcFormatDate(msg.created_at) + '</span>';
        html += '</div>';
    });
    area.innerHTML = html;
    area.scrollTop = area.scrollHeight;
}

// ─── Tomar control ────────────────────────────────────────────────────────
function lcTakeControl() {
    if (!lcCurrentSessionId) return;
    fetch('/admin/api/chat-sessions/' + lcCurrentSessionId + '/take-control', { method: 'POST' })
        .then(function(r) { return r.json(); })
        .then(function(d) {
            if (d.success) {
                if (typeof showToast === 'function') showToast('Control tomado correctamente');
                var btn = document.getElementById('lcTakeControlBtn');
                if (btn) btn.style.display = 'none';
                lcLoadSessions();
            }
        })
        .catch(function(e) { if (typeof showToast === 'function') showToast('Error: ' + e.message); });
}

// ─── Enviar mensaje admin ─────────────────────────────────────────────────
function lcSendAdminMessage() {
    if (!lcCurrentSessionId) return;
    var input   = document.getElementById('lcAdminInput');
    var content = input ? input.value.trim() : '';
    if (!content) return;
    if (input) input.value = '';

    fetch('/admin/api/chat-sessions/' + lcCurrentSessionId + '/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: content })
    })
    .then(function() { lcLoadMessages(lcCurrentSessionId); })
    .catch(function(e) { if (typeof showToast === 'function') showToast('Error: ' + e.message); });
}

// ─── Cerrar sesión ────────────────────────────────────────────────────────
function lcCloseSession() {
    if (!lcCurrentSessionId) return;
    if (!confirm('¿Cerrar esta sesión de chat?')) return;
    fetch('/admin/api/chat-sessions/' + lcCurrentSessionId + '/close', { method: 'POST' })
        .then(function() {
            if (typeof showToast === 'function') showToast('Sesión cerrada');
            lcHideDetail();
            lcLoadSessions();
        })
        .catch(function(e) { if (typeof showToast === 'function') showToast('Error: ' + e.message); });
}

// ─── Borrar sesión ────────────────────────────────────────────────────────
function lcDeleteSession() {
    if (!lcCurrentSessionId) return;
    if (!confirm('¿Estás seguro de que querés ELIMINAR PERMANENTEMENTE esta sesión y todos sus mensajes?')) return;
    fetch('/admin/api/chat-sessions/' + lcCurrentSessionId + '/delete', { method: 'POST' })
        .then(function() {
            if (typeof showToast === 'function') showToast('Sesión eliminada');
            lcHideDetail();
            lcLoadSessions();
        })
        .catch(function(e) { if (typeof showToast === 'function') showToast('Error: ' + e.message); });
}

function lcHideDetail() {
    var d = document.getElementById('lcChatDetail');
    if (d) d.style.display = 'none';
    lcCurrentSessionId = null;
    if (lcPollSessionInterval) { clearInterval(lcPollSessionInterval); lcPollSessionInterval = null; }
}

// ─── Enter para enviar ────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', function() {
    var lcInput = document.getElementById('lcAdminInput');
    if (lcInput) {
        lcInput.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); lcSendAdminMessage(); }
        });
    }
});
