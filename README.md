# luci-app-frps

**简体中文** | [English](README.en.md)

面向 OpenWrt / ImmortalWrt 的 **frp 服务端 LuCI 管理界面**。本版本把服务端网页、UCI → TOML 生成、procd 管理和可选防火墙规则放在同一套配置链路中，适合在路由器或软路由上维护自己的 frp 服务。

> 隧道服务由 [fatedier/frp](https://github.com/fatedier/frp) 的 `frps` 实现。本仓库负责 OpenWrt 集成，不是新写的 frp 服务端，也不是桌面版管理面板。

## 我的改造与特色

| 改造 | 实际作用 |
| --- | --- |
| **从旧式配置转向 TOML** | 用 `/etc/config/frps` 配置，启动时生成 `/var/run/frps/frps.toml`；维护新字段与旧配置的迁移路径。 |
| **重新组织 LuCI 页面** | 分开监听端口、HTTP / HTTPS vhost、Dashboard、认证、传输、限额、日志与启动选项。 |
| **Token / OIDC 与 TLS** | 配置客户端认证、强制 TLS，以及 Dashboard 的证书、私钥和可选 CA。 |
| **传输和可观测性选项** | QUIC / KCP 监听、TCP 复用与 keepalive、连接池、超时、UDP 包大小、Prometheus 开关。 |
| **端口授权与防火墙分开管理** | `allow_ports` 限制客户端可申请的代理端口；`set_firewall` 可选择不操作、变更时更新或启动 / 停止时创建删除 WAN 规则。 |
| **配置生成细节修正** | 处理端口范围、布尔值、旧日志键、Dashboard 键和重复扩展键；保护运行配置路径，生成文件权限设为 `0600`。 |
| **原生服务按钮** | 通过 ubus 执行启停 / 重启，显示操作结果与服务状态。 |
| **扩展配置** | 支持 `extra_settings` 和 `conf_inc` TOML 片段，覆盖未提供专门表单项的配置。 |

实现入口：[LuCI 页面](htdocs/luci-static/resources/view/frps.js) · [生成器 / init / 防火墙](root/etc/init.d/frps) · [默认 UCI](root/etc/config/frps) · [打包规则](Makefile)。

## 构建与安装

需要 OpenWrt / ImmortalWrt SDK 或构建树、LuCI，以及支持所用 TOML 字段的 `frps`。本包依赖 `luci-base` 和 `frps`，不包含核心二进制。

在已准备好 feeds 的构建树根目录执行：

```sh
git clone https://github.com/Altars3668/luci-app-frps.git package/luci-app-frps
./scripts/feeds install luci-base frps
printf '%s\n' 'CONFIG_PACKAGE_luci-app-frps=m' 'CONFIG_LUCI_LANG_zh_Hans=y' >> .config
make defconfig
make package/luci-app-frps/compile V=s -j2
```

检查并移除构建树里的同名旧 LuCI 包，避免多个配方竞争。根据目标 SDK 生成的实际包格式安装，不要混用不匹配系统的 IPK / APK。

**先备份配置：** 本包自带 `/etc/config/frps` 与 `/etc/init.d/frps`，安装钩子会清理核心包的冲突路径。固件构建时应让核心包只提供二进制，本包提供 UCI 和 init；配套 [OpenWRT-CI](https://github.com/Altars3668/OpenWRT-CI) 已做对应处理。手动安装前另存旧配置，不要直接使用强制覆盖。

## 使用流程

1. 打开 **服务 → frp 服务端**，设置监听地址与端口。
2. 配置强 Token 或有效的 OIDC 参数；空 Token 不是安全的公网默认值。
3. 按需开启 HTTP / HTTPS vhost、QUIC 或 KCP。默认配置文件虽然有“禁用”注释，但实际 vhost 值是 `80` / `443`，QUIC 是 `7000`；以选项值和生成配置为准，避免与其他服务抢端口。
4. 设置客户端允许的端口 / 范围及资源限制。
5. 如果使用自动防火墙模式，再配置实际要开放的 TCP / UDP 端口。**frp 的 `allow_ports` 不等于 OpenWrt 的 WAN 放行规则。**
6. 启用并保存应用，核对服务状态与配置校验。

```sh
# 路由器上的只读诊断；不要公开配置中的认证信息
frps verify -c /var/run/frps/frps.toml
logread -e frps
```

## 配置模型

| 配置入口 | 作用 |
| --- | --- |
| `frps.common` | 监听、认证、传输、端口、Dashboard、日志与额外参数。 |
| `frps.init` | 启用、stdout / stderr、运行用户 / 组、respawn、环境变量与附加配置片段。 |
| `/var/run/frps/frps.toml` | 启动时生成的运行配置，不应当作长期手工编辑的真相源。 |

`conf_inc` 直接追加 TOML 片段，需要自行保证格式和字段不冲突。`extra_settings` 接受合法的 TOML `key=value`；生成器会跳过与已输出核心字段冲突的扩展项。

## 限制与安全边界

- **reload 使用 stop/start**，会影响正在使用的隧道，不提供无损热更新。
- 自动防火墙模式会提交 firewall UCI 并 reload 防火墙；在承担远程访问的路由器上先评估影响。
- Dashboard 建议绑定 loopback 或管理网，设置认证和 TLS，不要裸露到公网。
- Token、OIDC、TLS、扩展字段是否被接受取决于安装的 frp 版本，升级后应重新运行 `verify`。
- 不承诺所有架构 / 固件版本已验证，也不承诺现有持续预编译 Release；使用匹配的 SDK 或配套固件。

## 来源与许可证

由 Altars3668 维护的 OpenWrt frp 集成版本。保留原有源码和 Git 历史中的来源信息；核心来自 [fatedier/frp](https://github.com/fatedier/frp)。本包 [Makefile](Makefile) 声明 **Apache-2.0**，依赖遵循各自许可证。

相关项目：[FRPC 客户端界面](https://github.com/Altars3668/luci-app-frpc) · [配套固件 CI](https://github.com/Altars3668/OpenWRT-CI)。
