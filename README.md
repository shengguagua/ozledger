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

## 当前功能

- SQLite 持久化
- 账户当前余额维护
- 快照保存 / 覆盖 / 回收站
- 当前余额与历史快照对比
- 任意两个快照区间对比
- JSON 导入 / 导出
