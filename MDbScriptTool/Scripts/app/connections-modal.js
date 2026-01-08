/// <reference path="app.js" />

/**
 * Connection Information Dialog 
 */
(function (window, app, os, $) {
    const serverRegex = new RegExp('(?:Data Source|Server)=[^;]*;', 'i');
    const usernameRegex = new RegExp('User ID=[^;]*;', 'i');
    const passwordRegex = new RegExp('Password=[^;]*;', 'i');
    const integratedSecurityRegex = new RegExp('(?:Integrated Security|Trusted_Connection)=[^;]*;', 'i');
    const authenticationRegex = new RegExp('Authentication=[^;]*;', 'i');
    const databaseRegex = new RegExp('(?:Initial Catalog|Database)=[^;]*;', 'i');
    const timeoutRegex = new RegExp('(?:Connection|Connect) Timeout=[^;]*;', 'i');

    var $dlg = $('#connections-modal');
    var $selectConnections = $('.select-connections', $dlg);
    var $name = $('.name', $dlg);
    var $server = $('.server', $dlg);
    var $authType = $('.auth-type', $dlg);
    var $credentialsGroup = $('.credentials-group', $dlg);
    var $username = $('.username', $dlg);
    var $password = $('.password', $dlg);
    var $connStr = $('.connection-string', $dlg);
    var $advancedContainer = $('#advanced-container', $dlg);
    var $confirmSql = $('#confirm-sql-execution', $dlg);
    var $database = $('.database-name', $dlg);
    var $timeout = $('.connection-timeout', $dlg);
    var $deleteBtn = $('.delete-btn', $dlg);
    var $addBtn = $('.add-btn', $dlg);

    // Reset connections select
    function resetSelect() {
        $('option:not([value="new"])', $selectConnections).remove();
        $('option[value="new"]', $selectConnections).prop('selected', true);
    }

    // Initialize connections select
    function initSelect() {
        app.connections.forEach(function (conn) {
            $selectConnections.append(`<option value="${conn.id}">${conn.name}</option>`);
        });
    }

    // Reset fields
    function resetFields() {
        $authType.val('sql').change();
        $('input', $dlg).val('').removeClass('is-valid').removeClass('is-invalid');
        $advancedContainer.collapse('hide');
        $confirmSql.prop('checked', false);
    }

    // Reset buttons
    function resetBtns() {
        $deleteBtn.addClass('hidden');
        $addBtn.text('Add');
    }

    // Reset dialog
    function reset() {
        resetFields();
        resetSelect();
        initSelect();
        resetBtns();
    }

    // Hook onto BS events to reset modal
    $dlg.on('show.bs.modal', function (evt) {
        reset();
    }).on('hidden.bs.modal', function () {
        reset();
    });

    // Hook onto app event to show modal
    app.on('open-connections-modal', function (connection) {
        $dlg.modal('show');
        if (connection) {
            $selectConnections.val(connection.id).change();
        }
    });

    // Populate the dialog when a connection is selected
    $selectConnections.change(function () {
        var id = $selectConnections.val();

        if (id === 'new') {
            reset();
        } else {
            var conn = app.findBy(app.connections, 'id', id);
            if (conn) {
                resetFields();
                $deleteBtn.removeClass('hidden');
                $name.val(conn.name);
                $server.val(conn.server);
                // Set auth type (backwards compatibility: integratedSecurity -> windows)
                var authType = conn.authType || (conn.integratedSecurity ? 'windows' : 'sql');
                $authType.val(authType).change();
                $username.val(conn.username);
                // Decrypt password for display (if encrypted)
                if (conn.password) {
                    os.emit('decrypt-password', conn.password);
                } else {
                    $password.val('');
                }
                $confirmSql.prop('checked', !!conn.confirmSql);
                $database.val(conn.database);
                $timeout.val(conn.timeout);
                // Show connection string without password (password is stored separately)
                $connStr.val(conn.raw.replace(passwordRegex, ''));

                $addBtn.text('Save');
            }
        }
    });

    // Handle decrypted password from backend
    os.on('password-decrypted', function (err, plainPassword) {
        if (!err && plainPassword) {
            $password.val(plainPassword);
        }
    });

    $name.on('keydown change', app.debounce(function () {
        if ($name[0].checkValidity()) {
            $name.removeClass('is-invalid').addClass('is-valid');
        } else {
            $name.removeClass('is-valid').addClass('is-invalid');
        }
    }, 200));

    $server.on('keydown change', app.debounce(function () {
        var server = $server.val();
        var connStr = $connStr.val();

        if (serverRegex.test(connStr)) {
            $connStr.val(connStr.replace(serverRegex, 'Data Source=' + server + ';'));
        } else {
            $connStr.val(`Data Source=${server};${connStr}`);
        }

        if ($server[0].checkValidity()) {
            $server.removeClass('is-invalid').addClass('is-valid');
        } else {
            $server.removeClass('is-valid').addClass('is-invalid');
        }
    }, 100));

    $authType.on('change', function () {
        var authType = $authType.val();
        var connStr = $connStr.val();
        var needsCredentials = (authType === 'sql');

        // Show/hide username and password fields
        $credentialsGroup.toggle(needsCredentials);
        $username.prop('disabled', !needsCredentials).prop('required', needsCredentials).removeClass('is-invalid is-valid');
        $password.prop('disabled', !needsCredentials).prop('required', needsCredentials).removeClass('is-invalid is-valid');

        // Update connection string based on auth type
        // First, remove any existing auth-related settings
        connStr = connStr.replace(integratedSecurityRegex, '');
        connStr = connStr.replace(authenticationRegex, '');

        if (authType === 'windows') {
            connStr = `Integrated Security=True;${connStr}`;
        } else if (authType === 'azuread') {
            connStr = `Authentication=Active Directory Default;${connStr}`;
        }
        // For 'sql' type, no special auth parameter needed (uses username/password)

        $connStr.val(connStr);
    });

    $username.on('keydown change', app.debounce(function () {
        var username = $username.val();
        var connStr = $connStr.val();

        if (usernameRegex.test(connStr)) {
            $connStr.val(connStr.replace(usernameRegex, 'User ID=' + username + ';'));
        } else {
            $connStr.val(`User ID=${username};${connStr}`);
        }

        if ($username[0].checkValidity()) {
            $username.removeClass('is-invalid').addClass('is-valid');
        } else {
            $username.removeClass('is-valid').addClass('is-invalid');
        }
    }, 100));

    $password.on('keydown change', app.debounce(function () {
        // Don't sync password to connection string - it's stored separately
        // This avoids issues with special characters like ; in passwords
        if ($password[0].checkValidity()) {
            $password.removeClass('is-invalid').addClass('is-valid');
        } else {
            $password.removeClass('is-valid').addClass('is-invalid');
        }
    }, 100));

    $database.on('keydown change', app.debounce(function () {
        var database = $database.val();
        var connStr = $connStr.val();

        if (database) {
            if (databaseRegex.test(connStr)) {
                $connStr.val(connStr.replace(databaseRegex, 'Initial Catalog=' + database + ';'));
            } else {
                $connStr.val(`Initial Catalog=${database};${connStr}`);
            }
        } else {
            $connStr.val(connStr.replace(databaseRegex, ''));
        }

        if ($database[0].checkValidity()) {
            $database.removeClass('is-invalid').addClass('is-valid');
        } else {
            $database.removeClass('is-valid').addClass('is-invalid');
        }
    }, 100));

    $timeout.on('keydown change', app.debounce(function () {
        var timeout = $timeout.val();
        var connStr = $connStr.val();

        if (timeout) {
            if (timeoutRegex.test(connStr)) {
                $connStr.val(connStr.replace(timeoutRegex, 'Connect Timeout=' + timeout + ';'));
            } else {
                $connStr.val(`Connect Timeout=${timeout};${connStr}`);
            }
        } else {
            $connStr.val(connStr.replace(timeoutRegex, ''));
        }

        if ($timeout[0].checkValidity()) {
            $timeout.removeClass('is-invalid').addClass('is-valid');
        } else {
            $timeout.removeClass('is-valid').addClass('is-invalid');
        }
    }, 100));

    $connStr.on('keydown change', app.debounce(function () {
        var connStr = $connStr.val();

        if (connStr) {
            os.emit('parse-connection-string', connStr);
        }
    }, 100));

    os.on('connection-string-parsed', function (err, connectionString, connBuilder) {
        if (err) {
            $connStr.addClass('is-invalid');
            return console.log(err);
        } else {
            $connStr.removeClass('is-invalid');
        }

        if (connBuilder['Data Source']) {
            $server.val(connBuilder['Data Source']);
            if (!$name.val()) {
                $name.val(connBuilder['Data Source']);
            }
        }
        if (connBuilder['Password']) {
            $password.val(connBuilder['Password']);
        }
        if (connBuilder['User ID']) {
            $username.val(connBuilder['User ID']);
        }
        // Detect authentication type
        if (connBuilder['Authentication'] && connBuilder['Authentication'].toLowerCase().indexOf('active directory') >= 0) {
            $authType.val('azuread').change();
        } else if (connBuilder['Integrated Security'] === 'True' || connBuilder['Integrated Security'] === true) {
            $authType.val('windows').change();
        } else {
            $authType.val('sql').change();
        }
        if (connBuilder['Initial Catalog']) {
            $database.val(connBuilder['Initial Catalog']);
        }
        if (connBuilder['Connect Timeout']) {
            $timeout.val(connBuilder['Connect Timeout']);
        }
    });

    $deleteBtn.click(function () {
        var id = $selectConnections.val();
        if (id !== 'new') {
            app.removeConnection(id);
            reset();
        }
    });

    var _tmpConn = null;
    var _hideAfterSave = false; // Whether to hide the dialog after saving. We hide when a connection is added.

    $addBtn.click(function () {
        // Verify fields (skip disabled fields)
        $('input:not(:disabled)', $dlg).not('.connection-string, #confirm-sql-execution').each(function () {
            var $this = $(this);

            if ($this[0].checkValidity()) {
                $this.removeClass('is-invalid').addClass('is-valid');
            } else {
                $this.removeClass('is-valid').addClass('is-invalid');
            }
        });

        // Encrypt password before saving
        if ($('input.is-invalid', $dlg).length === 0) {
            var id = $selectConnections.val();
            var authType = $authType.val();

            if (id === 'new') {
                app.loading.show('Adding...');
                _hideAfterSave = true;
                _tmpConn = {
                    id: app.id('c'),
                    name: $name.val(),
                    server: $server.val(),
                    authType: authType,
                    integratedSecurity: authType === 'windows', // backwards compatibility
                    username: $username.val(),
                    password: $password.val(),
                    database: $database.val(),
                    timeout: $timeout.val(),
                    raw: $connStr.val(),
                    confirmSql: $confirmSql.is(':checked')
                };
            } else {
                var conn = app.findBy(app.connections, 'id', id);
                if (conn) {
                    app.loading.show('Saving...');
                    _hideAfterSave = false;

                    conn.name = $name.val();
                    conn.server = $server.val();
                    conn.authType = authType;
                    conn.integratedSecurity = authType === 'windows'; // backwards compatibility
                    conn.username = $username.val();
                    conn.password = $password.val();
                    conn.database = $database.val();
                    conn.timeout = $timeout.val();
                    conn.raw = $connStr.val();
                    conn.confirmSql = $confirmSql.is(':checked');

                    _tmpConn = conn;
                }
            }

            // Only encrypt password if using SQL authentication
            if (authType === 'sql' && $password.val()) {
                os.emit('encrypt-password', $password.val());
            } else {
                _save();
            }
        } else {
            // Focus on first invalid field
            $('input.is-invalid:first', $dlg).focus();
        }
    });

    os.on('password-encrypted', function (err, cipher) {
        if (err) {
            console.error(err);
            app.loading.hide();
            return;
        }

        // Store encrypted password separately - don't embed in connection string
        // This avoids issues with special characters like ; in passwords
        _tmpConn.password = cipher;

        // Remove any existing password from the connection string
        var connStr = $connStr.val();
        if (passwordRegex.test(connStr)) {
            connStr = connStr.replace(passwordRegex, '');
        }
        _tmpConn.raw = connStr;
        $connStr.val(connStr);

        _save();
    });

    function _save() {
        app.saveConnection(_tmpConn);

        if (_hideAfterSave) {
            $dlg.modal('hide');
        }

        _tmpConn = null;
        _hideAfterSave = false;
        app.loading.hide();
    }
}(window, window.app = window.app || {}, window.os, jQuery));
