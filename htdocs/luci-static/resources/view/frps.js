'use strict';
'require view';
'require form';
'require rpc';
'require fs';
'require tools.widgets as widgets';

//	[Widget, Option, Title, Description, {Param: 'Value'}],
var startupConf = [
	[form.Flag, 'enabled', _('Enabled'), _('Enable or disable the frps service (init.enabled).')],
	[form.Flag, 'stdout', _('Log stdout')],
	[form.Flag, 'stderr', _('Log stderr')],
	[widgets.UserSelect, 'user', _('Run daemon as user')],
	[widgets.GroupSelect, 'group', _('Run daemon as group')],
	[form.Flag, 'respawn', _('Respawn when crashed')],
	[form.DynamicList, 'env', _('Environment variable'), _('OS environments pass to frp for config file template, see <a href="https://github.com/fatedier/frp#configuration-file-template">frp README</a>'), {placeholder: 'ENV_NAME=value'}],
	[form.DynamicList, 'conf_inc', _('Additional configs'), _('Config files include in temporary config file'), {placeholder: '/etc/frp/frps.d/frps_full.ini'}]
];

// 分页拆分
var grpBasic = [
	[form.Value, 'bind_addr', _('Bind address'), _('BindAddr specifies the address that the server binds to.<br />By default, this value is "0.0.0.0".'), {datatype: 'ipaddr'}],
	[form.Value, 'bind_port', _('Bind port'), _('BindPort specifies the port that the server listens on.<br />By default, this value is 7000.'), {datatype: 'port'}],
	[form.Value, 'proxy_bind_addr', _('Proxy bind address'), _('ProxyBindAddr specifies the address that the proxy binds to. This value may be the same as BindAddr.<br />By default, this value is "0.0.0.0".'), {datatype: 'ipaddr'}]
];

var grpPortsVhost = [
	// Deprecated bind_udp_port removed: upstream v1 no separate generic UDP listener; QUIC/KCP cover UDP usage.
	[form.Value, 'kcp_bind_port', _('KCP bind port'), _('KCP bind port (0 disables).'), {datatype: 'port'}],
	[form.Value, 'quic_bind_port', _('QUIC bind port'), _('QUIC bind port (0 disables).'), {datatype: 'port'}],
	[form.Value, 'vhost_http_port', _('Vhost HTTP port'), _('Port for HTTP Vhost requests (0=disabled).'), {datatype: 'port'}],
	[form.Value, 'vhost_https_port', _('Vhost HTTPS port'), _('Port for HTTPS Vhost requests (0=disabled).'), {datatype: 'port'}],
	[form.Value, 'vhost_http_timeout', _('Vhost HTTP timeout'), _('Response header timeout seconds (default 60).'), {datatype: 'uinteger'}],
	[form.Value, 'subdomain_host', _('Subdomain host'), _('Base domain for subdomain routing (e.g. frps.example.com).')],
	[form.Value, 'custom_404_page', _('Custom 404 page'), _('Absolute path to custom 404 page; empty uses built-in.')]
];

var grpDashboard = [
	[form.Value, 'webserver_addr', _('WebServer address'), _('WebServer address specifies the address that the web dashboard binds to.<br />By default, this value is "127.0.0.1".'), {datatype: 'ipaddr'}],
	[form.Value, 'webserver_port', _('WebServer port'), _('WebServer port specifies the port that the web dashboard listens on. If this value is 0, the dashboard will not be started.<br />By default, this value is 0.'), {datatype: 'port'}],
	[form.Value, 'webserver_user', _('WebServer user'), _('WebServer user specifies the username that the dashboard will use for login.<br />By default, this value is "admin".')],
	[form.Value, 'webserver_pwd', _('WebServer password'), _('WebServer password specifies the password that the dashboard will use for login.<br />By default, this value is "admin".'), {password: true}],
	[form.Value, 'assets_dir', _('Assets dir'), _('AssetsDir specifies the local directory that the dashboard will load resources from. If this value is "", assets will be loaded from the bundled executable using statik.<br />By default, this value is "".')],
	[form.Value, 'webserver_cert_file', _('WebServer TLS cert file'), _('TLS certificate file path for HTTPS dashboard. Both cert and key files must be provided to enable TLS.')],
	[form.Value, 'webserver_key_file', _('WebServer TLS key file'), _('TLS private key file path for HTTPS dashboard. Both cert and key files must be provided to enable TLS.')],
	[form.Value, 'webserver_ca_file', _('WebServer TLS CA file'), _('TLS trusted CA file path for client certificate verification (optional).')]];

var grpAuth = [
	[form.ListValue, 'auth_method', _('Auth method'), _('Authentication method for validating frpc. Valid values: "token" (default) or "oidc".'), {values: ['token', 'oidc'], default: 'token'}],
	[form.Value, 'token', _('Token'), _('Token specifies the authorization token used to authenticate keys received from clients (auth.method=token).'), {depends: {auth_method: 'token'}}],
	[form.Value, 'oidc_issuer', _('OIDC Issuer'), _('OIDC issuer URL (auth.method=oidc).'), {depends: {auth_method: 'oidc'}}],
	[form.Value, 'oidc_audience', _('OIDC Audience'), _('OIDC audience (auth.method=oidc).'), {depends: {auth_method: 'oidc'}}]
];

var grpTcpMux = [
	[form.Flag, 'tcp_mux', _('TCP mux'), _('TcpMux toggles TCP stream multiplexing. This allows multiple requests from a client to share a single TCP connection.<br />By default, this value is true.'), {datatype: 'bool', default: 'true'}],
	[form.Value, 'tcp_mux_keepalive_interval', _('TCP mux keepalive interval'), _('transport.tcpMuxKeepaliveInterval seconds (only relevant if TCP mux is enabled).'), {datatype: 'uinteger'}],
	[form.Value, 'tcp_keepalive', _('TCP keepalive'), _('transport.tcpKeepalive seconds (interval between TCP-level keepalive probes).'), {datatype: 'uinteger'}]
];

var grpFirewallLimits = [
	[form.DynamicList, 'allow_ports', _('Allow ports / ranges'), _('List of allowed ports or ranges (e.g. "2000-2005", "8080"). Empty list means no restriction.')],
	[form.ListValue, 'set_firewall', _('Firewall auto mode'), _('Automatically create/delete firewall rules for selected ports. Modes: no (do nothing), check (update when changed), force (always recreate on start & delete on stop).'), {values: ['no','check','force'], default: 'no'}],
	[form.Value, 'tcp_ports', _('Firewall TCP ports'), _('Comma/space separated single ports or ranges, applied when firewall auto mode is not "no".')],
	[form.Value, 'udp_ports', _('Firewall UDP ports'), _('Comma/space separated single ports or ranges, applied when firewall auto mode is not "no".')],
	[form.Value, 'max_ports_per_client', _('Max ports per client'), _('MaxPortsPerClient specifies the maximum number of ports a single client may proxy to. If this value is 0, no limit will be applied.<br />By default, this value is 0.'), {datatype: 'uinteger'}]
];

var grpTlsPool = [
	[form.Flag, 'tls_force', _('TLS force'), _('Force all connections to use TLS (transport.tls.force).'), {datatype: 'bool'}],
	[form.Value, 'max_pool_count', _('Max pool count'), _('transport.maxPoolCount limits number of pooled connections.'), {datatype: 'uinteger'}],
    [form.Value, 'heartbeat_timeout', _('Heartbeat timeout'), _('HeartBeatTimeout specifies the maximum time to wait for a heartbeat before terminating the connection. It is not recommended to change this value.<br />By default, this value is 90.'), {datatype: 'uinteger'}],
	[form.Flag, 'enable_prometheus', _('Enable Prometheus metrics'), _('Export Prometheus metrics at /metrics on webServer address (requires webServer.port > 0).')]
];

var grpAdvancedPerf = [
	[form.Value, 'user_conn_timeout', _('User conn timeout'), _('userConnTimeout seconds (wait work connection).') , {datatype: 'uinteger'}],
	[form.Value, 'udp_packet_size', _('UDP packet size'), _('udpPacketSize bytes (default 1500).'), {datatype: 'uinteger'}]
];

var grpLogging = [
	[form.Value, 'log_to', _('Log output target'), _('Preferred new key. Accepts a file path or special values: "console", "/dev/null". Leave empty for upstream default (console).')],
	[form.Value, 'log_file', _('(Deprecated) legacy log_file'), _('Deprecated legacy key retained for backward compatibility. Will be migrated to log_to in runtime; please move value to "Log output target" and clear this.'), {placeholder: '/var/log/frps.log'}],
	[form.ListValue, 'log_level', _('Log level'), _('Minimum log level.'), {values: ['trace', 'debug', 'info', 'warn', 'error']}],
	[form.Value, 'log_max_days', _('Log max days'), _('Maximum days to retain file logs (file mode only).'), {datatype: 'uinteger'}],
	[form.Flag, 'disable_log_color', _('Disable log color'), _('Disable ANSI color in console logs.'), {datatype: 'bool', default: 'true'}]
];

// Additional settings: rename '_' to 'extra_settings' (still read old '_' if exists)
var grpAdditional = [
	[form.DynamicList, 'extra_settings', _('Additional settings'), _('This list can be used to specify some additional parameters which have not been included in this LuCI.'), {placeholder: 'Key-A=Value-A'}]
];

function writeFlagDisabled(section_id) {
	return this.write(section_id, this.disabled || 'false');
}

function removeIfPresent(section_id) {
	const this_cfg = this.uciconfig || this.section.uciconfig || this.map.config;
	const this_sid = this.ucisection || section_id;
	const this_opt = this.ucioption || this.option;

	for (let i = 0; i < this.section.children.length; i++) {
		const sibling = this.section.children[i];

		if (sibling === this || sibling.ucioption == null)
			continue;

		const sibling_cfg = sibling.uciconfig || sibling.section.uciconfig || sibling.map.config;
		const sibling_sid = sibling.ucisection || section_id;
		const sibling_opt = sibling.ucioption || sibling.option;

		if (this_cfg != sibling_cfg || this_sid != sibling_sid || this_opt != sibling_opt)
			continue;

		if (typeof sibling.isActive === 'function' && sibling.isActive(section_id))
			return Promise.resolve();
	}

	if (this.map.data.get(this_cfg, this_sid, this_opt) == null)
		return Promise.resolve();

	return this.map.data.unset(this_cfg, this_sid, this_opt);
}

function isUciDeleteNotFoundError(err) {
	const message = err && err.message ? err.message : String(err);

	return /uci\/delete/.test(message) && /ubus code 4/.test(message);
}

function guardUciDeleteNotFound(data, config) {
	data._frpIgnoreMissingDeleteConfigs ??= {};
	data._frpIgnoreMissingDeleteConfigs[config] = true;

	if (data._frpIgnoreMissingDeleteInstalled)
		return;

	const callDelete = data.callDelete;

	data.callDelete = function(conf, sid, options) {
		const guarded = this._frpIgnoreMissingDeleteConfigs && this._frpIgnoreMissingDeleteConfigs[conf];

		return callDelete.apply(this, arguments).catch(L.bind(function(err) {
			if (!guarded || !isUciDeleteNotFoundError(err))
				return Promise.reject(err);

			if (!Array.isArray(options) || options.length <= 1)
				return null;

			return Promise.all(options.map(L.bind(function(opt) {
				return callDelete.call(this, conf, sid, [ opt ]).catch(function(e) {
					return isUciDeleteNotFoundError(e) ? null : Promise.reject(e);
				});
			}, this)));
		}, this));
	};

	data._frpIgnoreMissingDeleteInstalled = true;
}

function normalizeDepends(depends) {
	if (depends == null)
		return [];

	return Array.isArray(depends) ? depends : [ depends ];
}

function mergeDepends(existing, next) {
	const current = normalizeDepends(existing);
	const incoming = normalizeDepends(next);

	if (current.length === 0)
		return incoming;

	if (incoming.length === 0)
		return current;

	const merged = [];

	for (let oldDep of current) {
		for (let newDep of incoming) {
			const dep = {};
			let conflict = false;

			for (let key in oldDep)
				dep[key] = oldDep[key];

			for (let key in newDep) {
				if (Object.prototype.hasOwnProperty.call(dep, key) && dep[key] !== newDep[key]) {
					conflict = true;
					break;
				}

				dep[key] = newDep[key];
			}

			if (!conflict)
				merged.push(dep);
		}
	}

	return merged;
}

function setParams(o, params) {
	if (!params)
		return;

	for (let key in params) {
		let val = params[key];

		if (key === 'values') {
			for (let v of val) {
				let args = v;

				if (!Array.isArray(args))
					args = [args];

				o.value.apply(o, args);
			}
		} else if (key === 'depends') {
			o.deps = mergeDepends(o.deps, val);
		} else {
			o[key] = params[key];
		}
	}

	if (params['datatype'] === 'bool') {
		o.enabled = 'true';
		o.disabled = 'false';
	}
}

function isIgnorableUciDeleteError(err) {
	if (!err)
		return false;
	var msg = '';
	if (err.message)
		msg = err.message;
	else if (typeof err === 'string')
		msg = err;
	else
		msg = '' + err;
	return (msg.indexOf('uci/delete') !== -1) && (msg.indexOf('Not found') !== -1 || msg.indexOf('code 4') !== -1);
}

function swallowUciDelete(promise) {
	return Promise.resolve(promise).catch(function(err) {
		if (isIgnorableUciDeleteError(err)) {
			console.warn('Ignoring benign UCI delete failure:', err);
			return null;
		}
		throw err;
	});
}

function defTabOpts(s, t, opts, params) {
	for (let opt of opts) {
		const o = s.taboption(t, opt[0], opt[1], opt[2], opt[3]);

		setParams(o, opt[4]);
		setParams(o, params);

		/*
		 * Per-option optional must win over tab-wide optional.
		 * This is important for form.Flag with default='true',
		 * otherwise LuCI may treat checked state as default and call remove().
		 */
		// 保留定制表格中逐字段的可见性设置。
		if (opt[4] && Object.prototype.hasOwnProperty.call(opt[4], 'modalonly'))
			o.modalonly = opt[4].modalonly;

		if (opt[4] && Object.prototype.hasOwnProperty.call(opt[4], 'optional'))
			o.optional = opt[4].optional;

		if (
			!(opt[4] && Object.prototype.hasOwnProperty.call(opt[4], 'remove')) &&
			!(params && Object.prototype.hasOwnProperty.call(params, 'remove'))
		) {
			if (opt[0] === form.Flag) {
				// 关闭开关必须保存 disabled，不能删除后被服务默认值重新启用。
				o.rmempty = false;
				o.retain = true;
				o.remove = writeFlagDisabled;
			} else {
				o.remove = removeIfPresent;
			}
		}
	}
}

function defOpts(s, opts, params) {
	for (let opt of opts) {
		const o = s.option(opt[0], opt[1], opt[2], opt[3]);

		setParams(o, opt[4]);
		setParams(o, params);

		// 保留定制表格中逐字段的可见性设置。
		if (opt[4] && Object.prototype.hasOwnProperty.call(opt[4], 'modalonly'))
			o.modalonly = opt[4].modalonly;

		if (opt[4] && Object.prototype.hasOwnProperty.call(opt[4], 'optional'))
			o.optional = opt[4].optional;

		if (
			!(opt[4] && Object.prototype.hasOwnProperty.call(opt[4], 'remove')) &&
			!(params && Object.prototype.hasOwnProperty.call(params, 'remove'))
		) {
			if (opt[0] === form.Flag) {
				// 关闭开关必须保存 disabled，不能删除后被服务默认值重新启用。
				o.rmempty = false;
				o.retain = true;
				o.remove = writeFlagDisabled;
			} else {
				o.remove = removeIfPresent;
			}
		}
	}
}

const callServiceList = rpc.declare({
	object: 'service',
	method: 'list',
	params: ['name'],
	expect: { '': {} }
});

function getServiceStatus() {
	return L.resolveDefault(callServiceList('frps'), {}).then(function (res) {
		const instances = res.frps && res.frps.instances;

		if (!instances)
			return false;

		for (let name in instances) {
			if (instances[name] && instances[name].running)
				return true;
		}

		return false;
	});
}

function renderStatus(isRunning) {
	var renderHTML = "";
	var spanTemp = '<em><span style="color:%s"><strong>%s %s</strong></span></em>';

	if (isRunning) {
		renderHTML += String.format(spanTemp, 'green', _("frp Server"), _("RUNNING"));
	} else {
		renderHTML += String.format(spanTemp, 'red', _("frp Server"), _("NOT RUNNING"));
	}

	return renderHTML;
}

var callRcInit = rpc.declare({
	object: 'rc',
	method: 'init',
	params: [ 'name', 'action' ]
});

// Exec frps init.d action via rc ubus interface
function serviceAction(action) {
	return callRcInit('frps', action).then(function() {
		// Success: rc.init returns empty object on success
		return { code: 0, stderr: '' };
	}).catch(function(e) {
		console.error('Service action failed:', e);
		return { code: -1, stderr: (e && e.message) || 'Unknown error' };
	});
}

function fmtNow() {
	try { return new Date().toLocaleString(); } catch (e) { return new Date().toISOString(); }
}

function updateActionStatus(action, res) {
	var el = document.getElementById('service_action_status');
	if (!el) return;
	var code = (res && typeof res.code !== 'undefined') ? res.code : 'n/a';
	var msg = (res && res.stderr) ? ('' + res.stderr).trim() : '';
	var ok = (code === 0);
	el.innerText = String.format('%s: %s (code=%s) @ %s%s',
		action.toUpperCase(), ok ? _('OK') : _('Failed'), code, fmtNow(), msg ? (' - ' + msg) : '');
	el.style.color = ok ? 'green' : 'red';
}

return view.extend({
	render: function() {
		let m, s, o;

		m = new form.Map('frps', _('frp Server'));
		guardUciDeleteNotFound(m.data, 'frps');

		s = m.section(form.NamedSection, '_status');
		s.anonymous = true;
		s.render = function (section_id) {
			var refresh = function() {
				return L.resolveDefault(getServiceStatus()).then(function(res) {
					var view = document.getElementById('service_status');
					if (view) view.innerHTML = renderStatus(res);
				});
			};

			L.Poll.add(refresh);

			return E('div', { class: 'cbi-map' },
				E('fieldset', { class: 'cbi-section'}, [
					E('p', { id: 'service_status' }, _('Collecting data ...')),
					E('div', { class: 'cbi-section-actions' }, [
						E('button', { class: 'btn cbi-button-action', click: function(){ serviceAction('start').then(function(res){ updateActionStatus('start', res); }).then(refresh); } }, _('Start')),
						E('button', { class: 'btn cbi-button-reset', click: function(){ serviceAction('stop').then(function(res){ updateActionStatus('stop', res); }).then(refresh); } }, _('Stop')),
						E('button', { class: 'btn cbi-button-reload', click: function(){ serviceAction('restart').then(function(res){ updateActionStatus('restart', res); }).then(refresh); } }, _('Restart'))
					]),
					E('div', { class: 'cbi-value-description' }, [
						E('small', { id: 'service_action_status', style: 'opacity:0.85' }, _('No actions yet.'))
					])
				])
			);
		}

		s = m.section(form.NamedSection, 'common', 'conf');
		s.dynamic = true;

		s.tab('basic', _('Basic'));
		s.tab('ports_vhost', _('Ports & VHost'));
		s.tab('dashboard', _('Dashboard'));
		s.tab('auth', _('Authentication'));
		s.tab('firewall', _('Firewall & Limits'));
		s.tab('tls_pool', _('TLS & Pooling'));
		s.tab('advanced_perf', _('Advanced Perf'));
		s.tab('logging', _('Logging'));
		s.tab('additional', _('Additional'));
		s.tab('init', _('Startup settings'));
		defTabOpts(s, 'basic', grpBasic);
		defTabOpts(s, 'ports_vhost', grpPortsVhost);
		defTabOpts(s, 'dashboard', grpDashboard);
		defTabOpts(s, 'auth', grpAuth);
		defTabOpts(s, 'firewall', grpFirewallLimits);
		defTabOpts(s, 'tls_pool', grpTlsPool);
		defTabOpts(s, 'advanced_perf', grpAdvancedPerf);
		defTabOpts(s, 'logging', grpLogging);
		defTabOpts(s, 'additional', grpAdditional);

		// Backward compatibility: if old '_' list exists and new 'extra_settings' empty, show old values
		var oldList = m.data.get('frps', 'common', '_');
		var newList = m.data.get('frps', 'common', 'extra_settings');
		if (oldList && (!newList || newList.length === 0)) {
			m.data.set('frps', 'common', 'extra_settings', oldList);
		}

		o = s.taboption('init', form.SectionValue, 'init', form.TypedSection, 'init', _('Startup settings'));
		s = o.subsection;
		s.anonymous = true;
		s.dynamic = true;

		defOpts(s, startupConf);

		return m.render();
	}
,
	// Suppress harmless "uci/delete code 4" errors during save cycles
	handleSave: function(ev) {
		return swallowUciDelete(this.super('handleSave', ev));
	},

	// Restart frps after Save & Apply to apply new config immediately
	handleSaveApply: function(ev) {
		var self = this;
		return swallowUciDelete(this.super('handleSaveApply', ev)).then(function(res) {
			return callRcInit('frps', 'restart').catch(function(e){ return null; }).then(function(){ return res; });
		});
	}
});
