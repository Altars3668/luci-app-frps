# luci-app-frps

[简体中文](README.md) | **English**

A **LuCI frontend and service integration for the frp server on OpenWrt / ImmortalWrt**. This edition maintains the web UI, UCI-to-TOML generator, procd lifecycle and optional firewall rules as one configuration pipeline for router-hosted frp servers.

> The tunnel server is the upstream [fatedier/frp](https://github.com/fatedier/frp) `frps` engine. This project integrates it with OpenWrt; it is neither a new frp engine nor a desktop administration application.

## What I changed

| Change | Practical benefit |
| --- | --- |
| **TOML generation instead of the old configuration path** | Uses `/etc/config/frps`, generates `/var/run/frps/frps.toml`, and maintains migration paths for older fields. |
| **Reorganised LuCI settings** | Separates listeners, HTTP / HTTPS vhosts, Dashboard, authentication, transport, limits, logging and startup. |
| **Token / OIDC and TLS** | Configures client authentication, mandatory TLS, and Dashboard certificate, key and optional CA. |
| **Transport and observability options** | Adds QUIC / KCP listeners, TCP multiplexing and keepalive, pool size, timeouts, UDP packet size and Prometheus controls. |
| **Port authorisation distinct from firewall access** | `allow_ports` restricts ports clients can request; `set_firewall` optionally manages WAN rules on changes or service start / stop. |
| **Generator corrections** | Handles port ranges, booleans, legacy logging / Dashboard fields and duplicate extensions; protects runtime paths and writes configuration with mode `0600`. |
| **Native service controls** | Uses ubus for start, stop and restart with operation feedback and service status. |
| **Configuration escape hatches** | Supports `extra_settings` and `conf_inc` TOML fragments for fields without dedicated UI controls. |

Implementation: [LuCI view](htdocs/luci-static/resources/view/frps.js) · [generator / init / firewall](root/etc/init.d/frps) · [default UCI](root/etc/config/frps) · [recipe](Makefile).

## Build and installation

Use an OpenWrt / ImmortalWrt SDK or buildroot, LuCI, and a `frps` engine supporting the generated TOML fields. Dependencies are `luci-base` and `frps`; the engine binary is not bundled here.

From a buildroot with its feeds already updated:

```sh
git clone https://github.com/Altars3668/luci-app-frps.git package/luci-app-frps
./scripts/feeds install luci-base frps
printf '%s\n' 'CONFIG_PACKAGE_luci-app-frps=m' 'CONFIG_LUCI_LANG_zh_Hans=y' >> .config
make defconfig
make package/luci-app-frps/compile V=s -j2
```

Keep only one copy of the LuCI recipe. Install packages matching the target SDK and system; do not mix incompatible IPK / APK outputs.

**Back up configuration first.** This package owns `/etc/config/frps` and `/etc/init.d/frps`; its installation hooks remove conflicting paths from the engine package. For firmware builds, let the engine package provide only the binary and this package provide UCI and init. The companion [OpenWRT-CI](https://github.com/Altars3668/OpenWRT-CI) applies this arrangement. Do not force-overwrite an existing installation without a separate backup.

## Usage

1. Open **Services → frp → Server** and configure the bind address and port.
2. Set a strong Token or valid OIDC configuration. An empty Token is not a safe public-server default.
3. Enable HTTP / HTTPS vhosts, QUIC or KCP as needed. Despite a “disabled” comment, the shipped UCI values enable vhost ports `80` / `443` and QUIC port `7000`. Check actual options and generated configuration to avoid listener conflicts.
4. Configure allowed client ports / ranges and resource limits.
5. If enabling automatic firewall management, configure the TCP / UDP ports to open. **frp `allow_ports` is not an OpenWrt WAN allow rule.**
6. Enable and apply, then check service status and configuration validation.

```sh
# Read-only diagnostics on the router; do not publish authentication fields.
frps verify -c /var/run/frps/frps.toml
logread -e frps
```

## Configuration model

| Entry | Purpose |
| --- | --- |
| `frps.common` | Listeners, authentication, transport, ports, Dashboard, logging and extensions. |
| `frps.init` | Enable flag, stdout / stderr, user / group, respawn, environment and fragments. |
| `/var/run/frps/frps.toml` | Generated runtime configuration, not the source for persistent manual edits. |

`conf_inc` appends raw TOML fragments; their syntax and uniqueness are your responsibility. `extra_settings` accepts valid TOML `key=value` entries. Extensions conflicting with generated core fields are skipped.

## Limitations and security

- **Reload performs stop/start** and can interrupt tunnels; it is not connection-preserving hot reload.
- Automatic firewall mode commits firewall UCI and reloads the firewall. Assess the impact before using it on a router providing your remote access.
- Bind Dashboard to loopback or a management network, with authentication and TLS; do not expose an unsecured dashboard publicly.
- Accepted authentication, TLS and extension fields depend on the installed frp version. Run `verify` again after upgrades.
- Not every architecture or firmware version has been validated, and a continuous prebuilt Release feed is not promised. Use a matching SDK or companion firmware artifacts.

## Attribution and license

An OpenWrt frp integration maintained by Altars3668, retaining provenance in source and Git history. The engine comes from [fatedier/frp](https://github.com/fatedier/frp). This package's [Makefile](Makefile) declares **Apache-2.0**; dependencies retain their own licenses.

Related: [FRPC client UI](https://github.com/Altars3668/luci-app-frpc) · [firmware CI](https://github.com/Altars3668/OpenWRT-CI).

## Upstream baseline and regression checks

The verified source is [`immortalwrt/luci/applications/luci-app-frps`](https://github.com/immortalwrt/luci/tree/5fc1fac5684cac6eee2c7fbff78c65b867980dd8/applications/luci-app-frps), pinned to `5fc1fac5684c`. [UPSTREAM.md](UPSTREAM.md) explains provenance, imported history and retained customisations.

`node tests/upstream-regression.mjs` and `python3 -I tests/config-generation.py`; generation tests use a temporary UCI stub and never start services.
