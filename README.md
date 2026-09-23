# OZLedger

OZLedger 是部署在腾讯云 Linux 服务器上的余额快照账本：

- 前端：React + Vite
- 后端：Node + Express
- 生产数据库：MySQL（与 API 同机）
- 本地开发数据库：SQLite

核心使用方式不是逐笔流水，而是：

1. 更新各账户当前余额
2. 保存某个日期的快照
3. 对比任意两个时间点的资产变化

## 当前生产架构

生产环境的配置事实以服务器 `/opt/ozledger-app/.env` 为准。当前已确认：

```env
DB_CLIENT=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=ozledger
```

完整架构和数据安全规则见 [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)。过期配置只记录在 [docs/config-history.md](docs/config-history.md)，不会再作为运行配置使用。

## 数据存储

SQLite 数据库文件默认位于：

```bash
data/ozledger.sqlite
```

你可以继续使用 JSON 做备份和恢复，但主存储已经不是 Google Sheets。

本地未设置 `DB_CLIENT=mysql` 时使用 SQLite；生产环境必须显式使用 MySQL。系统已经加上了：

- 保存前自动备份
- 服务端重算快照总资产，避免前端手填总额和明细不一致
- 基于 `lastSavedAt` 的防覆盖保护，避免旧页面把新数据顶掉
- 更严格的输入校验，防止无效汇率和坏数据写入库
- 生产 MySQL 连接失败时拒绝写入，不静默切换到 SQLite
- 每次生产部署前自动导出一份数据备份

## 数据库配置

当前项目支持通过 `.env` 使用 MySQL。示例见：

```bash
.env.example
```

生产环境使用同一台腾讯云服务器上的 MySQL，数据库主机为本机回环地址：

```bash
DB_HOST=127.0.0.1
```

如果设置：

```bash
DB_CLIENT=mysql
```

后端会自动切到 MySQL，并在目标库里自动建表。`ALLOW_SQLITE_FALLBACK` 仅允许本地开发显式开启，生产必须保持 `false`。

## 本地开发

安装依赖：

```bash
npm install
```

同时启动前端和 SQLite API：

```bash
npm run dev
```

默认地址：

- 前端: [http://127.0.0.1:3000](http://127.0.0.1:3000)
- API: [http://127.0.0.1:8787/api/health](http://127.0.0.1:8787/api/health)

## 生产运行

生产不在本地启动，统一通过部署脚本在腾讯云服务器构建和重启。

生产环境请务必设置 `ALLOWED_ORIGINS`，例如：

```bash
ALLOWED_ORIGINS=https://your-ledger-domain.example
```

系统会在每次写入前自动生成备份。不要删除 `data/backups`；如果 MySQL 连接失败，系统可能回退到本地 SQLite，部署时应同时监控日志中的存储引擎状态。

## 自动化发布

现在仓库里已经放好了自动化发布骨架，适合你这条链路：

1. 本地在 Codex 改代码
2. `git push origin main`
3. GitHub Actions 触发：
   - 先跑 `CI`
   - 再通过 SSH 登录腾讯云 Linux
4. 服务器执行 [scripts/deploy-remote.sh](scripts/deploy-remote.sh)
5. 自动完成：
   - `git fetch`
   - `git reset --hard origin/main`
   - `npm ci`
   - `npm run build:server`
   - `npm run build`
   - `pm2 startOrReload`
6. `nginx` 对公网提供 `dist`，并把 `/api` 转发给 `127.0.0.1:8787`

相关文件：

- [CI workflow](.github/workflows/ci.yml)
- [Deploy workflow](.github/workflows/deploy.yml)
- [PM2 config](ecosystem.config.cjs)
- [Remote deploy script](scripts/deploy-remote.sh)
- [Nginx example](deploy/nginx.ozledger.conf.example)
- [Deploy notes](deploy/README.md)

部署脚本会先请求生产 API 导出完整数据；备份失败时会中止发布。`.env` 不在 SCP 文件列表中，因此不会被仓库内容覆盖。

## 当前功能

- SQLite 持久化
- 账户当前余额维护
- 快照保存 / 覆盖 / 回收站
- 当前余额与历史快照对比
- 任意两个快照区间对比
- JSON 导入 / 导出
