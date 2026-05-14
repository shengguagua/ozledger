# Production Deploy

目标流程：

1. 本地在 Codex 改代码
2. 推送到 GitHub `main`
3. GitHub Actions checkout 最新代码
4. GitHub Actions 把代码直接传到腾讯云 Linux
5. 服务器执行 `scripts/deploy-remote.sh`
6. 安装依赖、构建前端、重启 `pm2`
6. `nginx` 对公网提供前端，并把 `/api` 反代到 `127.0.0.1:8787`

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

然后编辑 `.env`，填生产环境配置。

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

## Nginx

把 [nginx.ozledger.conf.example](/Users/melon/Documents/GitHub/ozledger/deploy/nginx.ozledger.conf.example) 改成你的域名后放到：

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
