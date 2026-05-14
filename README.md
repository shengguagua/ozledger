# OZLedger

OZLedger 现在是一个适合部署在 `Mac mini` 上的余额快照账本：

- 前端：React + Vite
- 后端：Node + Express
- 数据库：SQLite

核心使用方式不是逐笔流水，而是：

1. 更新各账户当前余额
2. 保存某个日期的快照
3. 对比任意两个时间点的资产变化

## 数据存储

SQLite 数据库文件默认位于：

```bash
data/ozledger.sqlite
```

你可以继续使用 JSON 做备份和恢复，但主存储已经不是 Google Sheets。

现在这套后端默认还使用本地 SQLite，但已经加上了：

- 保存前自动备份
- 服务端重算快照总资产，避免前端手填总额和明细不一致
- 基于 `lastSavedAt` 的防覆盖保护，避免旧页面把新数据顶掉
- 更严格的输入校验，防止无效汇率和坏数据写入库

## 腾讯云数据库目标

当前项目支持通过 `.env` 切到 MySQL。示例见：

```bash
.env.example
```

当前项目里已经把腾讯云数据库目标主机预留成：

```bash
OZ_DB_HOST=43.136.32.239
```

如果设置：

```bash
DB_CLIENT=mysql
```

后端会自动切到 MySQL，并在目标库里自动建表。没有设置时，默认继续使用本地 SQLite。

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

只启动后端：

```bash
npm run start
```

前端静态资源构建：

```bash
npm run build
```

## 适合 Mac mini 的部署方式

推荐：

1. `npm run build`
2. `npm run start`
3. 用 `pm2` 守护 Node 服务
4. 用 `nginx` 反代前端静态资源和 `/api`

## 自动化发布

现在仓库里已经放好了自动化发布骨架，适合你这条链路：

1. 本地在 Codex 改代码
2. `git push origin main`
3. GitHub Actions 触发：
   - 先跑 `CI`
   - 再通过 SSH 登录腾讯云 Linux
4. 服务器执行 [scripts/deploy-remote.sh](/Users/melon/Documents/GitHub/ozledger/scripts/deploy-remote.sh)
5. 自动完成：
   - `git fetch`
   - `git reset --hard origin/main`
   - `npm ci`
   - `npm run build:server`
   - `npm run build`
   - `pm2 startOrReload`
6. `nginx` 对公网提供 `dist`，并把 `/api` 转发给 `127.0.0.1:8787`

相关文件：

- [CI workflow](/Users/melon/Documents/GitHub/ozledger/.github/workflows/ci.yml)
- [Deploy workflow](/Users/melon/Documents/GitHub/ozledger/.github/workflows/deploy.yml)
- [PM2 config](/Users/melon/Documents/GitHub/ozledger/ecosystem.config.cjs)
- [Remote deploy script](/Users/melon/Documents/GitHub/ozledger/scripts/deploy-remote.sh)
- [Nginx example](/Users/melon/Documents/GitHub/ozledger/deploy/nginx.ozledger.conf.example)
- [Deploy notes](/Users/melon/Documents/GitHub/ozledger/deploy/README.md)

## 当前功能

- SQLite 持久化
- 账户当前余额维护
- 快照保存 / 覆盖 / 回收站
- 当前余额与历史快照对比
- 任意两个快照区间对比
- JSON 导入 / 导出
