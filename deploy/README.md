# OZLedger 生产部署

目标流程：

1. 本地只修改代码、文档和部署脚本；
2. 推送到 GitHub `main`；
3. GitHub Actions 先执行 CI；
4. Deploy workflow 通过 SSH 把代码传到腾讯云；
5. 腾讯云服务器执行 `scripts/deploy-remote.sh`；
6. 服务器先导出当前数据，再安装依赖、构建前端、重启 PM2；
7. Nginx 提供前端并把 `/api` 反代到 `127.0.0.1:8787`。

## 服务器目录建议

```bash
/opt/ozledger-app
```

先在腾讯云服务器上手动准备目录：

```bash
sudo mkdir -p /opt/ozledger-app
sudo chown -R ubuntu:ubuntu /opt/ozledger-app
cd /opt/ozledger-app
cp .env.example .env
```

然后编辑 `.env`。生产配置应保持：

```env
DB_CLIENT=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=ozledger
ALLOW_SQLITE_FALLBACK=false
```

`.env` 只存在于服务器，不提交 Git，也不会被部署流程覆盖。

## 服务器依赖

需要先装好：

- `git`
- `node` / `npm`
- `pm2`
- `nginx`

例如：

```bash
npm install -g pm2
```

## GitHub Secrets

在 GitHub 仓库里配置这些 Secrets：

- `DEPLOY_HOST`
- `DEPLOY_PORT`
- `DEPLOY_USER`
- `DEPLOY_SSH_KEY`
- `DEPLOY_PATH`
- `DEPLOY_BRANCH`

推荐值：

- `DEPLOY_PATH=/opt/ozledger-app`
- `DEPLOY_BRANCH=main`

`DEPLOY_HOST` 是腾讯云服务器地址；它与 MySQL 地址不是一回事。MySQL 在该服务器本机运行，所以数据库地址是 `127.0.0.1`。

## Nginx

把 [nginx.ozledger.conf.example](nginx.ozledger.conf.example) 按实际域名修改后放到：

```bash
/etc/nginx/conf.d/ozledger.conf
```

然后执行：

```bash
nginx -t
systemctl reload nginx
```

## 首次启动

首次在服务器上启动：

```bash
cd /opt/ozledger-app
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup
```

## 回滚

每次部署前会在 `data/backups/pre-deploy-*.json` 生成完整数据导出。部署失败时先保持数据库不动，再从 Backup 页面或服务器上的 JSON 备份恢复。不要删除 `data/backups`、`data/change-log.md` 或数据库审计表。
