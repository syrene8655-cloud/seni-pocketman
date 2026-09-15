# 可选服务配置

演示曲和本地音乐无需以下配置。

## Apple Music

在项目中自行创建 `private/musickit/`，把自己的 MusicKit `.p8` 私钥放入其中，并创建 `config.json`：

```json
{
  "key_id": "YOUR_KEY_ID",
  "team_id": "YOUR_TEAM_ID",
  "private_key_path": "AuthKey.p8"
}
```

上述内容仅为占位符。私钥路径相对 `config.json` 所在目录解析。也可以设置 `WALKMAN_MUSICKIT_CONFIG` 为自己的配置文件绝对路径。

`private/`、`.env*` 和 `*.p8` 已加入 `.gitignore`。不要上传真实配置、私钥或音乐平台的登录信息。前端会取得短期 developer token 用于 MusicKit，签名私钥只在 Node.js 服务中读取。

配置完成后重新启动自己的服务，再从播放器中连接 Apple Music。本发布包未验证你的开发者配置、账号授权或 DRM 播放。

## 自行部署到服务器

默认仅监听 `127.0.0.1`。若通过反向代理公开部署，需要配置 HTTPS，并设置 `WALKMAN_PUBLIC_ORIGIN=https://你的域名`（不带末尾斜杠），代理到本机端口，并保留正确的 Host。不要把整个项目目录直接设为公共静态根目录；使用提供的 Node.js 服务白名单。

无需公开部署即可在自己的电脑运行。仓库和 ZIP 不附带作者生产服务器配置。
